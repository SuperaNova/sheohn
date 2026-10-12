import type { LanguageModel } from 'ai';

type LanguageModelV3 = Extract<LanguageModel, { specificationVersion: 'v3' }>;
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
  onFallback?: () => void;
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
 * Falls back to `fallback` once if `primary` throws or stays silent past the
 * first-chunk timeout. Switches only before any chunk is forwarded, so two
 * models' output is never spliced into one stream.
 */
export function withModelFallback(
  primary: LanguageModelV3,
  fallback: LanguageModelV3,
  { firstChunkTimeoutMs, onFallback }: ModelFallbackOptions,
): LanguageModelV3 {
  return {
    specificationVersion: 'v3',
    provider: primary.provider,
    modelId: primary.modelId,
    supportedUrls: primary.supportedUrls,
    async doGenerate(options) {
      try {
        return await primary.doGenerate(options);
      } catch (e) {
        if (options.abortSignal?.aborted) throw e;
        onFallback?.();
        return fallback.doGenerate(options);
      }
    },
    async doStream(options) {
      try {
        return replayStream(
          await openStream(primary, options, firstChunkTimeoutMs),
        );
      } catch (e) {
        if (options.abortSignal?.aborted) throw e;
        onFallback?.();
        return fallback.doStream(options);
      }
    },
  };
}
