import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Measure EVERY source file. By default Vitest 4 only reports the files a test
      // happens to import, which made the previous baseline (~48% lines, measured over
      // 14 of 140 files) look about three times better than the real coverage.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [...coverageConfigDefaults.exclude, 'src/types/supabase.ts', 'src/main.tsx'],
      // Enforced in CI. Floors of the audited 2026-09-30 whole-`src` baseline: they only
      // ratchet up. Raising them requires adding tests; regressions fail immediately.
      thresholds: {
        lines: 19,
        functions: 12,
        branches: 13,
        statements: 18,
      },
    },
  },
});
