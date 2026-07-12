import { test, expect } from './fixtures/auth.fixture';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Chat System', () => {
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
    
    // Mock workspaces like auth.fixture
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

  test('can open chat, send a message and receive streaming response', async ({ page }) => {
    await page.goto('/viewer/test-doc-1');

    // Wait for the document title to appear in the toolbar
    await expect(page.locator('text="Medium-Document.pdf"').first()).toBeVisible({ timeout: 15000 });

    // Open chat sidebar via toolbar button
    const chatBtn = page.getByTestId('toggle-chat-btn');
    await expect(chatBtn).toBeVisible();
    await chatBtn.click();

    // Verify sidebar is visible
    const sidebar = page.getByTestId('chat-sidebar');
    await expect(sidebar).toBeVisible();

    // Type a message
    const input = page.getByTestId('chat-input');
    await input.fill('Write a summary of this document');
    
    // Send it
    await page.getByTestId('chat-send').click();

    // Verify user message appears
    const userMsg = page.getByTestId('chat-msg-user').first();
    await expect(userMsg).toContainText('Write a summary of this document');

    // Verify AI response starts streaming
    const assistantMsg = page.getByTestId('chat-msg-assistant').first();
    await expect(assistantMsg).toBeVisible();
    
    // Wait for the simulated stream to finish
    await expect(assistantMsg).toContainText('Lumena Workspace', { timeout: 10000 });

    // Close the chat
    await page.getByTestId('chat-close').click();
    await expect(sidebar).toBeHidden();
  });
});
