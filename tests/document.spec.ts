import { test, expect } from '../fixtures/console-errors.fixture';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Document Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock workspaces
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

    // Mock documents
    await page.route('**/rest/v1/documents*', async (route) => {
      const mockDoc = {
        id: 'doc-1',
        workspace_id: 'workspace-1',
        name: 'small-native.pdf',
        file_path: 'workspace-1/test.pdf',
        size_bytes: 1024,
        status: 'ready',
        mime_type: 'application/pdf',
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

    // Mock storage
    await page.route('**/storage/v1/object/sign/**', async (route) => {
      await route.fulfill({
        status: 200,
        json: { signedURL: '/mock.pdf', signedUrl: '/mock.pdf' }
      });
    });

    await page.route('**/mock.pdf', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: fs.readFileSync(path.resolve(process.cwd(), 'tests', 'fixtures', 'small-native.pdf'))
      });
    });

    // Mock processing jobs
    await page.route('**/rest/v1/processing_jobs*', async (route) => {
      await route.fulfill({
        status: 200,
        json: [{ id: 'job-1', document_id: 'doc-1', status: 'completed', progress: 100 }]
      });
    });

    await page.route('**/functions/v1/**', async (route) => {
      await route.fulfill({ status: 200, json: { success: true } });
    });
  });

  test('Upload, Rename, and Delete PDF', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for upload zone
    await expect(page.locator('text="Click to upload or drag and drop"')).toBeVisible({ timeout: 15000 });

    // Upload PDF
    const filename = 'small-native.pdf';
    const filePath = path.resolve(process.cwd(), 'tests', 'fixtures', filename);

    await page.locator('input[type="file"]').setInputFiles(filePath);

    await expect(page.getByText(filename).first()).toBeVisible({ timeout: 30000 });

    // Rename Document
    await page.getByText(filename).first().hover();
    await page.getByRole('button', { name: 'Rename' }).first().click();

    await page.fill('input[type="text"]', 'renamed-document.pdf');
    await page.click('button:has-text("Confirm")');

    await expect(page.getByText('renamed-document.pdf').first()).toBeVisible({ timeout: 15000 });

    // Delete Document
    await page.getByText('renamed-document.pdf').first().hover();
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByText('renamed-document.pdf').first()).toBeHidden({ timeout: 15000 });
  });
});