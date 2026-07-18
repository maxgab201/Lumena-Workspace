import { test, expect } from './fixtures/auth.fixture';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Knowledge Tools System', () => {
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
    await page.route('**/mock.pdf', async (route) => {
      await route.fulfill({
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

  test('can open knowledge sidebar, add flashcard and glossary term', async ({ page }) => {
    // Go to the viewer
    await page.goto('/viewer/test-doc-1');

    // Make sure we have enough credits or mock bypass (already mocked in App logic or fallback)
    
    // Toggle knowledge tools
    const toggleBtn = page.getByTestId('toggle-knowledge-btn');
    await expect(toggleBtn).toBeVisible({ timeout: 15000 });
    await toggleBtn.click();

    // Verify Knowledge Sidebar is open (Flashcards tab is default)
    await expect(page.locator('text="Knowledge Tools"')).toBeVisible();
    await expect(page.getByTestId('tab-flashcards')).toBeVisible();

    // Add a flashcard
    await page.getByTestId('add-flashcard-btn').click();
    await page.getByTestId('flashcard-front-input').fill('What is React?');
    await page.getByTestId('flashcard-back-input').fill('A UI library for building user interfaces.');
    await page.getByTestId('save-flashcard-btn').click();

    // Verify it was added
    await expect(page.locator('text="What is React?"')).toBeVisible();
    await expect(page.locator('text="A UI library for building user interfaces."')).toBeVisible();

    // Toggle Study Mode
    await page.getByTestId('start-study-mode-btn').click();
    
    // Verify study mode overlay
    const overlay = page.getByTestId('study-mode-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('text="What is React?"')).toBeVisible();

    // Flip card
    await page.locator('text="Flip Card"').click();
    await expect(overlay.locator('text="A UI library for building user interfaces."')).toBeVisible();

    // Close study mode
    await page.getByTestId('close-study-mode-btn').click();
    await expect(overlay).toBeHidden();

    // Switch to Glossary Tab
    await page.getByTestId('tab-glossary').click();

    // Add Glossary term
    await page.getByTestId('add-glossary-btn').click();
    await page.getByTestId('glossary-term-input').fill('Zustand');
    await page.getByTestId('glossary-definition-input').fill('A small, fast and scalable state-management solution.');
    await page.getByTestId('save-glossary-btn').click();

    // Verify it was added
    await expect(page.locator('text="Zustand"')).toBeVisible();
  });
});
