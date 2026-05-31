import { expect, test } from 'vitest';
import { SYSTEM_PROMPT } from './prompts';

test('SYSTEM_PROMPT is correctly defined', () => {
  expect(typeof SYSTEM_PROMPT).toBe('string');
  expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
});
