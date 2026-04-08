/**
 * Test Script on the api before i integrate site working part
 * Usage: npx tsx scripts/test-chat.ts
 * Make sure `npm run dev` is running first (on port 4321).
 */
import 'dotenv/config';

const API_URL = 'http://localhost:4321/api/chat';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function testChat(label: string, messages: any[]) {
  console.log(`\n→ [${label}] Sending ${messages.length} message(s)\n`);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      id: 'test-session-001',
    }),
  });

  console.log('Status:', res.status);

  if (!res.ok) {
    const err = await res.text();
    console.error('Error response:', err.slice(0, 500));
    return;
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    console.error('No response body!');
    return;
  }

  console.log('Streaming response');
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    process.stdout.write(chunk);
  }

  console.log('\nStream complete');
  console.log(`Bytes received: ${fullText.length}`);
}

// Test 1: Single turn
testChat('single turn', [
  { role: 'user', content: 'What is Jareds tech stack?' },
])
  // Test 2: Multi-turn simulation
  .then(() =>
    testChat('multi turn', [
      { role: 'user', content: 'hello' },
      {
        role: 'assistant',
        parts: [
          { type: 'step-start' },
          { type: 'text', text: 'Hey. Query away.', state: 'done' },
        ],
      },
      { role: 'user', content: 'who are you?' },
    ]),
  )
  .catch(console.error);
