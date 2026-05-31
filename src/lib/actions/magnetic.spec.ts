import { expect, test, beforeAll } from 'vitest';
import { magnetic } from './magnetic';

beforeAll(() => {
  // Mock matchMedia for testing environment
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
    }),
  });
});

test('magnetic action initializes and destroys without errors', () => {
  const el = document.createElement('div');
  const action = magnetic(el);

  if (action && action.destroy) {
    expect(action.destroy).toBeDefined();
    action.destroy();
  }
});
