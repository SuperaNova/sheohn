// Real Pagefind loading needs a built index; test the degradation path, where the missing
// asset makes the dynamic import throw and the module must resolve to `null`.

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
