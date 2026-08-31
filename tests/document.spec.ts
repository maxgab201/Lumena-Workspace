import { test, expect } from './fixtures/auth.fixture';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Document Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    let documents: any[] = [];

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

    // Supabase Storage uses distinct endpoints for upload (with object path)
    // and removal (the bucket endpoint without a trailing path).
    await page.route('**/storage/v1/object/workspace_documents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.route('**/storage/v1/object/workspace_documents/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ Key: 'workspace_documents/test.pdf' })
      });
    });

    // Mock documents stateful REST
    await page.route('**/rest/v1/documents*', async (route) => {
      const method = route.request().method();
      const url = route.request().url();

      if (method === 'POST') {
        const postData = route.request().postDataJSON() || {};
        const newDoc = {
          id: 'doc-1',
          workspace_id: 'workspace-1',
          name: postData.name || 'small-native.pdf',
          file_path: postData.file_path || 'workspace-1/small-native.pdf',
          size_bytes: postData.size_bytes || 1024,
          status: 'ready',
          mime_type: 'application/pdf',
          created_at: new Date().toISOString(),
          ...postData,
        };
        documents.push(newDoc);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newDoc)
        });
      } else if (method === 'PATCH') {
        const patchData = route.request().postDataJSON() || {};
        if (documents.length > 0) {
          documents[0] = { ...documents[0], ...patchData };
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(documents[0] || {})
        });
      } else if (method === 'DELETE') {
        documents = [];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      } else {
        // GET
        if (url.includes('id=eq')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(documents[0] || null)
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(documents)
          });
        }
      }
    });

    // Mock storage sign
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
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'job-1', document_id: 'doc-1', status: 'ready', progress: 100 })
        });
      } else {
        await route.fulfill({
          status: 200,
          json: [{ id: 'job-1', document_id: 'doc-1', status: 'ready', progress: 100 }]
        });
      }
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

    // Verify document appears
    await expect(page.getByText(filename).first()).toBeVisible({ timeout: 30000 });

    // Rename Document via action dropdown + prompt dialog
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('renamed-document.pdf');
    });

    await page.getByTestId('doc-actions-btn').first().click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();

    await expect(page.getByText('renamed-document.pdf').first()).toBeVisible({ timeout: 15000 });

    // Delete Document via action dropdown + confirm dialog
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    await page.getByTestId('doc-actions-btn').first().click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    await expect(page.getByTitle('renamed-document.pdf')).toBeHidden({ timeout: 15000 });
  });
});
