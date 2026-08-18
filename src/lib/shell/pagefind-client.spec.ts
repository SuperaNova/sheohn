// Real Pagefind loading requires an actual built index and a browser-like
// dynamic `import()` of a runtime-only static path — not meaningfully
// unit-testable in jsdom without a real production build present. What IS
// testable in isolation, and is the behavior that matters most for the
// shell's UX, is the graceful-degradation path: under `npm run test:unit`
// (jsdom, no real `/pagefind/pagefind.js` asset anywhere on disk), the
// dynamic import 404s/throws, and this module must swallow that and resolve
// to `null` rather than rejecting or throwing synchronously.

import { describe, expect, test } from 'vitest';
import { loadPagefind, search } from './pagefind-client';

describe('pagefind-client graceful degradation (no real index present)', () => {
  test('loadPagefind resolves to null instead of throwing', async () => {
    await expect(loadPagefind()).resolves.toBeNull();
  });

  test('loadPagefind caches the null result across calls (imports only once)', async () => {
    const first = await loadPagefind();
    const second = await loadPagefind();
    expect(first).toBeNull();
    expect(second).toBeNull();
  });

  test('search resolves to null (not an empty array, not a throw) when the index is unavailable', async () => {
    await expect(search('anything')).resolves.toBeNull();
  });
});
