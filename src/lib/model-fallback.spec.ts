import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { withModelFallbacks } from './model-fallback';

type Model = Parameters<typeof withModelFallbacks>[0][number];
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

describe('withModelFallbacks', () => {
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

    const model = withModelFallbacks([primary, fallback], {
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

    const model = withModelFallbacks([primary, fallback], {
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

    const model = withModelFallbacks([primary, fallback], {
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

    const model = withModelFallbacks([primary, fallback], {
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

    const model = withModelFallbacks([primary, fallback], {
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

    const model = withModelFallbacks([primary, fallback], {
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

    const model = withModelFallbacks([primary, fallback], {
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

    const model = withModelFallbacks([primary, fallback], {
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

    const model = withModelFallbacks([primary, fallback], {
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

    const model = withModelFallbacks([primary, fallback], {
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

    const model = withModelFallbacks([primary, fallback], {
      firstChunkTimeoutMs: 8000,
    });

    await expect(
      model.doStream(callOptions(controller.signal)),
    ).rejects.toThrow('aborted');
    expect(fallback.doStream).not.toHaveBeenCalled();
  });

  describe('three-model chain', () => {
    const okStream = (text: string) => async () => ({
      stream: streamOf([textPart(text)]),
    });
    const failing = (message: string) => async () => {
      throw new Error(message);
    };

    test('uses the first model and reports no fallback', async () => {
      const onFallback = vi.fn();
      const [a, b, c] = [
        mockModel('a', okStream('a')),
        mockModel('b', okStream('b')),
        mockModel('c', okStream('c')),
      ] as [Model, Model, Model];

      const model = withModelFallbacks([a, b, c], {
        firstChunkTimeoutMs: 6000,
        onFallback,
      });
      const { stream } = await model.doStream(callOptions());

      expect(await collect(stream)).toEqual([textPart('a')]);
      expect(b.doStream).not.toHaveBeenCalled();
      expect(c.doStream).not.toHaveBeenCalled();
      expect(onFallback).not.toHaveBeenCalled();
    });

    test('moves to the second model when the first hangs', async () => {
      const onFallback = vi.fn();
      const a = mockModel('a', hangUntilAborted);
      const b = mockModel('b', okStream('b'));
      const c = mockModel('c', okStream('c'));

      const model = withModelFallbacks([a, b, c], {
        firstChunkTimeoutMs: 6000,
        onFallback,
      });
      const pending = model.doStream(callOptions());
      await vi.advanceTimersByTimeAsync(6000);
      const { stream } = await pending;

      expect(await collect(stream)).toEqual([textPart('b')]);
      expect(c.doStream).not.toHaveBeenCalled();
      expect(onFallback.mock.calls).toEqual([['b']]);
    });

    test('reaches the third model when the first throws and the second hangs', async () => {
      const onFallback = vi.fn();
      const a = mockModel('a', failing('503'));
      const b = mockModel('b', hangUntilAborted);
      const c = mockModel('c', okStream('c'));

      const model = withModelFallbacks([a, b, c], {
        firstChunkTimeoutMs: 6000,
        onFallback,
      });
      const pending = model.doStream(callOptions());
      await vi.advanceTimersByTimeAsync(6000);
      const { stream } = await pending;

      expect(await collect(stream)).toEqual([textPart('c')]);
      expect(onFallback.mock.calls).toEqual([['b'], ['c']]);
    });

    test('reaches the third model when both earlier ones hang', async () => {
      const onFallback = vi.fn();
      const a = mockModel('a', hangUntilAborted);
      const b = mockModel('b', hangUntilAborted);
      const c = mockModel('c', okStream('c'));

      const model = withModelFallbacks([a, b, c], {
        firstChunkTimeoutMs: 6000,
        onFallback,
      });
      const pending = model.doStream(callOptions());
      await vi.advanceTimersByTimeAsync(12_000);
      const { stream } = await pending;

      expect(await collect(stream)).toEqual([textPart('c')]);
      expect(onFallback.mock.calls).toEqual([['b'], ['c']]);
    });

    test('propagates the last error when every model fails', async () => {
      const onFallback = vi.fn();
      const model = withModelFallbacks(
        [
          mockModel('a', failing('a down')),
          mockModel('b', failing('b down')),
          mockModel('c', failing('c down')),
        ],
        { firstChunkTimeoutMs: 6000, onFallback },
      );

      await expect(model.doStream(callOptions())).rejects.toThrow('c down');
      expect(onFallback.mock.calls).toEqual([['b'], ['c']]);
    });

    test('stops the chain when the caller aborts', async () => {
      const controller = new AbortController();
      const a = mockModel('a', async () => {
        controller.abort();
        throw new Error('aborted');
      });
      const b = mockModel('b', okStream('b'));
      const c = mockModel('c', okStream('c'));
      const onFallback = vi.fn();

      const model = withModelFallbacks([a, b, c], {
        firstChunkTimeoutMs: 6000,
        onFallback,
      });

      await expect(
        model.doStream(callOptions(controller.signal)),
      ).rejects.toThrow('aborted');
      expect(b.doStream).not.toHaveBeenCalled();
      expect(c.doStream).not.toHaveBeenCalled();
      expect(onFallback).not.toHaveBeenCalled();
    });

    test('gives the last model no first-chunk timeout', async () => {
      const a = mockModel('a', failing('a down'));
      const b = mockModel('b', failing('b down'));
      const c = mockModel('c', () => {
        return new Promise<{ stream: ReadableStream<Part> }>((resolve) =>
          setTimeout(
            () => resolve({ stream: streamOf([textPart('c')]) }),
            20_000,
          ),
        );
      });

      const model = withModelFallbacks([a, b, c], {
        firstChunkTimeoutMs: 6000,
      });
      const pending = model.doStream(callOptions());
      await vi.advanceTimersByTimeAsync(20_000);
      const { stream } = await pending;

      expect(await collect(stream)).toEqual([textPart('c')]);
    });

    test('doGenerate walks the same chain', async () => {
      const onFallback = vi.fn();
      const generateResult = { content: [] };
      const a = mockModel('a', okStream('a'));
      const b = mockModel('b', okStream('b'));
      const c = mockModel('c', okStream('c'));
      vi.mocked(a.doGenerate).mockRejectedValue(new Error('a down'));
      vi.mocked(b.doGenerate).mockRejectedValue(new Error('b down'));
      vi.mocked(c.doGenerate).mockResolvedValue(
        generateResult as unknown as Awaited<ReturnType<Model['doGenerate']>>,
      );

      const model = withModelFallbacks([a, b, c], {
        firstChunkTimeoutMs: 6000,
        onFallback,
      });

      expect(await model.doGenerate({ prompt: [] })).toBe(generateResult);
      expect(onFallback.mock.calls).toEqual([['b'], ['c']]);
    });

    test('later calls on the same wrapper start at the model that worked', async () => {
      const onFallback = vi.fn();
      const a = mockModel('a', hangUntilAborted);
      const b = mockModel('b', okStream('b'));
      const c = mockModel('c', okStream('c'));

      const model = withModelFallbacks([a, b, c], {
        firstChunkTimeoutMs: 6000,
        onFallback,
      });
      const first = model.doStream(callOptions());
      await vi.advanceTimersByTimeAsync(6000);
      await collect((await first).stream);
      const { stream } = await model.doStream(callOptions());

      expect(await collect(stream)).toEqual([textPart('b')]);
      expect(a.doStream).toHaveBeenCalledTimes(1);
      expect(b.doStream).toHaveBeenCalledTimes(2);
      expect(onFallback.mock.calls).toEqual([['b']]);
    });

    test('a new wrapper starts from the first model again', async () => {
      const a = mockModel('a', hangUntilAborted);
      const b = mockModel('b', okStream('b'));
      const options = { firstChunkTimeoutMs: 6000 };

      const used = withModelFallbacks([a, b], options);
      const pending = used.doStream(callOptions());
      await vi.advanceTimersByTimeAsync(6000);
      await pending;

      const fresh = withModelFallbacks([a, b], options);
      const next = fresh.doStream(callOptions());
      await vi.advanceTimersByTimeAsync(6000);
      await next;

      expect(a.doStream).toHaveBeenCalledTimes(2);
    });
  });
});
