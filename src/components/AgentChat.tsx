/* eslint-disable @typescript-eslint/no-explicit-any */
import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { usePortfolioStore } from '../store';

export default function AgentChat() {
  const chatHelpers = useChat({
    // @ts-expect-error version mismatch
    api: '/api/chat',
    // Hook into tool calls on the client side to update UI
    onToolCall: ({ toolCall }: any) => {
      if (toolCall.toolName === 'trigger_ui_state') {
        const focus = toolCall.args?.focus || toolCall.arguments?.focus;
        console.log(`AI triggered UI focus on: ${focus}`);

        // UPDATE ZUSTAND HERE:
        usePortfolioStore.getState().setFocus(focus);
      }
    },
  }) as any;

  const { messages, input, setInput, append } = chatHelpers;

  const [isMinimized, setIsMinimized] = useState(true);

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
        {messages?.map?.((m: any) => (
          <div
            key={m.id}
            className={m.role === 'user' ? 'text-green-400' : 'text-gray-300'}
          >
            <strong>{m.role === 'user' ? 'GUEST: ' : 'SYSTEM: '}</strong>
            {m.content}

            {/* Displaying Tool Executions (Optional but cool) */}
            {m.toolInvocations?.map((tool: any) => (
              <span
                key={tool.toolCallId}
                className="mt-1 block text-xs text-yellow-500/70"
              >
                {'>'} executing: {tool.toolName}(
                {JSON.stringify(tool.args || (tool as any).arguments)})
              </span>
            ))}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          append({ role: 'user', content: input });
          setInput('');
        }}
        className="flex rounded border border-gray-800 bg-black"
      >
        <input
          className="flex-1 bg-transparent p-2 font-mono text-sm text-white focus:outline-none"
          value={input}
          placeholder="> query agent..."
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="p-2 text-green-500 hover:text-white">
          ↵
        </button>
      </form>
    </div>
  );
}
