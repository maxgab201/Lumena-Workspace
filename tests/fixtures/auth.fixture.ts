import { test as base, expect } from './console-errors.fixture';

export const test = base.extend<{ authenticatedPage: void }>({
  authenticatedPage: [async ({ page }, use) => {
    const mockSession = {
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtb2NrLXVzZXItaWQiLCJlbWFpbCI6InRlc3RAbHVtZW5hLmFwcCIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.MOCK_SIGNATURE',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: 'mock-user-id',
        email: 'test@lumena.app',
        aud: 'authenticated',
        role: 'authenticated'
      }
    };

    // 1. Mock the Auth Session API. The token is intentionally synthetic, so
    // every auth request must stay inside the deterministic test boundary.
    await page.route('**/auth/v1/**', async route => {
      const url = route.request().url();
      if (url.includes('/token')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockSession),
        });
      } else if (url.includes('/user')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user: mockSession.user }),
        });
      } else if (url.includes('/session')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ session: mockSession }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
    });

    // 2. Mock the REST resources loaded by the application shell. Individual
    // specs can register more specific routes after this fixture.
    await page.route('**/rest/v1/workspaces*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'ws-1', name: 'Test Workspace', owner_id: 'mock-user-id' }]),
      });
    });

    await page.route('**/rest/v1/profiles*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'mock-user-id', email: 'test@lumena.app', name: 'Test User', created_at: new Date().toISOString() }),
      });
    });

    await page.route('**/rest/v1/user_settings*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });

    for (const resource of ['highlights', 'highlight_categories', 'flashcards', 'glossary_terms', 'mind_map_nodes', 'timeline_events', 'presentations']) {
      await page.route(`**/rest/v1/${resource}*`, async route => {
        const method = route.request().method();
        const row = { id: `mock-${resource}-id`, created_at: new Date().toISOString() };
        await route.fulfill({
          status: method === 'POST' ? 201 : 200,
          contentType: 'application/json',
          body: JSON.stringify(method === 'POST' ? row : []),
        });
      });
    }

    await page.route('**/rest/v1/chat_sessions*', async route => {
      const method = route.request().method();
      const session = { id: 'mock-session-id', document_id: 'test-doc-1', workspace_id: 'ws-1', user_id: 'mock-user-id', created_at: new Date().toISOString() };
      await route.fulfill({
        status: method === 'POST' ? 201 : 200,
        contentType: 'application/json',
        body: JSON.stringify(method === 'POST' ? session : null),
      });
    });

    await page.route('**/rest/v1/chat_messages*', async route => {
      const method = route.request().method();
      const message = { id: 'mock-message-id', session_id: 'mock-session-id', role: 'assistant', content: '', created_at: new Date().toISOString() };
      await route.fulfill({
        status: method === 'POST' ? 201 : 200,
        contentType: 'application/json',
        body: JSON.stringify(method === 'GET' ? [] : message),
      });
    });

    // 3. Inject the session into localStorage to hydrate the client immediately
    // Note: We use page.addInitScript so it runs before any app code on EVERY page load,
    // avoiding race conditions and timeouts! This is much more reliable than page.evaluate.
    await page.addInitScript((sessionStr) => {
      const url = 'https://nsjetmjtwbhellqasggw.supabase.co';
      const projectRef = new URL(url).hostname.split('.')[0];
      window.localStorage.setItem(`sb-${projectRef}-auth-token`, sessionStr);
    }, JSON.stringify(mockSession));

    await use();
  }, { auto: true }],
});

export { expect };
