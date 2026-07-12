import { test, expect } from './fixtures/auth.fixture';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Document Management UI', () => {
  // Use sequential mode so we can clean up easily if we want to
  test.describe.configure({ mode: 'serial' });

  test('Upload, Rename, and Delete PDF', async ({ page }) => {
    let documents: any[] = [];
    
    // Mock Insert/Update/Delete/Get Document
    await page.route('**/rest/v1/documents*', async route => {
      const method = route.request().method();
      if (method === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(documents) });
      } else if (method === 'POST') {
        const newDoc = { id: 'doc-1', name: 'small-native.pdf', status: 'ready', created_at: new Date().toISOString(), size_bytes: 1024, file_path: 'ws-1/test.pdf' };
        documents = [newDoc];
        route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(newDoc) });
      } else if (method === 'PATCH') {
        if (documents.length > 0) documents[0].name = 'renamed-document.pdf';
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(documents[0]) });
      } else if (method === 'DELETE') {
        documents = [];
        route.fulfill({ status: 204 });
      } else {
        route.continue();
      }
    });

    // Mock Upload Storage
    await page.route('**/storage/v1/object/workspace_documents**', route => {
      route.fulfill({ status: 200, body: JSON.stringify({ Key: 'workspace_documents/test.pdf' }) });
    });

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    // We rely on the auth fixture
    await page.goto('/dashboard');
    // Dump HTML to debug
    const html = await page.content();
    fs.writeFileSync('debug-html.html', html);

    // Wait for the upload zone to be visible
    await expect(page.locator('text=Click to upload or drag and drop')).toBeVisible({ timeout: 15000 });
    
    // Take Screenshot of Empty State
    await page.screenshot({ path: 'artifacts/desktop-empty-state.png' });

    // 1. Upload PDF
    const filename = 'small-native.pdf';
    const filePath = path.resolve(process.cwd(), 'tests', 'fixtures', filename);
    
    await page.locator('input[type="file"]').setInputFiles(filePath);

    // Wait for the upload to complete
    await expect(page.getByText(filename).first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'artifacts/desktop-uploaded.png' });

    // 2. Rename Document
    await page.getByText(filename).first().hover();
    await page.getByRole('button', { name: 'More options' }).first().click();
    
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') await dialog.accept('renamed-document.pdf');
      if (dialog.type() === 'confirm') await dialog.accept();
    });

    await page.getByText('Rename').click();
    await expect(page.getByText('renamed-document.pdf').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'artifacts/desktop-renamed.png' });

    // 3. Delete Document
    await page.getByText('renamed-document.pdf').first().hover();
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Delete').click();
    await expect(page.getByText('renamed-document.pdf').first()).toBeHidden({ timeout: 15000 });
    await page.screenshot({ path: 'artifacts/desktop-deleted.png' });
  });
});
