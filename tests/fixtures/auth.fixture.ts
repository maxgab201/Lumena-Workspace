import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ authenticatedPage: void }>({
  authenticatedPage: [async ({ page }, use) => {
    const mockSession = {
      access_token: 'mock-access-token',
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

    // 1. Mock the Auth Session API
    await page.route('**/auth/v1/**', async route => {
      const url = route.request().url();
      if (url.includes('/session') || url.includes('/user')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(url.includes('/user') ? { user: mockSession.user } : { session: mockSession })
        });
      } else {
        route.continue();
      }
    });

    // 2. Mock Get Workspaces
    await page.route('**/rest/v1/workspaces?select=*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'ws-1', name: 'Test Workspace', owner_id: 'mock-user-id' }])
      });
    });

    // 2b. Mock Profiles
    await page.route('**/rest/v1/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'mock-user-id',
          email: 'test@lumena.app',
          name: 'Test User',
          created_at: new Date().toISOString()
        }])
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
