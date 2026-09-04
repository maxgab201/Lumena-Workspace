import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

const previewUrl = 'https://lumena-workspace-staging-a58bpom8v-maxgab201s-projects.vercel.app';
const testEmail = 'codex.checkpoint1.20260903.1919@example.com';
const testPassword = 'Lumena-QA-9C3d236!R7v2';
const bypassToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

test.use({
  extraHTTPHeaders: bypassToken
    ? { 'x-vercel-protection-bypass': bypassToken }
    : {},
});

test('Checkpoint 1 live Preview review', async ({ page }) => {
  test.setTimeout(240_000);
  expect(bypassToken, 'Vercel protection bypass token').toBeTruthy();

  const outputDir = path.resolve(process.cwd(), 'test-results', 'checkpoint1-live-review');
  fs.mkdirSync(outputDir, { recursive: true });

  const firstPdfPath = path.join(outputDir, 'checkpoint-first.pdf');
  const generatedPdfPath = path.join(outputDir, 'checkpoint-second.pdf');
  const cancelPdfPath = path.join(outputDir, 'checkpoint-cancel.pdf');

  const firstPdf = await PDFDocument.create();
  const firstPage = firstPdf.addPage([612, 792]);
  const firstFont = await firstPdf.embedFont(StandardFonts.Helvetica);
  firstPage.drawText('Lumena checkpoint one first native text PDF.', {
    x: 72,
    y: 700,
    size: 18,
    font: firstFont,
  });
  fs.writeFileSync(firstPdfPath, Buffer.from(await firstPdf.save()));

  const generatedPdf = await PDFDocument.create();
  const pageOne = generatedPdf.addPage([612, 792]);
  const font = await generatedPdf.embedFont(StandardFonts.Helvetica);
  pageOne.drawText('Lumena checkpoint one second native text PDF.', { x: 72, y: 700, size: 18, font });
  const generatedBytes = Buffer.from(await generatedPdf.save());
  fs.writeFileSync(generatedPdfPath, generatedBytes);
  fs.writeFileSync(
    cancelPdfPath,
    Buffer.concat([generatedBytes, Buffer.alloc(12 * 1024 * 1024, 0x20)]),
  );

  const observations: {
    consoleErrors: string[];
    failedResponses: Array<{ status: number; url: string }>;
    uploadSamples: string[];
    statusSamples: Array<{ elapsedMs: number; first: string; second: string }>;
    cancelMs?: number;
    viewerMs?: number;
  } = {
    consoleErrors: [],
    failedResponses: [],
    uploadSamples: [],
    statusSamples: [],
  };

  page.on('console', message => {
    if (message.type() === 'error') observations.consoleErrors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      observations.failedResponses.push({ status: response.status(), url: response.url() });
    }
  });

  try {
    await page.goto(`${previewUrl}/auth`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/dashboard', { timeout: 20_000 });

    const browseFiles = page.getByRole('button', { name: 'Browse Files' });
    await expect(browseFiles).toBeVisible();

    const cancelStart = Date.now();
    const cancelChooserPromise = page.waitForEvent('filechooser');
    await browseFiles.click();
    const cancelChooser = await cancelChooserPromise;
    await cancelChooser.setFiles(cancelPdfPath);
    await page.getByRole('button', { name: 'Cancel upload of checkpoint-cancel.pdf' }).click();
    await expect(page.getByText('checkpoint-cancel.pdf')).toHaveCount(0);
    observations.cancelMs = Date.now() - cancelStart;

    const multipleChooserPromise = page.waitForEvent('filechooser');
    await browseFiles.click();
    const multipleChooser = await multipleChooserPromise;
    expect(multipleChooser.isMultiple()).toBe(true);
    await multipleChooser.setFiles([firstPdfPath, generatedPdfPath]);

    const queue = page.locator('div[aria-live="polite"]').first();
    for (let index = 0; index < 20; index += 1) {
      if (await queue.count()) {
        const text = (await queue.innerText()).trim();
        if (text && observations.uploadSamples.at(-1) !== text) observations.uploadSamples.push(text);
      }
      if (await page.getByText('checkpoint-first.pdf', { exact: true }).count()) break;
      await page.waitForTimeout(100);
    }

    const firstCard = page.locator('[data-testid^="document-card-"]').filter({ hasText: 'checkpoint-first.pdf' });
    const secondCard = page.locator('[data-testid^="document-card-"]').filter({ hasText: 'checkpoint-second.pdf' });
    await expect(firstCard).toBeVisible({ timeout: 20_000 });
    await expect(secondCard).toBeVisible({ timeout: 20_000 });

    const firstStatus = firstCard.locator('[data-testid^="document-status-"]');
    const secondStatus = secondCard.locator('[data-testid^="document-status-"]');
    const statusStart = Date.now();
    for (let index = 0; index < 180; index += 1) {
      const first = (await firstStatus.innerText()).trim();
      const second = (await secondStatus.innerText()).trim();
      const last = observations.statusSamples.at(-1);
      if (!last || last.first !== first || last.second !== second) {
        observations.statusSamples.push({ elapsedMs: Date.now() - statusStart, first, second });
      }
      if (['Ready', 'Failed'].includes(first) && ['Ready', 'Failed'].includes(second)) break;
      await page.waitForTimeout(500);
    }

    await expect(firstStatus).toHaveText('Ready');
    await expect(secondStatus).toHaveText('Ready');

    await page.screenshot({ path: path.join(outputDir, 'dashboard-desktop.png'), fullPage: true });

    const duplicateChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Browse Files' }).click();
    const duplicateChooser = await duplicateChooserPromise;
    await duplicateChooser.setFiles(firstPdfPath);
    await expect(page.getByText(/already in this workspace/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Dismiss failed upload/ }).click();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(firstCard.locator('[data-testid^="document-status-"]')).toHaveText('Ready');
    await expect(secondCard.locator('[data-testid^="document-status-"]')).toHaveText('Ready');

    const viewerStart = Date.now();
    await firstCard.click();
    await page.waitForURL('**/viewer/**');
    await expect(page.locator('.pdf-page').first()).toBeVisible({ timeout: 20_000 });
    observations.viewerMs = Date.now() - viewerStart;
    await expect(page.getByRole('button', { name: 'Search in document' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Toggle developer overlays' })).toHaveCount(0);

    await page.goto(`${previewUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByText('checkpoint-first.pdf', { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(outputDir, 'dashboard-mobile.png'), fullPage: true });
  } finally {
    fs.writeFileSync(
      path.join(outputDir, 'observations.json'),
      JSON.stringify(observations, null, 2),
    );
  }
});
