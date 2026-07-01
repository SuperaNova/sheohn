import {
  getToolName,
  isToolUIPart,
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';

/**
 * Playwright's `request` fixture buffers the full response body as text
 * rather than exposing a streaming body, so this wraps that text back into
 * a single-chunk ReadableStream to feed the AI SDK's own SSE parsing —
 * the same pipeline DefaultChatTransport uses for real streaming responses.
 */
export async function parseAgentResponse(sseText: string): Promise<UIMessage> {
  const bytes = new TextEncoder().encode(sseText);
  const rawStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  const chunkStream: ReadableStream<UIMessageChunk> = parseJsonEventStream({
    stream: rawStream,
    schema: uiMessageChunkSchema,
  }).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        if (!chunk.success) {
          throw chunk.error;
        }
        controller.enqueue(chunk.value);
      },
    }),
  );

  let finalMessage: UIMessage | undefined;
  for await (const message of readUIMessageStream({ stream: chunkStream })) {
    finalMessage = message;
  }

  if (!finalMessage) {
    throw new Error(
      'parseAgentResponse: no UIMessage chunks were parsed from the SSE response',
    );
  }

  return finalMessage;
}

export function findToolPart(message: UIMessage, toolName: string) {
  return message.parts.find(
    (part) => isToolUIPart(part) && getToolName(part) === toolName,
  );
}

export function hasAnyToolCall(message: UIMessage): boolean {
  return message.parts.some((part) => isToolUIPart(part));
}

export function getRagFacts(message: UIMessage): string[] {
  const part = findToolPart(message, 'query_jared_memory');
  if (!part || !('output' in part)) {
    return [];
  }
  const output = (part as { output?: unknown }).output;
  return Array.isArray(output) ? output.map(String) : [];
}
