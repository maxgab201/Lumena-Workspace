import { test, expect } from './fixtures/auth.fixture';

test.describe('Billing System', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the documents and workspaces to avoid errors during layout loading
    await page.route('**/rest/v1/workspaces*', async (route) => {
      await route.fulfill({
        status: 200,
        json: [{
          id: 'workspace-1',
          name: 'Personal Workspace',
          owner_id: 'test-user-id'
        }]
      });
    });
  });

  test('billing page displays correctly, can open upgrade modal, and simulates upgrade', async ({ page }) => {
    // Go to billing page
    await page.goto('/billing');

    // Verify header and current plan
    await expect(page.locator('h1')).toContainText('Billing & Credits');
    await expect(page.locator('text="Current Plan:"')).toBeVisible();
    await expect(page.locator('text="Free"').first()).toBeVisible();

    // Verify credit progress bar exists (it might have 0 width so we check if attached)
    const progressBar = page.getByTestId('credit-progress-bar');
    await expect(progressBar).toBeAttached();

    // Open upgrade modal
    const upgradeBtn = page.getByTestId('upgrade-btn');
    await expect(upgradeBtn).toBeVisible();
    await upgradeBtn.click();

    // Verify modal appears
    const modal = page.getByTestId('upgrade-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Upgrade to Pro');
    await expect(modal).toContainText('$15/mo');

    // Confirm upgrade
    const confirmBtn = page.getByTestId('confirm-upgrade-btn');
    await confirmBtn.click();

    // Wait for the simulated async process
    await expect(confirmBtn).toContainText('Processing Payment...');
    await expect(modal).toContainText('Upgrade Successful!', { timeout: 5000 });

    // The modal auto-closes after 2s, wait for it to be hidden
    await expect(modal).toBeHidden({ timeout: 5000 });

    // Verify the main page now shows Pro
    await expect(page.locator('text="Current Plan:"')).toBeVisible();
    await expect(page.locator('text="Pro"').first()).toBeVisible();
  });
});
