import { test, expect } from '@playwright/test';

const BASE = 'https://lumena-workspace.vercel.app';
const EMAIL = process.env.LUMENA_QA_EMAIL;
const PASSWORD = process.env.LUMENA_QA_PASSWORD;
const DOC_URL = `${BASE}/viewer/9c95cbe6-9e4b-45e8-a9ca-e6b1508d1a6a`;
const KNOWN_SECONDARY_ERRORS = ['PGRST205', 'public.presentations', '404'];

test('checkpoint2 production reading flow', async ({ page, browserName }) => {
  test.skip(!EMAIL || !PASSWORD, 'Production QA credentials are required.');
  test.skip(browserName !== 'chromium', 'Chromium-focused production flow.');

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${BASE}/auth`);
  await page.getByLabel('Email Address').fill(EMAIL!);
  await page.getByLabel('Password').fill(PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await page.goto(DOC_URL);
  await expect(page.getByText('checkpoint-second.pdf').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('[data-pdf-page-wrapper]').first()).toBeVisible({ timeout: 30000 });
  await page.keyboard.press('a');
  await expect(page.getByTestId('annotations-sidebar')).toBeVisible();
  await expect(page.getByTestId('highlight-editor')).toBeHidden();
  const criticalErrors = errors.filter(error =>
    !KNOWN_SECONDARY_ERRORS.some(match => error.includes(match))
  );
  expect(criticalErrors).toEqual([]);
});

