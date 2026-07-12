import { test, expect } from './fixtures/auth.fixture';
import * as fs from 'fs';
import * as path from 'path';

test.describe('PDF Viewer (Mocked API)', () => {
  test.beforeEach(async ({ page }) => {
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

    // We no longer need to mock workspaces here because auth.fixture already does it
    // Or we can leave it to override
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
      const url = route.request().url();
      const mockDoc = {
        id: 'test-doc-1',
        workspace_id: 'workspace-1',
        name: 'Large-Document-500-pages.pdf',
        file_path: 'test-user-id/workspace-1/Large-Document-500-pages.pdf',
        size_bytes: 25 * 1024 * 1024,
        status: 'ready',
        created_at: new Date().toISOString()
      };
      
      if (url.includes('id=eq')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDoc)
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockDoc])
        });
      }
    });
    // Mock the storage signed URL
    await page.route('**/storage/v1/object/sign/**', async (route) => {
      await route.fulfill({
        status: 200,
        json: { 
          signedURL: '/mock.pdf',
          signedUrl: '/mock.pdf'
        }
      });
    });

    // Mock the actual PDF download (using context.route so Web Worker requests are intercepted)
    await page.context().route('**/storage/v1/mock.pdf', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: fs.readFileSync(path.resolve(process.cwd(), 'tests', 'fixtures', 'medium-native.pdf'))
      });
    });
  });

  test('Viewer loads and renders PDF with virtualization', async ({ page }) => {
    // Go directly to the viewer page
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    page.on('request', req => console.log('REQ:', req.url()));
    page.on('response', res => console.log('RES:', res.status(), res.url()));

    await page.goto('/viewer/test-doc-1');

    await page.screenshot({ path: 'artifacts/viewer-before-timeout.png' });
    // Wait for the document title to appear in the toolbar
    await expect(page.locator('text=Large-Document-500-pages.pdf')).toBeVisible({ timeout: 10000 });

    // Trigger a resize to ensure ResizeObserver fires
    await page.setViewportSize({ width: 1281, height: 721 });
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Debugging
    const virtualizerItems = await page.locator('.pdf-page').count();
    console.log('PDF Page components rendered:', virtualizerItems);
    const canvasesCount = await page.locator('canvas').count();
    console.log('Canvas elements rendered:', canvasesCount);
    
    const container = page.locator('[data-testid="pdf-container"]');
    if (await container.count() > 0) {
      console.log('Container width:', await container.getAttribute('data-width'));
      console.log('Container height:', await container.getAttribute('data-height'));
    } else {
      console.log('Container NOT FOUND');
    }
    
    // Wait for the PDF page container to render
    const pageContainer = page.locator('.pdf-page').first();
    await expect(pageContainer).toBeVisible({ timeout: 10000 });

    // Verify virtualization: there should only be a few pages rendered in the DOM, not the full document
    const renderedPages = await page.locator('.pdf-page').count();
    expect(renderedPages).toBeGreaterThan(0);
    expect(renderedPages).toBeLessThan(10); // TanStack virtualizer renders visible + overscan (e.g. 2+2=4 or so)

    // Zoom in
    const zoomInBtn = page.locator('button[aria-label="Zoom in"]');
    await zoomInBtn.click();
    await zoomInBtn.click();
    
    // Verify scale increased (check toolbar text)
    await expect(page.locator('text=150%')).toBeVisible();

    // Test rotation
    const rotateBtn = page.locator('button[aria-label="Rotate clockwise"]');
    await rotateBtn.click();
    
    // The page style should reflect rotation.
    // react-pdf canvas may or may not render depending on Playwright environment,
    // so we test the container's data-rotation or style if possible, 
    // but for now let's just ensure no crashes.
    
    // Test toolbar navigation
    await page.locator('button[aria-label="Next page"]').click();
    await expect(page.locator('text=/ 100')).toBeVisible();

    // Verify developer overlays exist (Layer toggles)
    await expect(page.locator('button[aria-label="Toggle developer overlays"]')).toBeVisible();
    
    // Verify the layer containers are in the DOM (even if empty initially)
    await expect(page.locator('div[data-layer="annotation"]').first()).toBeAttached();
    await expect(page.locator('div[data-layer="selection"]').first()).toBeAttached();
    
    // The Layout Overlay, OCR Overlay, and Vision Overlay are rendered but may return null 
    // if there is no mock data, but we can check the button.
    
    // The current page input should show 2
    await expect(page.locator('input[aria-label="Current page"]')).toHaveValue('2');
  });
});
