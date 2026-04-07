import 'dotenv/config';
import { POST } from '../src/pages/api/chat.ts';

async function test() {
  try {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is Jareds stack?' }],
      }),
    });
    const res = await POST({ request: req } as any);
    if (!res) {
      console.log('No response returned!');
      return;
    }
    console.log('Status:', res.status);
    console.log('Done');
  } catch (err) {
    console.log('CAUGHT ERROR IN HANDLER:');
    console.error(err);
  }
}
test();
