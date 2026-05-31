import { expect, test, beforeAll } from 'vitest';
import { inview } from './inview';

beforeAll(() => {
  window.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
});

test('inview action initializes and destroys without errors', () => {
  const el = document.createElement('div');
  const action = inview(el);
  expect(action.destroy).toBeDefined();

  if (action.destroy) {
    action.destroy();
  }
});
