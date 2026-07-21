# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: viewer-chat.spec.ts >> Chat System >> can open chat, send a message and receive streaming response
- Location: tests\viewer-chat.spec.ts:67:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('chat-msg-user').first()
Expected substring: "Write a summary of this document"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for getByTestId('chat-msg-user').first()

```

```yaml
- link "Skip to content":
  - /url: "#main-content"
- complementary:
  - button "W Workspace"
  - navigation:
    - link "Documents":
      - /url: /dashboard
  - paragraph: Knowledge
  - navigation: Collections Soon Mind Maps Soon Flashcards Soon
  - paragraph: Media
  - navigation: Podcasts Soon Presentations Soon Infographics Soon
  - link "Billing":
    - /url: /billing
  - link "Settings":
    - /url: /settings
  - button "Collapse sidebar": Collapse
- banner:
  - navigation "Breadcrumb":
    - button "Documents"
    - button "Document"
  - button "Open command palette": Search... K
  - button "Language"
  - button "Notifications"
  - button "User menu":
    - img
- main:
  - button "Back to dashboard"
  - text: Medium-Document.pdf Jul 21, 2026 2.0 MB ready Medium-Document.pdf 2.0 MB
  - button "Previous page" [disabled]
  - textbox "Current page": "1"
  - text: / 100
  - button "Next page"
  - button "Zoom out"
  - text: 100%
  - button "Zoom in"
  - button "Fit to page"
  - button "Rotate clockwise"
  - button "Toggle developer overlays"
  - button "Toggle Chat"
  - button "Knowledge Tools"
  - text: Page 1 of 100 Page 2 of 100 Page 3 of 100 Page 4 of 100
  - heading "Lumena AI" [level=2]
  - button
  - text: No AI models available yet.
  - paragraph: No messages yet.
  - paragraph: Ask a question about the document.
  - textbox "Ask a question..."
  - button [disabled]
- region "Notifications alt+T"
```

# Test source

```ts
  1   | import { test, expect } from './fixtures/auth.fixture';
  2   | import * as fs from 'fs';
  3   | import * as path from 'path';
  4   | 
  5   | test.describe('Chat System', () => {
  6   |   test.beforeEach(async ({ page }) => {
  7   |     // Mock the documents response
  8   |     await page.route('**/rest/v1/documents*', async (route) => {
  9   |       const mockDoc = {
  10  |         id: 'test-doc-1',
  11  |         workspace_id: 'workspace-1',
  12  |         name: 'Medium-Document.pdf',
  13  |         file_path: 'test-user-id/workspace-1/Medium-Document.pdf',
  14  |         size_bytes: 2 * 1024 * 1024,
  15  |         status: 'ready',
  16  |         created_at: new Date().toISOString()
  17  |       };
  18  |       const url = route.request().url();
  19  |       if (url.includes('id=eq')) {
  20  |         await route.fulfill({
  21  |           status: 200,
  22  |           contentType: 'application/json',
  23  |           body: JSON.stringify(mockDoc)
  24  |         });
  25  |       } else {
  26  |         await route.fulfill({
  27  |           status: 200,
  28  |           contentType: 'application/json',
  29  |           body: JSON.stringify([mockDoc])
  30  |         });
  31  |       }
  32  |     });
  33  | 
  34  |     // Mock the storage signed URL
  35  |     await page.route('**/storage/v1/object/sign/**', async (route) => {
  36  |       await route.fulfill({
  37  |         status: 200,
  38  |         json: { 
  39  |           signedURL: '/mock.pdf',
  40  |           signedUrl: '/mock.pdf'
  41  |         }
  42  |       });
  43  |     });
  44  | 
  45  |     // Mock the actual PDF download
  46  |     await page.context().route('**/storage/v1/mock.pdf', route => {
  47  |       route.fulfill({
  48  |         status: 200,
  49  |         contentType: 'application/pdf',
  50  |         body: fs.readFileSync(path.resolve(process.cwd(), 'tests', 'fixtures', 'medium-native.pdf'))
  51  |       });
  52  |     });
  53  |     
  54  |     // Mock workspaces like auth.fixture
  55  |     await page.route('**/rest/v1/workspaces*', async (route) => {
  56  |       await route.fulfill({
  57  |         status: 200,
  58  |         json: [{
  59  |           id: 'workspace-1',
  60  |           name: 'Personal Workspace',
  61  |           owner_id: 'test-user-id'
  62  |         }]
  63  |       });
  64  |     });
  65  |   });
  66  | 
  67  |   test('can open chat, send a message and receive streaming response', async ({ page }) => {
  68  |     await page.goto('/viewer/test-doc-1');
  69  | 
  70  |     // Wait for the document title to appear in the toolbar
  71  |     await expect(page.locator('text="Medium-Document.pdf"').first()).toBeVisible({ timeout: 15000 });
  72  | 
  73  |     // Open chat sidebar via toolbar button
  74  |     const chatBtn = page.getByTestId('toggle-chat-btn');
  75  |     await expect(chatBtn).toBeVisible();
  76  |     await chatBtn.click();
  77  | 
  78  |     // Verify sidebar is visible
  79  |     const sidebar = page.getByTestId('chat-sidebar');
  80  |     await expect(sidebar).toBeVisible();
  81  | 
  82  |     // Type a message
  83  |     const input = page.getByTestId('chat-input');
  84  |     await input.fill('Write a summary of this document');
  85  |     
  86  |     // Send it
  87  |     await page.getByTestId('chat-send').click();
  88  | 
  89  |     // Verify user message appears
  90  |     const userMsg = page.getByTestId('chat-msg-user').first();
> 91  |     await expect(userMsg).toContainText('Write a summary of this document');
      |                           ^ Error: expect(locator).toContainText(expected) failed
  92  | 
  93  |     // Verify AI response starts streaming
  94  |     const assistantMsg = page.getByTestId('chat-msg-assistant').first();
  95  |     await expect(assistantMsg).toBeVisible();
  96  |     
  97  |     // Wait for the simulated stream to finish
  98  |     await expect(assistantMsg).toContainText('Lumena Workspace', { timeout: 10000 });
  99  | 
  100 |     // Close the chat
  101 |     await page.getByTestId('chat-close').click();
  102 |     await expect(sidebar).toBeHidden();
  103 |   });
  104 | });
  105 | 
```