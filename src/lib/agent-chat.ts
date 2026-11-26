import { Chat } from '@ai-sdk/svelte';
import { DefaultChatTransport } from 'ai';

export interface AgentChatOptions {
  onToolCall: (event: { toolCall: unknown }) => void;
  onError: (error: Error) => void;
}

// Statically imported here and dynamically imported by the deck, so the SDK and zod stay out of
// the deck chunk and still tree-shake (a dynamic import of the packages themselves would not).
export async function createAgentChat(
  options: AgentChatOptions,
): Promise<Chat> {
  return new Chat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onToolCall: ({ toolCall }) => options.onToolCall({ toolCall }),
    onError: options.onError,
  });
}
