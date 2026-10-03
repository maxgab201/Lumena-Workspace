import { test, expect } from './fixtures/auth.fixture';
import * as fs from 'fs';
import * as path from 'path';
import { MAX_CANVAS_PIXELS_HIGH_DPR } from '../src/lib/canvasBudget';

test.describe('PDF viewer high-DPR memory budget', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });

  test.beforeEach(async ({ page }) => {
    const pdfBytes = fs.readFileSync(path.resolve(process.cwd(), 'tests', 'fixtures', 'large-900p.pdf'));

    await page.route('**/rest/v1/**', route => route.fulfill({ status: 200, json: [] }));
    await page.route('**/functions/v1/**', route => route.fulfill({ status: 200, json: {} }));
    await page.route('**/rest/v1/profiles*', route => route.fulfill({
      status: 200,
      json: { id: 'mock-user-id', email: 'test@lumena.app', name: 'Test User' },
    }));
    await page.route('**/rest/v1/workspaces*', route => route.fulfill({
      status: 200,
      json: [{ id: 'ws-1', name: 'Test Workspace', owner_id: 'mock-user-id' }],
    }));
    await page.route('**/rest/v1/documents*', route => route.fulfill({
      status: 200,
      json: {
        id: 'test-doc-900',
        workspace_id: 'ws-1',
        name: 'large-900p.pdf',
        file_path: 'mock-user/ws-1/large-900p.pdf',
        size_bytes: pdfBytes.length,
        status: 'ready',
        page_count: 900,
        mime_type: 'application/pdf',
        created_at: new Date().toISOString(),
      },
    }));
    await page.route('**/rest/v1/chat_sessions*', route => route.fulfill({
      status: 200,
      json: {
        id: 'session-900',
        document_id: 'test-doc-900',
        workspace_id: 'ws-1',
        user_id: 'mock-user-id',
        created_at: new Date().toISOString(),
      },
    }));
    await page.route('**/rest/v1/chat_messages*', route => route.fulfill({ status: 200, json: [] }));
    await page.route('**/storage/v1/object/sign/**', route => route.fulfill({
      status: 200,
      json: { signedURL: '/mock.pdf', signedUrl: '/mock.pdf' },
    }));
    await page.context().route('**/storage/v1/mock.pdf', route => route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: pdfBytes,
    }));
  });

  test('keeps a 900-page Reader alive through 500% zoom, fast scroll, and repeated rotation', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('/viewer/test-doc-900');
    await expect(page.locator('.pdf-page canvas').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('input[aria-label="Current page"]')).toBeVisible();

    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    for (let index = 0; index < 16; index += 1) {
      await zoomIn.click({ timeout: 15000 });
    }
    await expect(page.getByText('500%', { exact: true })).toBeVisible();

    const readCanvasBudget = () => page.evaluate(() => {
      const pixels = [...document.querySelectorAll('canvas')].map(canvas => canvas.width * canvas.height);
      return {
        pages: document.querySelectorAll('.pdf-page').length,
        canvases: pixels.length,
        totalPixels: pixels.reduce((total, value) => total + value, 0),
        maxCanvasPixels: Math.max(0, ...pixels),
      };
    });

    await page.waitForTimeout(500);
    let budget = await readCanvasBudget();
    expect(budget.maxCanvasPixels).toBeLessThanOrEqual(MAX_CANVAS_PIXELS_HIGH_DPR * 1.001);
    expect(budget.totalPixels).toBeLessThanOrEqual(MAX_CANVAS_PIXELS_HIGH_DPR * 2);

    await page.evaluate(() => {
      const scrollArea = document.querySelector('[data-testid="pdf-container"] .overflow-auto');
      if (!scrollArea) return;
      for (const fraction of [0.1, 0.7, 0.95, 0.4, 1, 0.05, 0.99]) {
        scrollArea.scrollTop = (scrollArea.scrollHeight - scrollArea.clientHeight) * fraction;
      }
    });
    await page.waitForTimeout(700);
    budget = await readCanvasBudget();
    expect(budget.pages).toBeLessThanOrEqual(2);
    expect(budget.maxCanvasPixels).toBeLessThanOrEqual(MAX_CANVAS_PIXELS_HIGH_DPR * 1.001);
    expect(budget.totalPixels).toBeLessThanOrEqual(MAX_CANVAS_PIXELS_HIGH_DPR * 2);

    const rotate = page.getByRole('button', { name: 'Rotate clockwise' });
    for (let index = 0; index < 4; index += 1) {
      await rotate.click({ timeout: 15000 });
    }
    await page.waitForTimeout(700);
    budget = await readCanvasBudget();
    expect(budget.maxCanvasPixels).toBeLessThanOrEqual(MAX_CANVAS_PIXELS_HIGH_DPR * 1.001);
    expect(budget.totalPixels).toBeLessThanOrEqual(MAX_CANVAS_PIXELS_HIGH_DPR * 2);
    expect(pageErrors).toEqual([]);
  });
});
