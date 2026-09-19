import { test, expect } from './fixtures/auth.fixture';
import * as fs from 'fs';
import * as path from 'path';

const json = (value: unknown) => JSON.stringify(value);

test.describe('Security/data-integrity hardening', () => {
  test('Settings persists profile, avatar and notification preferences', async ({ page }) => {
    let profile = {
      id: 'mock-user-id',
      name: 'Test User',
      email: 'test@lumena.app',
      avatar_url: null as string | null,
      created_at: new Date().toISOString(),
    };
    let settings = {
      id: 'mock-user-id',
      theme: 'system',
      view_mode: 'grid',
      sort_by: 'created_at',
      sort_order: 'desc',
      sidebar_collapsed: false,
      lang: 'en',
      email_notifications: true,
      desktop_notifications: true,
      weekly_digest: false,
    };
    const profileWrites: Record<string, unknown>[] = [];
    const settingsWrites: Record<string, unknown>[] = [];
    const avatarUploads: string[] = [];

    await page.route('**/rest/v1/profiles*', async (route) => {
      const method = route.request().method();
      if (method === 'PATCH') {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        profileWrites.push(body);
        profile = { ...profile, ...body };
        await route.fulfill({ status: 200, contentType: 'application/json', body: json(profile) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: json(profile) });
    });

    await page.route('**/rest/v1/user_settings*', async (route) => {
      const method = route.request().method();
      if (method === 'POST' || method === 'PATCH') {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        settingsWrites.push(body);
        settings = { ...settings, ...body };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: json(settings) });
    });

    await page.route('**/storage/v1/object/list/profile_avatars*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/storage/v1/object/profile_avatars/**', async (route) => {
      avatarUploads.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: json({ Key: 'profile_avatars/mock-user-id/avatar.png' }),
      });
    });

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /Settings|Configuración/i })).toBeVisible();

    await page.locator('#name-input').fill('Max Test');
    await page.getByRole('button', { name: /Save Changes|Guardar cambios/i }).click();

    await expect.poll(() => profileWrites.some((write) => write.name === 'Max Test')).toBe(true);

    const avatarInput = page.locator('input[type="file"]');
    await avatarInput.setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKisAAAAASUVORK5CYII=',
        'base64',
      ),
    });

    await expect.poll(() => avatarUploads.length).toBeGreaterThan(0);
    await expect.poll(() =>
      profileWrites.some((write) =>
        typeof write.avatar_url === 'string' &&
        write.avatar_url.includes('/storage/v1/object/public/profile_avatars/mock-user-id/avatar.png'),
      ),
    ).toBe(true);

    await page.getByRole('button', { name: /Notifications|Notificaciones/i }).click();
    const toggles = page.getByRole('checkbox');
    await expect(toggles).toHaveCount(3);
    await toggles.nth(2).check();

    await expect.poll(() =>
      settingsWrites.some((write) => write.weekly_digest === true),
    ).toBe(true);
  });

  test('Workspace creation uses the audited RPC and activates the new workspace', async ({ page }) => {
    const workspaces = [
      { id: 'ws-1', name: 'Test Workspace', owner_id: 'mock-user-id', created_at: new Date().toISOString() },
    ];
    const rpcBodies: Record<string, unknown>[] = [];

    await page.route('**/rest/v1/workspaces*', async (route) => {
      const url = route.request().url();
      if (url.includes('id=eq.ws-new')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: json(workspaces.find((workspace) => workspace.id === 'ws-new') ?? null),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: json(workspaces) });
    });

    await page.route('**/rest/v1/rpc/create_workspace*', async (route) => {
      const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
      rpcBodies.push(body);
      workspaces.push({
        id: 'ws-new',
        name: String(body.workspace_name),
        owner_id: 'mock-user-id',
        created_at: new Date().toISOString(),
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: json('ws-new') });
    });

    await page.route('**/rest/v1/documents*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/processing_jobs*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/dashboard');
    const sidebar = page.locator('aside');
    await expect(sidebar.getByText('Test Workspace', { exact: true })).toBeVisible();

    await sidebar.getByRole('button').filter({ hasText: 'Test Workspace' }).click();
    await page.getByRole('menuitem', { name: 'Create Workspace' }).click();
    await page.getByPlaceholder('Workspace Name').fill('Research Workspace');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect.poll(() => rpcBodies.length).toBe(1);
    expect(rpcBodies[0]).toEqual({ workspace_name: 'Research Workspace' });
    await expect(sidebar.getByText('Research Workspace', { exact: true })).toBeVisible();
  });

  test('Bulk move moves Storage first and then commits the workspace RPC', async ({ page }) => {
    const sourceDoc = {
      id: 'doc-source',
      workspace_id: 'ws-1',
      name: 'source.pdf',
      size_bytes: 1024,
      file_path: 'ws-1/hash-source.pdf',
      file_hash: 'hash-source',
      mime_type: 'application/pdf',
      status: 'ready',
      created_at: new Date().toISOString(),
    };
    const workspaces = [
      { id: 'ws-1', name: 'Source Workspace', owner_id: 'mock-user-id' },
      { id: 'ws-2', name: 'Target Workspace', owner_id: 'mock-user-id' },
    ];
    const storageMoves: unknown[] = [];
    const moveRpc: unknown[] = [];

    await page.route('**/rest/v1/workspaces*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: json(workspaces) });
    });
    await page.route('**/rest/v1/documents*', async (route) => {
      const url = route.request().url();
      if (url.includes('workspace_id=eq.ws-2') && url.includes('file_hash=eq.hash-source')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: json([sourceDoc]) });
    });
    await page.route('**/rest/v1/processing_jobs*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/storage/v1/object/move*', async (route) => {
      storageMoves.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/rest/v1/rpc/move_document_workspace*', async (route) => {
      moveRpc.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });

    await page.goto('/dashboard');
    await expect(page.getByText('source.pdf', { exact: true })).toBeVisible();
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByRole('button', { name: 'Move to...' }).click();
    await page.getByRole('menuitem', { name: 'Target Workspace' }).click();

    await expect.poll(() => storageMoves.length).toBe(1);
    await expect.poll(() => moveRpc.length).toBe(1);

    expect(JSON.stringify(storageMoves[0])).toContain('ws-1/hash-source.pdf');
    expect(JSON.stringify(storageMoves[0])).toContain('ws-2/hash-source.pdf');
    expect(moveRpc[0]).toEqual({
      p_document_id: 'doc-source',
      p_target_workspace_id: 'ws-2',
      p_new_file_path: 'ws-2/hash-source.pdf',
    });
    await expect(page.getByText('source.pdf', { exact: true })).toBeHidden();
  });

  test('Bulk copy copies the PDF and creates a fresh processing job in the target workspace', async ({ page }) => {
    const sourceDoc = {
      id: 'doc-source',
      workspace_id: 'ws-1',
      name: 'source.pdf',
      size_bytes: 1024,
      file_path: 'ws-1/hash-source.pdf',
      file_hash: 'hash-source',
      mime_type: 'application/pdf',
      status: 'ready',
      created_at: new Date().toISOString(),
    };
    const workspaces = [
      { id: 'ws-1', name: 'Source Workspace', owner_id: 'mock-user-id' },
      { id: 'ws-2', name: 'Target Workspace', owner_id: 'mock-user-id' },
    ];
    const storageCopies: unknown[] = [];
    const documentCreates: Record<string, unknown>[] = [];
    const jobCreates: Record<string, unknown>[] = [];

    await page.route('**/rest/v1/workspaces*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: json(workspaces) });
    });
    await page.route('**/rest/v1/documents*', async (route) => {
      const method = route.request().method();
      const url = route.request().url();

      if (method === 'POST') {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        documentCreates.push(body);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: json({ id: 'doc-copy', ...body, status: 'queued', created_at: new Date().toISOString() }),
        });
        return;
      }

      if (url.includes('workspace_id=eq.ws-2') && url.includes('file_hash=eq.hash-source')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: json([sourceDoc]) });
    });
    await page.route('**/rest/v1/processing_jobs*', async (route) => {
      if (route.request().method() === 'POST') {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        jobCreates.push(body);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: json({ id: 'job-copy', ...body, status: 'queued', progress: 0 }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/storage/v1/object/copy*', async (route) => {
      storageCopies.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/dashboard');
    await expect(page.getByText('source.pdf', { exact: true })).toBeVisible();
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByRole('button', { name: 'Copy to...' }).click();
    await page.getByRole('menuitem', { name: 'Target Workspace' }).click();

    await expect.poll(() => storageCopies.length).toBe(1);
    await expect.poll(() => documentCreates.length).toBe(1);
    await expect.poll(() => jobCreates.length).toBe(1);

    expect(JSON.stringify(storageCopies[0])).toContain('ws-1/hash-source.pdf');
    expect(JSON.stringify(storageCopies[0])).toContain('ws-2/hash-source.pdf');
    expect(documentCreates[0]).toMatchObject({
      workspace_id: 'ws-2',
      file_path: 'ws-2/hash-source.pdf',
      file_hash: 'hash-source',
      name: 'source.pdf',
    });
    expect(jobCreates[0]).toMatchObject({
      workspace_id: 'ws-2',
      document_id: 'doc-copy',
    });
    await expect(page.getByText('source.pdf', { exact: true })).toBeVisible();
  });

  test('Document-scope AI Highlight reuses one quota token across PDF pages', async ({ page }) => {
    const aiRequests: Record<string, unknown>[] = [];
    const pdfPath = path.resolve(process.cwd(), 'tests', 'fixtures', 'ai-native-multi.pdf');

    await page.route('**/rest/v1/documents*', async (route) => {
      const document = {
        id: 'test-doc-1',
        workspace_id: 'workspace-1',
        name: 'AI Multi.pdf',
        file_path: 'workspace-1/ai-native-multi.pdf',
        size_bytes: fs.statSync(pdfPath).size,
        page_count: 3,
        status: 'ready',
        mime_type: 'application/pdf',
        created_at: new Date().toISOString(),
      };
      const url = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: json(url.includes('id=eq') ? document : [document]),
      });
    });
    await page.route('**/rest/v1/workspaces*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: json([{ id: 'workspace-1', name: 'Test Workspace', owner_id: 'mock-user-id' }]),
      });
    });
    await page.route('**/storage/v1/object/sign/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: json({ signedURL: '/mock-ai.pdf', signedUrl: '/mock-ai.pdf' }) });
    });
    await page.context().route('**/storage/v1/mock-ai.pdf', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: fs.readFileSync(pdfPath) });
    });
    await page.route('**/rest/v1/document_page_texts*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/chat_sessions*', async (route) => {
      const method = route.request().method();
      const session = {
        id: 'session-1',
        document_id: 'test-doc-1',
        workspace_id: 'workspace-1',
        user_id: 'mock-user-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await route.fulfill({ status: method === 'POST' ? 201 : 200, contentType: 'application/json', body: json(method === 'GET' ? null : session) });
    });
    let messageId = 0;
    await page.route('**/rest/v1/chat_messages*', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: json({ id: `msg-${++messageId}`, session_id: 'session-1', role: body.role, content: body.content, created_at: new Date().toISOString() }),
        });
        return;
      }
      if (method === 'PATCH') {
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/functions/v1/rag-retrieve*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: json({ results: [] }) });
    });
    await page.route('**/functions/v1/ai-config*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: json({
          plan: 'free',
          quota: { used: 1, limit: 50, resets_at: new Date(Date.now() + 3600000).toISOString() },
          models: [{
            provider: 'google',
            model_id: 'gemini-3.5-flash-lite',
            display_name: 'Gemini 3.5 Flash Lite',
            tier: 'free',
            capabilities: ['chat', 'ai_highlight'],
            available: true,
          }],
          free_default_chat: 'gemini-3.5-flash-lite',
          free_default_highlight: 'gemini-3.5-flash-lite',
          free_models: ['gemini-3.5-flash-lite'],
        }),
      });
    });
    await page.route('**/functions/v1/create-highlights*', async (route) => {
      const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: json({
          action: {
            type: 'create_highlights',
            instruction: body.instruction,
            scope: body.scope,
            page: body.page,
            model_id: 'gemini-3.5-flash-lite',
          },
        }),
      });
    });
    await page.route('**/functions/v1/ai-highlight*', async (route) => {
      const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
      aiRequests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: json({
          selections: [],
          model: 'gemini-3.5-flash-lite',
          quota_run_token: 'quota-run-e2e',
        }),
      });
    });

    await page.goto('/viewer/test-doc-1');
    await expect(page.getByText('AI Multi.pdf').first()).toBeVisible({ timeout: 15000 });
    await page.getByTestId('toggle-chat-btn').click();
    await page.getByTestId('chat-input').fill('Subrayá los conceptos importantes en todo el documento.');
    await page.getByTestId('chat-send').click();

    await expect.poll(() => aiRequests.length, { timeout: 30000 }).toBeGreaterThan(1);

    expect(aiRequests[0].quota_scope).toBe('document');
    expect(aiRequests[0].quota_run_token).toBeUndefined();
    for (const request of aiRequests.slice(1)) {
      expect(request.quota_scope).toBe('document');
      expect(request.quota_run_token).toBe('quota-run-e2e');
    }
  });
});
