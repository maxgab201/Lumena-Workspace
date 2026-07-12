import { test, expect } from './fixtures/auth.fixture';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Highlights', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the documents response
    await page.route('**/rest/v1/documents*', async (route) => {
      const mockDoc = {
        id: 'test-doc-1',
        workspace_id: 'workspace-1',
        name: 'Medium-Document.pdf',
        file_path: 'test-user-id/workspace-1/Medium-Document.pdf',
        size_bytes: 2 * 1024 * 1024,
        status: 'ready',
        created_at: new Date().toISOString()
      };
      const url = route.request().url();
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

    // Mock the actual PDF download
    await page.context().route('**/storage/v1/mock.pdf', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: fs.readFileSync(path.resolve(process.cwd(), 'tests', 'fixtures', 'medium-native.pdf'))
      });
    });
    
    // We also need to mock workspaces like auth.fixture
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

  test('can create and view highlights', async ({ page }) => {
    await page.goto('/viewer/test-doc-1');

    // Wait for the document title to appear in the toolbar
    await expect(page.locator('text="Medium-Document.pdf"').first()).toBeVisible({ timeout: 15000 });

    // Wait for PDF to load and text layer to be visible
    await page.waitForSelector('.react-pdf__Page__textContent', { state: 'visible', timeout: 30000 });

    // Inject a fake text selection inside the PDF text layer to trigger the highlight editor
    await page.evaluate(() => {
      const pageEl = document.querySelector('[data-page-index="0"]');
      const textLayer = pageEl?.querySelector('.react-pdf__Page__textContent');
      if (pageEl && textLayer) {
        // Create a fake range spanning the text layer
        const range = document.createRange();
        range.selectNodeContents(textLayer);
        
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        // Dispatch mouseup to trigger the editor
        document.dispatchEvent(new MouseEvent('mouseup'));
      }
    });

    // Verify the highlight editor appears
    const editor = page.locator('[data-highlight-editor]');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Click the first category button
    const categoryButton = editor.locator('button').first();
    await categoryButton.click();

    // The editor should disappear
    await expect(editor).toBeHidden();

    // The highlight overlay should now render the highlight
    const highlightOverlay = page.locator('[data-layer="highlight"]');
    await expect(highlightOverlay).toBeVisible();

    // The highlight rectangle should be inside it
    const highlightRect = highlightOverlay.locator('.cursor-pointer');
    await expect(highlightRect.first()).toBeVisible();
  });
});
