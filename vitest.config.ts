import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,svelte}'],
      exclude: [
        'src/**/*.spec.{ts,js}',
        'src/**/*.test.{ts,js}',
        'src/env.d.ts',
        'src/pages/**',
        'src/content.config.ts',
      ],
      // Thresholds are intentionally conservative — they're a floor, not a goal.
      // Ratchet up as the unit-test suite grows.
      thresholds: {
        lines: 10,
        statements: 10,
        functions: 10,
        branches: 50,
      },
    },
  },
  resolve: {
    conditions: ['browser'],
  },
});
