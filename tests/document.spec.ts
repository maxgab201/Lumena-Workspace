import { test, expect } from '@playwright/test';

test.describe('Document Management UI (Mocked API)', () => {
  test('Upload, Rename, and Delete PDF', async ({ page }) => {
    // 1. Mock Supabase Auth Session
    await page.route('**/auth/v1/session', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            access_token: 'mock-token',
            user: { id: 'mock-user-id', email: 'test@lumena.app' }
          }
        })
      });
    });

    // Mock Get Workspaces
    await page.route('**/rest/v1/workspaces?select=*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'ws-1', name: 'Test Workspace' }])
      });
    });

    let documents: any[] = [];
    
    // Mock Insert/Update/Delete/Get Document
    await page.route('**/rest/v1/documents*', async route => {
      const method = route.request().method();
      if (method === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(documents) });
      } else if (method === 'POST') {
        const newDoc = { id: 'doc-1', name: 'dummy.pdf', status: 'ready', created_at: new Date().toISOString(), size_bytes: 1024, file_path: 'ws-1/test.pdf' };
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

    // Inject mock session directly to localStorage so app thinks we are logged in
    await page.goto('http://localhost:5173/auth'); // Go to a page to set origin
    await page.evaluate(() => {
      localStorage.setItem('sb-nsjetmjtwbhellqasggw-auth-token', JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: { id: 'mock-user-id', email: 'test@lumena.app', aud: 'authenticated', role: 'authenticated' }
      }));
    });

    // 2. Navigate to Dashboard
    await page.goto('http://localhost:5173/dashboard');
    // Wait for the upload zone to be visible
    await expect(page.locator('text=Click to upload or drag and drop')).toBeVisible({ timeout: 15000 });
    
    // Take Screenshot of Empty State
    await page.screenshot({ path: 'artifacts/desktop-empty-state.png' });

    // Mock Upload Storage
    await page.route('**/storage/v1/object/workspace_documents**', route => {
      route.fulfill({ status: 200, body: JSON.stringify({ Key: 'workspace_documents/test.pdf' }) });
    });

    // 3. Upload PDF
    await page.setInputFiles('input[type="file"]', 'dummy.pdf');

    // Wait for the upload to complete
    await expect(page.getByText('dummy.pdf').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'artifacts/desktop-uploaded.png' });

    // Mock Rename Document
    await page.route('**/rest/v1/documents?*', async route => {
      if (route.request().method() === 'PATCH') {
        documents[0].name = 'renamed-document.pdf';
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(documents[0]) });
      } else if (route.request().method() === 'DELETE') {
        documents = [];
        route.fulfill({ status: 204 });
      } else {
        route.fallback();
      }
    });

    await page.getByText('dummy.pdf').first().hover();
    await page.getByRole('button', { name: 'More options' }).first().click();
    
    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') await dialog.accept('renamed-document.pdf');
      if (dialog.type() === 'confirm') await dialog.accept();
    });

    await page.getByText('Rename').click();
    await expect(page.getByText('renamed-document.pdf').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'artifacts/desktop-renamed.png' });

    // 5. Delete Document
    await page.getByText('renamed-document.pdf').first().hover();
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Delete').click();
    await expect(page.getByText('renamed-document.pdf').first()).toBeHidden({ timeout: 5000 });
    await page.screenshot({ path: 'artifacts/desktop-deleted.png' });
  });
});
