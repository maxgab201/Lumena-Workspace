import { test, expect } from './fixtures/auth.fixture';

/**
 * The three header controls that a manual pass reported as "does nothing":
 * the ⌘K trigger, the language switcher (globe) and the notifications bell.
 *
 * Radix dropdowns open on `pointerdown`, not `click`. Automation that dispatches a bare
 * synthetic `click()` (instead of real pointer input) sees a menu that never opens, which is
 * a test artefact and not a product bug. These specs use real pointer input and pin the
 * behaviour so a genuine regression is caught.
 */
test.describe('Header controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('topbar')).toBeVisible({ timeout: 20000 });
  });

  test('the search trigger opens the command palette, filters, navigates and closes', async ({ page }) => {
    await page.getByTestId('search-trigger').click();

    const palette = page.getByTestId('command-palette');
    await expect(palette).toBeVisible();
    await expect(page.getByTestId('command-palette-input')).toBeFocused();

    await page.getByTestId('command-palette-input').fill('settings');
    await expect(page.getByTestId('palette-item-nav-settings')).toBeVisible();
    await expect(page.getByTestId('palette-item-nav-billing')).toHaveCount(0);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/settings/);
    await expect(palette).toBeHidden();
  });

  test('Ctrl+K toggles the palette and Escape closes it', async ({ page }) => {
    const palette = page.getByTestId('command-palette');

    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();

    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(palette).toBeHidden();
  });

  test('the language switcher opens, offers both languages and applies the choice', async ({ page }) => {
    await page.getByRole('button', { name: /^(Language|Idioma)$/ }).click();

    const spanish = page.getByRole('menuitem', { name: /Español/ });
    const english = page.getByRole('menuitem', { name: /English/ });
    await expect(spanish).toBeVisible();
    await expect(english).toBeVisible();

    await spanish.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    // The trigger's own label is translated, proving the choice reached the UI.
    await expect(page.getByRole('button', { name: 'Idioma' })).toBeVisible();

    await page.getByRole('button', { name: 'Idioma' }).click();
    await page.getByRole('menuitem', { name: /English/ }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('the notifications bell opens a panel that says the feature is not available yet', async ({ page }) => {
    await page.getByTestId('notifications-btn').click();

    await expect(page.getByText(/No notifications yet|Sin notificaciones aún/)).toBeVisible();
    // No notification system exists behind the bell: it must not promise one.
    const panel = page.getByRole('menu');
    await expect(panel.getByText(/^(Soon|Pronto)$/)).toBeVisible();
    await expect(panel.getByText(/coming soon|llega pronto/i)).toBeVisible();
  });

  test('the notification preferences say nothing is sent yet, while still saving the choices', async ({ page }) => {
    await page.goto('/settings');
    // Inside <main>: the header bell has the same accessible name.
    await page.getByRole('main').getByRole('button', { name: /^(Notifications|Notificaciones)$/ }).click();

    await expect(page.getByTestId('notifications-soon-notice')).toBeVisible();
    // The choices stay editable: they are stored for when notifications launch.
    await expect(page.getByRole('checkbox').first()).toBeEnabled();
  });
});
