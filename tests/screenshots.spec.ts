import { test } from '@playwright/test';

test('Capture Before Screenshots', async ({ page }) => {
  test.setTimeout(120000);
  // Capture Auth
  await page.goto('http://localhost:5173/auth');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'artifacts/after-auth.png', fullPage: true });

  // Capture Landing
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'artifacts/after-landing.png', fullPage: true });

  // Mock Auth Session to capture internal pages
  await page.goto('http://localhost:5173/auth');
  await page.evaluate(() => {
    localStorage.setItem('sb-supabase-auth-token', JSON.stringify({
      access_token: 'mock-token',
      user: { id: 'test-user', email: 'test@example.com' }
    }));
  });

  // Capture Dashboard
  await page.goto('http://localhost:5173/dashboard');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'artifacts/after-dashboard.png', fullPage: true });

  // Capture Settings
  await page.goto('http://localhost:5173/settings');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'artifacts/after-settings.png', fullPage: true });

  // Capture Billing
  await page.goto('http://localhost:5173/billing');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'artifacts/after-billing.png', fullPage: true });
});
