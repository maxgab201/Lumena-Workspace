import { test, expect } from './fixtures/auth.fixture';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Chat System', () => {
  test.beforeEach(async ({ page }) => {
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

    await page.route('**/storage/v1/object/sign/**', async (route) => {
      await route.fulfill({
        status: 200,
        json: { signedURL: '/mock.pdf', signedUrl: '/mock.pdf' }
      });
    });

    await page.context().route('**/storage/v1/mock.pdf', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: fs.readFileSync(path.resolve(process.cwd(), 'tests', 'fixtures', 'medium-native.pdf'))
      });
    });

    await page.route('**/rest/v1/workspaces*', async (route) => {
      await route.fulfill({
        status: 200,
        json: [{ id: 'workspace-1', name: 'Personal Workspace', owner_id: 'test-user-id' }]
      });
    });

    await page.route('**/rest/v1/chat_sessions*', async (route) => {
      const method = route.request().method();
      const session = {
        id: 'session-1', document_id: 'test-doc-1', workspace_id: 'workspace-1',
        user_id: 'mock-user-id', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      await route.fulfill({ status: method === 'POST' ? 201 : 200, json: method === 'GET' ? null : session });
    });

    let nextMessageId = 0;
    await page.route('**/rest/v1/chat_messages*', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        const body = route.request().postDataJSON() || {};
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: `msg-${++nextMessageId}`, session_id: 'session-1', role: body.role, content: body.content, created_at: new Date().toISOString() }),
        });
      } else if (method === 'PATCH') {
        await route.fulfill({ status: 204, body: '' });
      } else {
        await route.fulfill({ status: 200, json: [] });
      }
    });

    await page.route('**/functions/v1/rag-retrieve', async (route) => {
      await route.fulfill({ status: 200, json: { results: [] } });
    });

    await page.route('**/functions/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('ai-gateway')) {
        const body = 'data: {"chunk":"Lumena Workspace is a knowledge management platform..."}\n\ndata: {"done":true}\n\n';
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body });
      } else if (url.includes('rag-retrieve')) {
        await route.fulfill({ status: 200, json: { results: [] } });
      } else {
        await route.fulfill({ status: 200, json: {} });
      }
    });

    await page.route('**/functions/v1/ai-gateway', async (route) => {
      const body = [
        'data: {"chunk":"Lumena Workspace is a knowledge management platform..."}\n\n',
        'data: {"done":true}\n\n',
      ].join('');
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body });
    });

    await page.route('**/rest/v1/workspaces*', async (route) => {
      await route.fulfill({
        status: 200,
        json: [{ id: 'workspace-1', name: 'Personal Workspace', owner_id: 'test-user-id' }]
      });
    });
  });

  test('can open chat, send a message and receive streaming response', async ({ page }) => {
    await page.goto('/viewer/test-doc-1');

    await expect(page.locator('text="Medium-Document.pdf"').first()).toBeVisible({ timeout: 15000 });

    const chatBtn = page.getByTestId('toggle-chat-btn');
    await expect(chatBtn).toBeVisible();
    await chatBtn.click();

    const sidebar = page.getByTestId('chat-sidebar');
    await expect(sidebar).toBeVisible();

    const input = page.getByTestId('chat-input');
    await input.fill('Write a summary of this document');

    await page.getByTestId('chat-send').click();
    await page.waitForTimeout(250);

    const userMsg = page.getByTestId('chat-msg-user').first();
    await expect(userMsg).toContainText('Write a summary of this document');

    const assistantMsg = page.getByTestId('chat-msg-assistant').first();
    await expect(assistantMsg).toBeVisible();

    await expect(assistantMsg).toContainText('Lumena Workspace', { timeout: 10000 });

    await page.getByTestId('chat-close').click();
    await expect(sidebar).toBeHidden();
  });
});