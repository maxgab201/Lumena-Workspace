import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const includeLiveE2E = process.env.LUMENA_LIVE_E2E === '1';
const includePerfE2E = process.env.LUMENA_PERF_E2E === '1';
const defaultIgnores = [
  '**/unit/**',
  ...(!includeLiveE2E
    ? ['**/live-*.spec.ts', '**/staging*.spec.ts', '**/production-*.spec.ts']
    : []),
  ...(!includePerfE2E ? ['**/processing.spec.ts'] : []),
];

export default defineConfig({
  timeout: 60000,
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  testIgnore: defaultIgnores,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});