# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: viewer.spec.ts >> PDF Viewer (Mocked API) >> Viewer loads and renders PDF with virtualization
- Location: tests\viewer.spec.ts:79:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Large-Document-500-pages.pdf')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Large-Document-500-pages.pdf')

```

```yaml
- complementary:
  - button "P Personal Workspace"
  - navigation:
    - link "Documents":
      - /url: /dashboard
  - paragraph: Knowledge
  - navigation: Collections Soon Mind Maps Soon Flashcards Soon
  - paragraph: Media
  - navigation: Podcasts Soon Presentations Soon Infographics Soon
  - link "Settings":
    - /url: /settings
- banner:
  - button "Search knowledge... K"
  - button
  - button "U"
- main:
  - heading "Document not found" [level=2]
  - paragraph: Cannot read properties of undefined (reading 'replace')
  - button "Back to Dashboard"
- region "Notifications alt+T"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('PDF Viewer (Mocked API)', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     // Mock Supabase Auth Session
  6   |     await page.route('**/auth/v1/session', route => {
  7   |       route.fulfill({
  8   |         status: 200,
  9   |         contentType: 'application/json',
  10  |         body: JSON.stringify({
  11  |           session: {
  12  |             access_token: 'fake-access-token',
  13  |             user: { id: 'test-user-id', email: 'test@example.com' }
  14  |           }
  15  |         })
  16  |       });
  17  |     });
  18  | 
  19  |     await page.route('**/rest/v1/profiles*', async (route) => {
  20  |       await route.fulfill({
  21  |         status: 200,
  22  |         json: [{
  23  |           id: 'test-user-id',
  24  |           email: 'test@example.com',
  25  |           name: 'Test User',
  26  |           created_at: new Date().toISOString()
  27  |         }]
  28  |       });
  29  |     });
  30  | 
  31  |     await page.route('**/rest/v1/workspaces*', async (route) => {
  32  |       await route.fulfill({
  33  |         status: 200,
  34  |         json: [{
  35  |           id: 'workspace-1',
  36  |           name: 'Personal Workspace',
  37  |           owner_id: 'test-user-id'
  38  |         }]
  39  |       });
  40  |     });
  41  | 
  42  |     // Mock the document response
  43  |     await page.route('**/rest/v1/documents*', async (route) => {
  44  |       await route.fulfill({
  45  |         status: 200,
  46  |         json: [{
  47  |           id: 'test-doc-1',
  48  |           workspace_id: 'workspace-1',
  49  |           name: 'Large-Document-500-pages.pdf',
  50  |           file_path: 'test-user-id/workspace-1/Large-Document-500-pages.pdf',
  51  |           size_bytes: 25 * 1024 * 1024,
  52  |           status: 'ready',
  53  |           created_at: new Date().toISOString()
  54  |         }]
  55  |       });
  56  |     });
  57  |     
  58  |     // Mock the storage signed URL
  59  |     await page.route('**/storage/v1/object/sign/documents*', async (route) => {
  60  |       await route.fulfill({
  61  |         status: 200,
  62  |         json: { signedURL: 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf' }
  63  |       });
  64  |     });
  65  | 
  66  |     // Bypass auth using localStorage
  67  |     await page.addInitScript(() => {
  68  |       window.localStorage.setItem('sb-nsjetmjtwbhellqasggw-auth-token', JSON.stringify({
  69  |         access_token: 'fake-access-token',
  70  |         refresh_token: 'fake-refresh-token',
  71  |         expires_in: 3600,
  72  |         expires_at: Math.floor(Date.now() / 1000) + 3600,
  73  |         token_type: 'bearer',
  74  |         user: { id: 'test-user-id', email: 'test@example.com', aud: 'authenticated', role: 'authenticated' }
  75  |       }));
  76  |     });
  77  |   });
  78  | 
  79  |   test('Viewer loads and renders PDF with virtualization', async ({ page }) => {
  80  |     // Go directly to the viewer page
  81  |     await page.goto('/viewer/test-doc-1');
  82  | 
  83  |     // Wait for the document title to appear in the toolbar
> 84  |     await expect(page.locator('text=Large-Document-500-pages.pdf')).toBeVisible({ timeout: 10000 });
      |                                                                     ^ Error: expect(locator).toBeVisible() failed
  85  | 
  86  |     // Wait for the PDF.js canvas to render
  87  |     const canvas = page.locator('.react-pdf__Page__canvas').first();
  88  |     await expect(canvas).toBeVisible({ timeout: 30000 });
  89  | 
  90  |     // Verify virtualization: there should only be a few pages rendered in the DOM, not the full document
  91  |     const canvases = await page.locator('.react-pdf__Page__canvas').count();
  92  |     expect(canvases).toBeLessThan(10); // TanStack virtualizer renders visible + overscan (e.g. 2+2=4 or so)
  93  |     expect(canvases).toBeGreaterThan(0);
  94  | 
  95  |     // Zoom in
  96  |     const zoomInBtn = page.locator('button[aria-label="Zoom in"]');
  97  |     await zoomInBtn.click();
  98  |     await zoomInBtn.click();
  99  |     
  100 |     // Verify scale increased (check toolbar text)
  101 |     await expect(page.locator('text=150%')).toBeVisible();
  102 | 
  103 |     // Rotate
  104 |     const rotateBtn = page.locator('button[aria-label="Rotate clockwise"]');
  105 |     await rotateBtn.click();
  106 | 
  107 |     // The canvas style should reflect rotation
  108 |     await expect(canvas).toHaveCSS('transform', /matrix/);
  109 |     
  110 |     // Scroll and navigate
  111 |     const nextBtn = page.locator('button[aria-label="Next page"]');
  112 |     await nextBtn.click();
  113 |     
  114 |     // The current page input should show 2
  115 |     await expect(page.locator('input[aria-label="Current page"]')).toHaveValue('2');
  116 |   });
  117 | });
  118 | 
```