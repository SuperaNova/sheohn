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
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.{ts,js}',
        'src/**/*.test.{ts,js}',
        'src/env.d.ts',
        'src/pages/**',
        'src/content.config.ts',
      ],
      // Thresholds are a regression floor, not a goal.
      thresholds: {
        lines: 30,
        statements: 30,
        functions: 30,
        branches: 30,
      },
    },
  },
  resolve: {
    conditions: ['browser'],
  },
});
