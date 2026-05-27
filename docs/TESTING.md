# Testing Guide

This repository is configured with a comprehensive testing suite to ensure the stability, accessibility, and visual integrity of the application.

## 1. Unit & Component Testing (Vitest)

We use **Vitest** along with the **Svelte Testing Library** to test individual components and isolated utility functions.

- **Run unit tests:**
  ```bash
  npm run test:unit
  ```
- **Where to put tests:** Place your `.spec.ts` or `.test.ts` files in the `src/` directory, usually right next to the component they are testing (e.g., `src/components/ThemeToggle.spec.ts`).

## 2. End-to-End (E2E) Testing (Playwright)

We use **Playwright** to test full user flows in the browser exactly as a real user would experience them. Our Playwright setup also includes accessibility and visual regression testing.

- **Run E2E tests:**
  ```bash
  npm run test:e2e
  ```
- **Run in UI Mode (Recommended):** Opens a visual interface to debug and trace tests step-by-step.
  ```bash
  npm run test:e2e:ui
  ```
- **Where to put tests:** Place your E2E tests in the `tests/e2e/` directory.

### Accessibility Testing (Axe)

Playwright is configured with `@axe-core/playwright` to automatically scan pages for accessibility violations (like missing alt text, poor contrast, or incorrect ARIA roles).

_Example usage in a test:_

```typescript
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);
```

### Visual Regression Testing

Playwright takes screenshots of components or pages and compares them against "baseline" images saved in the repository to ensure CSS changes don't accidentally break the layout.

- **Update baselines:** If you intentionally change the UI and a visual test fails, you need to update the baseline screenshots by running:
  ```bash
  npm run test:e2e -- --update-snapshots
  ```

_(Note: Baseline images are stored in `tests/e2e/_-snapshots/`and should be committed to version control. The`playwright-report`and`test-results` folders are ignored by git).\*
