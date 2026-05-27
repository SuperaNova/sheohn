import { render, screen } from '@testing-library/svelte';
import ThemeToggle from './ThemeToggle.svelte';
import { expect, test } from 'vitest';

test('renders the theme toggle button', () => {
  render(ThemeToggle);
  
  const button = screen.getByRole('button', { name: /Toggle color theme/i });
  expect(button).toBeInTheDocument();
});
