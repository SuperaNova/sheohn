import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import DecoderText from './DecoderText.svelte';

test('renders the decoder text container', () => {
  // @ts-expect-error - Svelte 5 component type mismatch with testing-library
  render(DecoderText, { text: 'Test Initial Render', delay: 0 });

  const textElement = screen.getByText('Test Initial Render');
  expect(textElement).toBeInTheDocument();
  expect(textElement).toHaveClass('inline-block');
});
