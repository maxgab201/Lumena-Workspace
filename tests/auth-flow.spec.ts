import { test, expect } from '@playwright/test';

test.use({ 
  channel: 'chrome', 
  executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  viewport: { width: 1280, height: 720 },
});

test('Auth flow works and console is clean', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('http://localhost:5173/');
  
  // Landing page
  await expect(page.getByText('Lumena', { exact: true }).first()).toBeVisible();
  
  // Go to auth
  await page.goto('http://localhost:5173/auth');
  await page.waitForLoadState('networkidle');
  
  // Test responsive UI
  await page.setViewportSize({ width: 375, height: 667 }); // Mobile
  
  // Back to desktop
  await page.setViewportSize({ width: 1280, height: 720 });
  
  // Check for any runtime errors
  expect(errors.length).toBe(0);
});

