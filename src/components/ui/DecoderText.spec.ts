import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import DecoderText from './DecoderText.svelte';

test('renders the decoder text container', () => {
  // @ts-expect-error - Svelte 5 component type mismatch with testing-library
  render(DecoderText, { text: 'Test Initial Render', delay: 0 });

  // The text renders in two layers: a stable sr-only accessible name and the
  // visible, aria-hidden span that carries the scramble animation. Scope the
  // query to the visible layer (the one with `inline-block`).
  const textElement = screen.getByText('Test Initial Render', {
    selector: '.inline-block',
  });
  expect(textElement).toBeInTheDocument();
  expect(textElement).toHaveClass('inline-block');

  // Assistive tech still gets the resolved text exactly once.
  const srOnly = screen.getByText('Test Initial Render', {
    selector: '.sr-only',
  });
  expect(srOnly).toBeInTheDocument();
});
