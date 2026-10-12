import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { withModelFallback } from './model-fallback';

type Model = Parameters<typeof withModelFallback>[0];
type CallOptions = Parameters<Model['doStream']>[0];
type Part =
  Awaited<ReturnType<Model['doStream']>> extends {
    stream: ReadableStream<infer P>;
  }
    ? P
    : never;

const textPart = (delta: string) =>
  ({ type: 'text-delta', id: '1', delta }) as Part;

const callOptions = (abortSignal?: AbortSignal): CallOptions =>
  ({ prompt: [], abortSignal }) as CallOptions;

function streamOf(parts: Part[], failAfter?: Error): ReadableStream<Part> {
  let index = 0;
  return new ReadableStream<Part>({
    pull(controller) {
      if (index < parts.length) controller.enqueue(parts[index++]);
      else if (failAfter) controller.error(failAfter);
      else controller.close();
    },
  });
}

function mockModel(
  modelId: string,
  doStream: (options: CallOptions) => Promise<{ stream: ReadableStream<Part> }>,
): Model {
  return {
    specificationVersion: 'v3',
    provider: 'mock',
    modelId,
    supportedUrls: {},
    doGenerate: vi.fn(),
    doStream: vi.fn(doStream),
  } as unknown as Model;
}

async function collect(stream: ReadableStream<Part>): Promise<Part[]> {
  const parts: Part[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return parts;
    parts.push(value);
  }
}

const hangUntilAborted = (options: CallOptions) =>
  new Promise<{ stream: ReadableStream<Part> }>((_, reject) => {
    options.abortSignal?.addEventListener('abort', () =>
      reject(new Error('aborted')),
    );
  });

describe('withModelFallback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('forwards the primary output when it succeeds', async () => {
    const onFallback = vi.fn();
    const primary = mockModel('primary', async () => ({
      stream: streamOf([textPart('a'), textPart('b')]),
    }));
    const fallback = mockModel('fallback', async () => ({
      stream: streamOf([textPart('x')]),
    }));

    const model = withModelFallback(primary, fallback, {
      firstChunkTimeoutMs: 8000,
      onFallback,
    });
    const { stream } = await model.doStream(callOptions());

    expect(await collect(stream)).toEqual([textPart('a'), textPart('b')]);
    expect(fallback.doStream).not.toHaveBeenCalled();
    expect(onFallback).not.toHaveBeenCalled();
  });

  test('falls back when the primary throws before streaming', async () => {
    const onFallback = vi.fn();
    const primary = mockModel('primary', async () => {
      throw new Error('503 high demand');
    });
    const fallback = mockModel('fallback', async () => ({
      stream: streamOf([textPart('x')]),
    }));

    const model = withModelFallback(primary, fallback, {
      firstChunkTimeoutMs: 8000,
      onFallback,
    });
    const { stream } = await model.doStream(callOptions());

    expect(await collect(stream)).toEqual([textPart('x')]);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  test('falls back when the first chunk is an error part', async () => {
    const primary = mockModel('primary', async () => ({
      stream: streamOf([{ type: 'error', error: new Error('overloaded') }]),
    }));
    const fallback = mockModel('fallback', async () => ({
      stream: streamOf([textPart('x')]),
    }));

    const model = withModelFallback(primary, fallback, {
      firstChunkTimeoutMs: 8000,
    });
    const { stream } = await model.doStream(callOptions());

    expect(await collect(stream)).toEqual([textPart('x')]);
  });

  test('aborts a silent primary at the timeout and uses the fallback', async () => {
    const onFallback = vi.fn();
    let primarySignal: AbortSignal | undefined;
    const primary = mockModel('primary', (options) => {
      primarySignal = options.abortSignal;
      return hangUntilAborted(options);
    });
    const fallback = mockModel('fallback', async () => ({
      stream: streamOf([textPart('x')]),
    }));

    const model = withModelFallback(primary, fallback, {
      firstChunkTimeoutMs: 8000,
      onFallback,
    });
    const pending = model.doStream(callOptions());
    await vi.advanceTimersByTimeAsync(8000);
    const { stream } = await pending;

    expect(primarySignal?.aborted).toBe(true);
    expect(await collect(stream)).toEqual([textPart('x')]);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  test('falls back when the stream starts but stalls before any content', async () => {
    let primarySignal: AbortSignal | undefined;
    const primary = mockModel('primary', async (options) => {
      primarySignal = options.abortSignal;
      return {
        stream: new ReadableStream<Part>({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            options.abortSignal?.addEventListener('abort', () =>
              controller.error(new Error('aborted')),
            );
          },
        }),
      };
    });
    const fallback = mockModel('fallback', async () => ({
      stream: streamOf([textPart('x')]),
    }));

    const model = withModelFallback(primary, fallback, {
      firstChunkTimeoutMs: 8000,
    });
    const pending = model.doStream(callOptions());
    await vi.advanceTimersByTimeAsync(8000);
    const { stream } = await pending;

    expect(primarySignal?.aborted).toBe(true);
    expect(await collect(stream)).toEqual([textPart('x')]);
  });

  test('replays stream-start and response-metadata ahead of the first content chunk', async () => {
    const parts = [
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'r1' },
      textPart('a'),
      textPart('b'),
    ] as Part[];
    const primary = mockModel('primary', async () => ({
      stream: streamOf(parts),
    }));
    const fallback = mockModel('fallback', async () => ({
      stream: streamOf([textPart('x')]),
    }));

    const model = withModelFallback(primary, fallback, {
      firstChunkTimeoutMs: 8000,
    });
    const { stream } = await model.doStream(callOptions());

    expect(await collect(stream)).toEqual(parts);
    expect(fallback.doStream).not.toHaveBeenCalled();
  });

  test('treats a stream that ends before any content as success', async () => {
    const parts = [{ type: 'stream-start', warnings: [] }] as Part[];
    const primary = mockModel('primary', async () => ({
      stream: streamOf(parts),
    }));
    const fallback = mockModel('fallback', async () => ({
      stream: streamOf([textPart('x')]),
    }));

    const model = withModelFallback(primary, fallback, {
      firstChunkTimeoutMs: 8000,
    });
    const { stream } = await model.doStream(callOptions());

    expect(await collect(stream)).toEqual(parts);
    expect(fallback.doStream).not.toHaveBeenCalled();
  });

  test('does not time out once the first chunk has arrived', async () => {
    const primary = mockModel('primary', async () => ({
      stream: streamOf([textPart('a')]),
    }));
    const fallback = mockModel('fallback', async () => ({
      stream: streamOf([textPart('x')]),
    }));

    const model = withModelFallback(primary, fallback, {
      firstChunkTimeoutMs: 8000,
    });
    const { stream } = await model.doStream(callOptions());
    await vi.advanceTimersByTimeAsync(20_000);

    expect(await collect(stream)).toEqual([textPart('a')]);
    expect(fallback.doStream).not.toHaveBeenCalled();
  });

  test('propagates a primary failure after the first chunk without falling back', async () => {
    const primary = mockModel('primary', async () => ({
      stream: streamOf([textPart('a')], new Error('stream broke')),
    }));
    const fallback = mockModel('fallback', async () => ({
      stream: streamOf([textPart('x')]),
    }));

    const model = withModelFallback(primary, fallback, {
      firstChunkTimeoutMs: 8000,
    });
    const { stream } = await model.doStream(callOptions());

    await expect(collect(stream)).rejects.toThrow('stream broke');
    expect(fallback.doStream).not.toHaveBeenCalled();
  });

  test('propagates the error when the fallback also fails', async () => {
    const primary = mockModel('primary', async () => {
      throw new Error('primary down');
    });
    const fallback = mockModel('fallback', async () => {
      throw new Error('fallback down');
    });

    const model = withModelFallback(primary, fallback, {
      firstChunkTimeoutMs: 8000,
    });

    await expect(model.doStream(callOptions())).rejects.toThrow(
      'fallback down',
    );
  });

  test('does not fall back when the caller aborted the request', async () => {
    const controller = new AbortController();
    const primary = mockModel('primary', async () => {
      controller.abort();
      throw new Error('aborted');
    });
    const fallback = mockModel('fallback', async () => ({
      stream: streamOf([textPart('x')]),
    }));

    const model = withModelFallback(primary, fallback, {
      firstChunkTimeoutMs: 8000,
    });

    await expect(
      model.doStream(callOptions(controller.signal)),
    ).rejects.toThrow('aborted');
    expect(fallback.doStream).not.toHaveBeenCalled();
  });
});
