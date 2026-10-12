import {
  request as playwrightRequest,
  type APIRequestContext,
} from '@playwright/test';
import { test as base, expect } from '../e2e/fixtures';

const BYPASS_HEADER = 'x-vercel-protection-bypass';

/** Headers that get a request past Vercel Deployment Protection; empty when no secret is set. */
export function bypassHeaders(): Record<string, string> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return secret ? { [BYPASS_HEADER]: secret } : {};
}

/**
 * `api` sends the bypass header on every request. It is not set via config-level
 * extraHTTPHeaders because that would also reach third-party hosts from the browser
 * and trigger CORS preflights.
 */
export const test = base.extend<{ api: APIRequestContext }>({
  api: async ({ baseURL }, use) => {
    const context = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: bypassHeaders(),
    });
    await use(context);
    await context.dispose();
  },
});

export { expect };
