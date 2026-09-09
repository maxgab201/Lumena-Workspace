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
    await page.route('**/storage/v1/object/sign/**', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          signedURL: '/mock.pdf',
          signedUrl: '/mock.pdf'
        }
      });
    });

    await page.context().route('**/storage/v1/mock.pdf', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: fs.readFileSync(path.resolve(process.cwd(), 'tests', 'fixtures', 'medium-native.pdf'))
      });
    });
  });

  test('Viewer loads and renders PDF with virtualization', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/viewer/test-doc-1');

    await expect(page.locator('text=Large-Document-500-pages.pdf').first()).toBeVisible({ timeout: 10000 });

    await page.setViewportSize({ width: 1281, height: 721 });
    await page.setViewportSize({ width: 1280, height: 720 });

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

    const pageContainer = page.locator('.pdf-page').first();
    await expect(pageContainer).toBeVisible({ timeout: 10000 });

    const renderedPages = await page.locator('.pdf-page').count();
    expect(renderedPages).toBeGreaterThan(0);
    expect(renderedPages).toBeLessThan(10);

    const zoomInBtn = page.locator('button[aria-label="Zoom in"]');
    await zoomInBtn.click();
    await zoomInBtn.click();
    await expect(page.locator('text=150%')).toBeVisible();

    const rotateBtn = page.locator('button[aria-label="Rotate clockwise"]');
    await rotateBtn.click();

    await page.locator('button[aria-label="Next page"]').click();
    await expect(page.locator('text=/ 100')).toBeVisible();

    await expect(page.locator('button[aria-label="Toggle developer overlays"]')).toHaveCount(0);
    await expect(page.locator('button[aria-label="Search in document"]')).toHaveCount(0);
    await expect(page.getByTestId('toggle-chat-btn')).toBeVisible();
    await expect(page.getByTestId('toggle-knowledge-btn')).toBeVisible();

    await expect(page.locator('div[data-layer="annotation"]').first()).toBeAttached();

    await expect(page.locator('input[aria-label="Current page"]')).toHaveValue('2');

    expect(errors.length).toBe(0);
  });
});
