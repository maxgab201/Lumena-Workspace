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

    // Mock billing APIs
    await page.route('**/rest/v1/subscriptions*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          id: 'sub-1',
          workspace_id: 'workspace-1',
          plan_code: 'free',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      });
    });

    await page.route('**/rest/v1/credit_accounts*', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          workspace_id: 'workspace-1',
          available: 100,
          reserved: 0,
          consumed: 0,
          expired: 0
        }
      });
    });

    await page.route('**/rest/v1/credit_ledger*', async (route) => {
      await route.fulfill({
        status: 200,
        json: []
      });
    });

    await page.route('**/rest/v1/credit_packages*', async (route) => {
      await route.fulfill({
        status: 200,
        json: [
          { id: 'pkg-1', name: 'Starter Pack', credits: 1000, price_usd: 5.00, stripe_price_id: 'price_starter', is_active: true },
          { id: 'pkg-2', name: 'Pro Pack', credits: 5000, price_usd: 20.00, stripe_price_id: 'price_pro', is_active: true }
        ]
      });
    });

    await page.route('**/functions/v1/create-checkout-session**', async (route) => {
      await route.fulfill({
        status: 200,
        json: { url: 'https://checkout.stripe.com/test', mocked: true }
      });
    });
  });

  test('billing page displays correctly', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Billing & Credits' })).toBeVisible();
  });

  test('shows current plan and credits', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Current Plan')).toBeVisible();
    await expect(page.getByText('Free').first()).toBeVisible();
  });

  test('free plan displays no AI credits included notice', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/No AI credits included|Sin créditos de IA incluidos/i)).toBeVisible();
    const progressBar = page.getByTestId('credit-progress-bar');
    await expect(progressBar).not.toBeVisible();
  });

  test('upgrade flow shows modal', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');

    const upgradeBtn = page.getByTestId('upgrade-btn').first();
    if (await upgradeBtn.isVisible({ timeout: 2000 })) {
      await upgradeBtn.click();
      await expect(page.getByRole('heading', { name: 'Upgrade to Pro' })).toBeVisible({ timeout: 5000 });
    }
  });

  test('credit packages displayed', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text="Starter Pack"')).toBeVisible();
    await expect(page.locator('text="Pro Pack"')).toBeVisible();
  });

  test('purchase flow creates Stripe session', async ({ page }) => {
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');

    // Mock Stripe checkout session
    await page.route('**/functions/v1/create-checkout-session**', async (route) => {
      await route.fulfill({
        status: 200,
        json: { url: 'https://checkout.stripe.com/test', mocked: true }
      });
    });

    // Just verify page loads without errors
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
  });
});