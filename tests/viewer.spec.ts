import { test, expect } from '@playwright/test';

test.describe('PDF Viewer (Mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase Auth Session
    await page.route('**/auth/v1/session', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            access_token: 'fake-access-token',
            user: { id: 'test-user-id', email: 'test@example.com' }
          }
        })
      });
    });

    await page.route('**/rest/v1/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        json: [{
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          created_at: new Date().toISOString()
        }]
      });
    });

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

    // Mock the document response
    await page.route('**/rest/v1/documents*', async (route) => {
      await route.fulfill({
        status: 200,
        json: [{
          id: 'test-doc-1',
          workspace_id: 'workspace-1',
          name: 'Large-Document-500-pages.pdf',
          file_path: 'test-user-id/workspace-1/Large-Document-500-pages.pdf',
          size_bytes: 25 * 1024 * 1024,
          status: 'ready',
          created_at: new Date().toISOString()
        }]
      });
    });
    
    // Mock the storage signed URL
    await page.route('**/storage/v1/object/sign/documents*', async (route) => {
      await route.fulfill({
        status: 200,
        json: { signedURL: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' }
      });
    });

    // Bypass auth using localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('sb-nsjetmjtwbhellqasggw-auth-token', JSON.stringify({
        access_token: 'fake-access-token',
        refresh_token: 'fake-refresh-token',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: { id: 'test-user-id', email: 'test@example.com', aud: 'authenticated', role: 'authenticated' }
      }));
    });
  });

  test('Viewer loads and renders PDF with virtualization', async ({ page }) => {
    // Go directly to the viewer page
    await page.goto('/viewer/test-doc-1');

    // Wait for the document title to appear in the toolbar
    await expect(page.locator('text=Large-Document-500-pages.pdf')).toBeVisible({ timeout: 10000 });

    // Wait for the PDF.js canvas to render
    const canvas = page.locator('.react-pdf__Page__canvas').first();
    await expect(canvas).toBeVisible({ timeout: 30000 });

    // Verify virtualization: there should only be a few pages rendered in the DOM, not the full document
    const canvases = await page.locator('.react-pdf__Page__canvas').count();
    expect(canvases).toBeLessThan(10); // TanStack virtualizer renders visible + overscan (e.g. 2+2=4 or so)
    expect(canvases).toBeGreaterThan(0);

    // Zoom in
    const zoomInBtn = page.locator('button[aria-label="Zoom in"]');
    await zoomInBtn.click();
    await zoomInBtn.click();
    
    // Verify scale increased (check toolbar text)
    await expect(page.locator('text=150%')).toBeVisible();

    // Rotate
    const rotateBtn = page.locator('button[aria-label="Rotate clockwise"]');
    await rotateBtn.click();

    // The canvas style should reflect rotation
    await expect(canvas).toHaveCSS('transform', /matrix/);
    
    // Scroll and navigate
    const nextBtn = page.locator('button[aria-label="Next page"]');
    await nextBtn.click();
    
    // The current page input should show 2
    await expect(page.locator('input[aria-label="Current page"]')).toHaveValue('2');
  });
});
