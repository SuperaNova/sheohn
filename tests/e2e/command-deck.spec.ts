import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// Covers the deck's keyboard-driven flows. The agent endpoint is mocked (see mockAgent) so the
// suite is deterministic and never touches Gemini/Upstash.

// AI SDK UI message stream wire format; the reply includes a markdown link to assert the
// linkifier renders a real anchor.
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

// The deck is a `client:idle` island: before hydration Enter would fall through to a native
// submit. Poll until the panel opens, then reset to a closed state.
async function waitForDeck(page: Page) {
  await expect(deckInput(page)).toBeVisible();

  // toPass() retries until hydration finishes; a suggestion chip only renders when expanded.
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
    // Focus isn't asserted: programmatic focus() is a no-op in a headless, unfocused document,
    // which would flake without signaling a regression.

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
    // Focus (not click): the keyboard-only entry point.
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

    for (const [i, prompt] of prompts.entries()) {
      await deckInput(page).fill(prompt);
      await deckInput(page).press('Enter');
      // The guest message and a fresh reply land before the next send, proving the queue drains in order.
      await expect(deck(page).getByText(prompt)).toBeVisible();
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

    await expect(
      deck(page).getByRole('button', { name: 'show me his resume' }),
    ).toBeVisible();
  });
});
