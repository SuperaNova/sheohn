import type { LanguageModel } from 'ai';

export type LanguageModelV3 = Extract<
  LanguageModel,
  { specificationVersion: 'v3' }
>;
type LanguageModelV3CallOptions = Parameters<LanguageModelV3['doStream']>[0];
type LanguageModelV3StreamResult = Awaited<
  ReturnType<LanguageModelV3['doStream']>
>;
type LanguageModelV3StreamPart =
  LanguageModelV3StreamResult['stream'] extends ReadableStream<infer Part>
    ? Part
    : never;

interface ModelFallbackOptions {
  firstChunkTimeoutMs: number;
  onFallback?: (toModelId: string) => void;
}

interface OpenedStream {
  result: LanguageModelV3StreamResult;
  reader: ReadableStreamDefaultReader<LanguageModelV3StreamPart>;
  buffered: LanguageModelV3StreamPart[];
  ended: boolean;
}

class FirstChunkTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`no stream chunk within ${timeoutMs}ms`);
    this.name = 'FirstChunkTimeoutError';
  }
}

// stream-start and response-metadata arrive on headers, before any content.
const PRELUDE_PART_TYPES = new Set<string>([
  'stream-start',
  'response-metadata',
]);

// Resolves once the first content chunk (or stream end) is read; aborts the request if it never comes.
async function openStream(
  model: LanguageModelV3,
  options: LanguageModelV3CallOptions,
  timeoutMs: number,
): Promise<OpenedStream> {
  const attemptController = new AbortController();
  const signal = options.abortSignal
    ? AbortSignal.any([options.abortSignal, attemptController.signal])
    : attemptController.signal;

  const attempt = (async (): Promise<OpenedStream> => {
    const result = await model.doStream({ ...options, abortSignal: signal });
    const reader = result.stream.getReader();
    const buffered: LanguageModelV3StreamPart[] = [];
    for (;;) {
      const next = await reader.read();
      if (next.done) return { result, reader, buffered, ended: true };
      if (next.value.type === 'error') {
        void reader.cancel().catch(() => {});
        throw next.value.error;
      }
      buffered.push(next.value);
      if (!PRELUDE_PART_TYPES.has(next.value.type)) {
        return { result, reader, buffered, ended: false };
      }
    }
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      attemptController.abort();
      reject(new FirstChunkTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([attempt, timeout]);
  } catch (e) {
    // A timed-out attempt may still resolve later; release its stream.
    attempt.then(
      ({ reader }) => void reader.cancel().catch(() => {}),
      () => {},
    );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function replayStream({
  result,
  reader,
  buffered,
  ended,
}: OpenedStream): LanguageModelV3StreamResult {
  const stream = new ReadableStream<LanguageModelV3StreamPart>({
    async pull(controller) {
      const part = buffered.shift();
      if (part) return controller.enqueue(part);
      if (ended) return controller.close();
      const next = await reader.read();
      if (next.done) controller.close();
      else controller.enqueue(next.value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return { ...result, stream };
}

/**
 * Walks `models` in order, moving on when one throws or stays silent past the
 * first-chunk timeout. Switches only before any chunk is forwarded, so two
 * models' output is never spliced into one stream. The last model runs without
 * a first-chunk timeout; its failure propagates. Each wrapper remembers the
 * model that last worked, so build one per request.
 */
export function withModelFallbacks(
  models: LanguageModelV3[],
  { firstChunkTimeoutMs, onFallback }: ModelFallbackOptions,
): LanguageModelV3 {
  const [first] = models;
  if (!first) throw new Error('withModelFallbacks needs at least one model');
  const lastIndex = models.length - 1;
  // Later calls (tool-loop steps) resume at the last model that worked.
  let startIndex = 0;

  return {
    specificationVersion: 'v3',
    provider: first.provider,
    modelId: first.modelId,
    supportedUrls: first.supportedUrls,
    async doGenerate(options) {
      for (let i = startIndex; i < lastIndex; i++) {
        try {
          const result = await models[i]!.doGenerate(options);
          startIndex = i;
          return result;
        } catch (e) {
          if (options.abortSignal?.aborted) throw e;
          onFallback?.(models[i + 1]!.modelId);
        }
      }
      const result = await models[lastIndex]!.doGenerate(options);
      startIndex = lastIndex;
      return result;
    },
    async doStream(options) {
      for (let i = startIndex; i < lastIndex; i++) {
        try {
          const opened = await openStream(
            models[i]!,
            options,
            firstChunkTimeoutMs,
          );
          startIndex = i;
          return replayStream(opened);
        } catch (e) {
          if (options.abortSignal?.aborted) throw e;
          onFallback?.(models[i + 1]!.modelId);
        }
      }
      const result = await models[lastIndex]!.doStream(options);
      startIndex = lastIndex;
      return result;
    },
  };
}
