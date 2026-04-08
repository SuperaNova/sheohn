/* eslint-disable @typescript-eslint/no-explicit-any */
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { usePortfolioStore } from '../store';

export default function AgentChat() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onToolCall: ({ toolCall }: any) => {
      if (toolCall.toolName === 'trigger_ui_state') {
        const focus = toolCall.args?.focus ?? toolCall.arguments?.focus;
        console.log(`AI triggered UI focus on: ${focus}`);
        usePortfolioStore.getState().setFocus(focus);
      }
    },
    onError: (err: any) => {
      console.error('[AgentChat] error:', err);
    },
  } as any);

  const [isMinimized, setIsMinimized] = useState(true);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: trimmed }],
    } as any);
    setInput('');
  };

  const isLoading = status === 'streaming' || status === 'submitted';

  if (isMinimized) {
    return (
      <div
        data-cursor-green="true"
        className="fixed right-4 bottom-4 z-[999] flex cursor-pointer items-center gap-2 rounded-full border border-gray-800 bg-black/90 px-4 py-2 font-mono text-xs text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] backdrop-blur-md transition-all hover:bg-black/100"
        onClick={() => setIsMinimized(false)}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
        [ + ] SYSTEM AGENT
      </div>
    );
  }

  return (
    <div
      data-cursor-green="true"
      className="fixed right-4 bottom-4 z-[999] w-96 rounded-xl border border-gray-800 bg-black/90 p-4 shadow-2xl backdrop-blur-md"
    >
      <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-2">
        <span className="flex items-center gap-2 font-mono text-xs text-green-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
          AGENT INTERFACE
          {isLoading && (
            <span className="animate-pulse opacity-60">· thinking</span>
          )}
        </span>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-gray-500 transition-colors hover:text-white"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="mb-4 h-64 space-y-2 overflow-y-auto pr-2 font-mono text-sm">
        {messages?.length === 0 && (
          <p className="pt-20 text-center text-xs text-gray-600">
            [ awaiting query ]
          </p>
        )}
        {messages?.map?.((m: any) => {
          // Get text content from parts array (new SDK format) or fallback
          const textContent = m.parts
            ? m.parts
                .filter((p: any) => p.type === 'text')
                .map((p: any) => p.text)
                .join('')
            : m.content;

          return (
            <div
              key={m.id}
              className={m.role === 'user' ? 'text-green-400' : 'text-gray-300'}
            >
              <strong>{m.role === 'user' ? 'GUEST: ' : 'SYSTEM: '}</strong>
              {textContent}

              {/* Tool executions */}
              {m.parts
                ?.filter((p: any) => p.type === 'tool-invocation')
                .map((p: any) => (
                  <span
                    key={p.toolInvocation?.toolCallId}
                    className="mt-1 block text-xs text-yellow-500/70"
                  >
                    {'>'} {p.toolInvocation?.toolName}(
                    {JSON.stringify(p.toolInvocation?.args)})
                  </span>
                ))}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex rounded border border-gray-800 bg-black"
      >
        <input
          className="flex-1 bg-transparent p-2 font-mono text-sm text-white focus:outline-none"
          value={input}
          placeholder="> query agent..."
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2 text-green-500 transition-colors hover:text-white disabled:opacity-30"
        >
          ↵
        </button>
      </form>
    </div>
  );
}
