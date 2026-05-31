import { expect, test } from 'vitest';
import { starters } from './starters';

test('starters data is structured correctly', () => {
  expect(Array.isArray(starters)).toBe(true);
  expect(starters.length).toBeGreaterThan(0);

  const firstStarter = starters[0];
  expect(firstStarter).toHaveProperty('label');
  expect(firstStarter).toHaveProperty('q');
});
