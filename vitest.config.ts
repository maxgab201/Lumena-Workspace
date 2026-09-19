import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Enforced in CI. These values are the audited 2026-09 baseline;
      // raising them requires adding tests, while regressions fail immediately.
      thresholds: {
        lines: 48,
        functions: 41,
        branches: 31,
        statements: 46,
      },
    },
  },
});