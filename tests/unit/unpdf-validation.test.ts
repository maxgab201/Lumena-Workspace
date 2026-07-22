/**
 * unpdf Validation Tests — Issue #17
 *
 * Tests unpdf text extraction directly with different PDF types.
 * These are unit tests that verify unpdf behavior, not E2E tests.
 *
 * Run with: npx vitest run tests/unit/unpdf-validation.test.ts
 * Or: npx tsx tests/unit/unpdf-validation.test.ts (standalone)
 */
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.resolve(process.cwd(), 'tests', 'fixtures');

interface ExtractionResult {
  filename: string;
  totalPages: number;
  pageTexts: string[];
  hasNativeText: boolean;
  totalPagesWithText: number;
  avgCharsPerPage: number;
  extractionTimeMs: number;
  error?: string;
}

async function extractWithUnpdf(filePath: string): Promise<ExtractionResult> {
  const filename = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const pdfBytes = new Uint8Array(fileBuffer);

  const startTime = Date.now();

  try {
    // Dynamic import for unpdf (may not be available in all environments)
    const { extractText, getDocumentProxy } = await import('npm:unpdf@1.6.2');

    const pdf = await getDocumentProxy(pdfBytes);
    const { text: pageTexts } = await extractText(pdf, { mergePages: false });
    const totalPages = pdf.numPages;

    pdf.destroy();

    const extractionTimeMs = Date.now() - startTime;
    const pagesWithText = pageTexts.filter(t => t.trim().length > 0);
    const totalChars = pageTexts.reduce((sum, t) => sum + t.length, 0);

    return {
      filename,
      totalPages,
      pageTexts,
      hasNativeText: pagesWithText.length > 0,
      totalPagesWithText: pagesWithText.length,
      avgCharsPerPage: Math.round(totalChars / totalPages),
      extractionTimeMs,
    };
  } catch (error) {
    return {
      filename,
      totalPages: 0,
      pageTexts: [],
      hasNativeText: false,
      totalPagesWithText: 0,
      avgCharsPerPage: 0,
      extractionTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runValidation() {
  console.log('=== unpdf Validation Suite ===\n');

  const fixtures = fs.readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.pdf'));
  console.log(`Found ${fixtures.length} PDF fixtures: ${fixtures.join(', ')}\n`);

  const results: ExtractionResult[] = [];

  for (const filename of fixtures) {
    const filePath = path.join(FIXTURES_DIR, filename);
    console.log(`Testing: ${filename}...`);

    const result = await extractWithUnpdf(filePath);
    results.push(result);

    if (result.error) {
      console.log(`  ❌ ERROR: ${result.error}`);
    } else {
      console.log(`  ✅ Pages: ${result.totalPages}, Text pages: ${result.totalPagesWithText}/${result.totalPages}`);
      console.log(`     Has native text: ${result.hasNativeText}`);
      console.log(`     Avg chars/page: ${result.avgCharsPerPage}`);
      console.log(`     Extraction time: ${result.extractionTimeMs}ms`);

      // Show first 100 chars of first page with text
      const firstTextPage = result.pageTexts.findIndex(t => t.trim().length > 0);
      if (firstTextPage >= 0) {
        const preview = result.pageTexts[firstTextPage].substring(0, 100).replace(/\n/g, ' ');
        console.log(`     Preview (page ${firstTextPage}): "${preview}..."`);
      }
    }
    console.log('');
  }

  // Summary
  console.log('=== Summary ===');
  console.log('| Filename | Pages | Text Pages | Has Text | Time (ms) | Status |');
  console.log('|----------|-------|------------|----------|-----------|--------|');
  for (const r of results) {
    const status = r.error ? '❌ FAIL' : '✅ OK';
    console.log(`| ${r.filename} | ${r.totalPages} | ${r.totalPagesWithText} | ${r.hasNativeText} | ${r.extractionTimeMs} | ${status} |`);
  }

  // Verify expectations
  console.log('\n=== Expectations ===');
  const smallNative = results.find(r => r.filename === 'small-native.pdf');
  if (smallNative) {
    const pass = smallNative.hasNativeText && !smallNative.error;
    console.log(`${pass ? '✅' : '❌'} small-native.pdf: should have native text = ${smallNative.hasNativeText}`);
  }

  const scanned = results.find(r => r.filename === 'scanned.pdf');
  if (scanned) {
    const pass = !scanned.hasNativeText && !scanned.error;
    console.log(`${pass ? '✅' : '❌'} scanned.pdf: should NOT have native text = ${!scanned.hasNativeText}`);
  }
}

runValidation().catch(console.error);
