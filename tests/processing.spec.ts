import { test, expect } from './fixtures/auth.fixture';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Document Processing Engine Performance', () => {
  // Use sequential mode because we are measuring performance
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Mock Documents API
    await page.route('**/rest/v1/documents?*', async route => {
      if (route.request().method() === 'POST') {
        route.fulfill({ 
          status: 201, 
          contentType: 'application/json', 
          body: JSON.stringify({ id: 'mock-doc-id', name: 'uploaded.pdf', status: 'ready', created_at: new Date().toISOString(), size_bytes: 1024, file_path: 'ws-1/test.pdf' }) 
        });
      } else if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else {
        route.continue();
      }
    });

    // Mock processing jobs
    await page.route('**/rest/v1/processing_jobs*', async route => {
      if (route.request().method() === 'POST') {
        route.fulfill({ 
          status: 201, 
          contentType: 'application/json', 
          body: JSON.stringify([{ id: 'mock-job-id', document_id: 'mock-doc-id', status: 'queued', progress: 0 }]) 
        });
      } else if (route.request().method() === 'PATCH') {
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else {
        route.continue();
      }
    });

    // Mock Upload Storage
    await page.route('**/storage/v1/object/workspace_documents**', route => {
      route.fulfill({ status: 200, body: JSON.stringify({ Key: 'workspace_documents/test.pdf' }) });
    });

    // Mock the storage signed URL
    await page.context().route('**/storage/v1/object/sign/**', async (route) => {
      route.fulfill({
        status: 200,
        json: { 
          signedUrl: '/mock.pdf',
          signedURL: '/mock.pdf'
        }
      });
    });

    // Mock the actual PDF download (using context.route so Web Worker requests are intercepted)
    await page.context().route('**/storage/v1/mock.pdf', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: fs.readFileSync(path.resolve(process.cwd(), 'tests', 'fixtures', 'small-native.pdf'))
      });
    });

    await page.goto('/dashboard');
    await page.waitForSelector('text=Documents');
  });

  const testPdf = async (page: any, filename: string, expectedPages: number, timeoutMs = 45000) => {
    const filePath = path.resolve(process.cwd(), 'tests', 'fixtures', filename);
    
    // Start performance measurement
    const startTime = Date.now();
    
    await page.route('**/storage/v1/object/sign/workspace_documents/mock-pdf-url', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: fs.readFileSync(filePath)
      });
    });
    
    await page.locator('input[type="file"]').setInputFiles(filePath);
    
    // Wait for the job to appear in Processing Center
    // The mocked upload returns name: 'uploaded.pdf'
    await expect(page.locator(`text=uploaded.pdf`).first()).toBeVisible({ timeout: 15000 });
    
    // Wait for it to hit Completed state
    // The status badge says "completed"
    await expect(page.locator('text=completed').first()).toBeVisible({ timeout: timeoutMs });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`[Performance] ${filename} (${expectedPages} pages) inspection took ${duration}ms`);
    
    return duration;
  };

  test('Inspect 1-page PDF (small-native)', async ({ page }) => {
    const duration = await testPdf(page, 'small-native.pdf', 1);
    expect(duration).toBeLessThan(15000); 
  });

  test('Inspect 100-page PDF (medium-native)', async ({ page }) => {
    test.setTimeout(60000);
    const duration = await testPdf(page, 'medium-native.pdf', 100, 45000);
    expect(duration).toBeLessThan(45000);
  });

  test('Inspect 1000-page PDF (large-native)', async ({ page }) => {
    test.setTimeout(400000);
    const duration = await testPdf(page, 'large-native.pdf', 1000, 400000);
    expect(duration).toBeLessThan(400000);
  });
});

