import { test as base } from '@playwright/test';

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(errors);
  },
});

export { expect } from '@playwright/test';