import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// The command deck is the spine of the site: a docked bar that runs deterministic
// `/`-commands offline and proxies free text to the AI agent. These tests cover
// the keyboard-driven flows a visitor actually uses. The agent endpoint is
// mocked (see mockAgent) so the suite is deterministic, free, and CI-safe — it
// never touches Gemini/Upstash.

// Mirror of the AI SDK UI message stream wire format (captured from a real
// /api/chat response). Each event is a `data: {json}` line, double-newline
// separated. The reply includes a markdown link so we can assert the deck's
// safe linkifier turns it into a real anchor.
const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
const RESUME_LINK = 'https://sheohn.dev/resume.pdf';
const MOCK_REPLY_BODY =
  sse({ type: 'start' }) +
  sse({ type: 'start-step' }) +
  sse({ type: 'text-start', id: '0' }) +
  sse({ type: 'text-delta', id: '0', delta: "Opening Jared's resume. " }) +
  sse({
    type: 'text-delta',
    id: '0',
    delta: `[Click here to view resume](${RESUME_LINK})`,
  }) +
  sse({ type: 'text-end', id: '0' }) +
  sse({ type: 'finish-step' }) +
  sse({ type: 'finish' }) +
  'data: [DONE]\n\n';

async function mockAgent(page: Page) {
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'x-vercel-ai-ui-message-stream': 'v1',
        'cache-control': 'no-cache',
      },
      body: MOCK_REPLY_BODY,
    });
  });
}

const deckInput = (page: Page) =>
  page.locator('input[aria-label^="Command deck"]');
const deck = (page: Page) => page.locator('aside[aria-label="Command Deck"]');

// The deck is a `client:idle` island, so on a freshly loaded page its handlers
// aren't attached yet — focusing the input before hydration does nothing, and
// pressing Enter would fall through to a native submit. Poll focus until the
// panel actually opens (proof the island is interactive), then reset to a
// clean, closed state for the test body.
async function waitForDeck(page: Page) {
  await expect(deckInput(page)).toBeVisible();

  // Use toPass() to retry interactions until hydration finishes.
  // We look for a suggestion chip button because it's only rendered when expanded,
  // bypassing any Svelte 5 multiline text node regex matching bugs.
  await expect(async () => {
    await deckInput(page).blur();
    await deckInput(page).focus();
    await expect(
      deck(page).getByRole('button', { name: /show me his resume/i }),
    ).toBeVisible();
  }).toPass({ timeout: 15000 });

  await page.keyboard.press('Escape');
  await expect(
    deck(page).getByRole('button', { name: /show me his resume/i }),
  ).toBeHidden();
}

test.describe('Command deck', () => {
  test('opens with Ctrl+K and closes with Escape', async ({ page }) => {
    await page.goto('/');
    await waitForDeck(page);

    await page.keyboard.press('Control+k');
    await expect(
      deck(page).getByRole('button', { name: /show me his resume/i }),
    ).toBeVisible();
    // (The handler also focuses the input so a keyboard user can type right
    // away — verified manually. We don't assert focus here because the app's
    // programmatic element.focus() is a no-op in a headless, system-unfocused
    // document, which would make the assertion flaky without reflecting a real
    // regression.)

    await page.keyboard.press('Escape');
    await expect(
      deck(page).getByRole('button', { name: /show me his resume/i }),
    ).toBeHidden();
  });

  test('runs a slash-command to navigate (offline, no agent)', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForDeck(page);
    await deckInput(page).fill('/about');
    await deckInput(page).press('Enter');

    await page.waitForURL('**/about');
    await expect(page.getByRole('heading', { name: 'About Me' })).toBeVisible();
  });

  test('keyboard-navigates the recommended chips with ←/→', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForDeck(page);
    // Focus (not click) — focus is the keyboard-only entry point this whole
    // feature is about.
    await deckInput(page).focus();

    const current = deck(page).locator('button[aria-current="true"]');

    await deckInput(page).press('ArrowRight');
    await expect(current).toHaveText('show me what he built');
    await deckInput(page).press('ArrowRight');
    await expect(current).toHaveText('show me his resume');
    await deckInput(page).press('ArrowLeft');
    await expect(current).toHaveText('show me what he built');

    await deckInput(page).press('ArrowDown');
    await expect(current).toHaveText('show me his resume');
  });

  test('Enter on a highlighted chip sends it and renders the reply', async ({
    page,
  }) => {
    await mockAgent(page);
    await page.goto('/');
    await waitForDeck(page);
    await deckInput(page).focus();

    await deckInput(page).press('ArrowRight');
    await deckInput(page).press('Enter');

    // The agent's markdown link is rendered as a real, safe anchor.
    const link = deck(page).getByRole('link', {
      name: 'Click here to view resume',
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', RESUME_LINK);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('typed free-text question gets an agent reply', async ({ page }) => {
    await mockAgent(page);
    await page.goto('/');
    await waitForDeck(page);

    await deckInput(page).fill('What is his tech stack?');
    await deckInput(page).press('Enter');

    await expect(deck(page).getByText('What is his tech stack?')).toBeVisible();
    await expect(deck(page).getByText(/Opening Jared's resume/i)).toBeVisible();
  });

  test('walks through the common prompts visitors type', async ({ page }) => {
    await mockAgent(page);
    await page.goto('/');

    const prompts = [
      'What has he built?',
      'What is his tech stack?',
      'Is he available for opportunities?',
      'How do I get in touch?',
    ];

    await waitForDeck(page);

    const replyLink = deck(page).getByRole('link', {
      name: 'Click here to view resume',
    });

    for (let i = 0; i < prompts.length; i++) {
      await deckInput(page).fill(prompts[i]);
      await deckInput(page).press('Enter');
      // The guest message lands and a fresh reply (with its link) renders before
      // we send the next one — this also proves the queue drains in order.
      await expect(deck(page).getByText(prompts[i])).toBeVisible();
      await expect(replyLink).toHaveCount(i + 1);
    }
  });

  test('persists recommended chips after a conversation starts', async ({
    page,
  }) => {
    await mockAgent(page);
    await page.goto('/');
    await waitForDeck(page);

    await deckInput(page).fill('What has he built?');
    await deckInput(page).press('Enter');
    await expect(deck(page).getByText(/Opening Jared's resume/i)).toBeVisible();

    // Chips are still reachable in the footer after chatting.
    await expect(
      deck(page).getByRole('button', { name: 'show me his resume' }),
    ).toBeVisible();
  });
});
