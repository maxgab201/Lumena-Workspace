import { expect, test } from './fixtures/auth.fixture';
import * as path from 'path';

type MockDocument = {
  id: string;
  workspace_id: string;
  name: string;
  file_path: string;
  size_bytes: number;
  mime_type: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  created_at: string;
};

test.describe('PDF upload status lifecycle', () => {
  test('opens the file picker from the visible Browse Files control', async ({ page }) => {
    await page.route('**/rest/v1/documents*', route => route.fulfill({ status: 200, json: [] }));
    await page.route('**/rest/v1/processing_jobs*', route => route.fulfill({ status: 200, json: [] }));

    await page.goto('/dashboard');
    const browseFiles = page.getByText('Browse Files', { exact: true });
    await expect(browseFiles).toBeVisible();

    const fileChooser = page.waitForEvent('filechooser', { timeout: 3_000 });
    await browseFiles.click();
    await fileChooser;
  });

  test('waits for the active workspace before enabling uploads', async ({ page }) => {
    await page.route('**/rest/v1/workspaces*', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        json: [{ id: 'ws-delayed', name: 'Delayed Workspace', owner_id: 'mock-user-id' }],
      });
    });
    await page.route('**/rest/v1/documents*', route => route.fulfill({ status: 200, json: [] }));
    await page.route('**/rest/v1/processing_jobs*', route => route.fulfill({ status: 200, json: [] }));

    await page.goto('/dashboard');
    const loadingWorkspace = page.getByRole('button', { name: 'Loading workspace…' });
    await expect(loadingWorkspace).toBeDisabled();
    const browseFiles = page.getByRole('button', { name: 'Browse Files' });
    await expect(browseFiles).toBeEnabled({ timeout: 3_000 });
  });

  test('queues every PDF selected from a multi-file picker', async ({ page }) => {
    const documents: Array<Record<string, unknown>> = [];
    const jobs: Array<Record<string, unknown>> = [];

    await page.route('**/rest/v1/documents*', async route => {
      const method = route.request().method();
      if (method === 'POST') {
        const payload = route.request().postDataJSON() ?? {};
        const document = {
          ...payload,
          id: `doc-${documents.length + 1}`,
          status: 'ready',
          created_at: new Date().toISOString(),
        };
        documents.push(document);
        await route.fulfill({ status: 201, json: document });
        return;
      }

      const hashFilter = new URL(route.request().url()).searchParams.get('file_hash');
      const matchingDocuments = hashFilter
        ? documents.filter(document => document.file_hash === hashFilter.replace(/^eq\./, ''))
        : documents;
      await route.fulfill({ status: 200, json: matchingDocuments });
    });

    await page.route('**/rest/v1/processing_jobs*', async route => {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON() ?? {};
        const job = {
          id: `job-${jobs.length + 1}`,
          workspace_id: payload.workspace_id,
          document_id: payload.document_id,
          status: 'completed',
          progress: 100,
        };
        jobs.push(job);
        await route.fulfill({ status: 201, json: job });
        return;
      }
      await route.fulfill({ status: 200, json: jobs });
    });

    await page.route('**/storage/v1/object/workspace_documents/**', route => {
      return route.fulfill({ status: 200, json: { Key: 'workspace_documents/test.pdf' } });
    });

    await page.goto('/dashboard');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Browse Files' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      path.resolve(process.cwd(), 'tests', 'fixtures', 'small-native.pdf'),
      path.resolve(process.cwd(), 'tests', 'fixtures', 'medium-native.pdf'),
    ]);

    await expect(page.getByText('small-native.pdf', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('medium-native.pdf', { exact: true }).first()).toBeVisible();
    await expect.poll(() => documents.length).toBe(2);
  });

  test('reconciles an active upload with the completed backend job', async ({ page }) => {
    let document: MockDocument | null = null;
    let jobStatus: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' = 'queued';
    let processingJobPosts = 0;

    await page.route('**/rest/v1/documents*', async (route) => {
      const method = route.request().method();

      if (method === 'POST') {
        const payload = route.request().postDataJSON() ?? {};
        document = {
          id: 'doc-status-lifecycle',
          workspace_id: payload.workspace_id ?? 'ws-1',
          name: payload.name ?? 'small-native.pdf',
          file_path: payload.file_path ?? 'ws-1/small-native.pdf',
          size_bytes: payload.size_bytes ?? 1024,
          mime_type: 'application/pdf',
          status: 'uploading',
          created_at: new Date().toISOString(),
        };

        await route.fulfill({ status: 201, json: document });
        return;
      }

      if (method === 'PATCH') {
        const payload = route.request().postDataJSON() ?? {};
        if (document) document = { ...document, ...payload };
        await route.fulfill({ status: 200, json: document });
        return;
      }

      await route.fulfill({
        status: 200,
        json: document ? [document] : [],
      });
    });

    await page.route('**/storage/v1/object/workspace_documents/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ status: 200, json: { Key: 'workspace_documents/ws-1/small-native.pdf' } });
    });

    await page.route('**/storage/v1/object/workspace_documents', async (route) => {
      await route.fulfill({ status: 200, json: [] });
    });

    await page.route('**/rest/v1/processing_jobs*', async (route) => {
      if (route.request().method() === 'POST') {
        processingJobPosts += 1;
        jobStatus = 'processing';
        if (document) document = { ...document, status: 'processing' };
      }

      await route.fulfill({
        status: route.request().method() === 'POST' ? 201 : 200,
        json: route.request().method() === 'POST'
          ? { id: 'job-status-lifecycle', document_id: 'doc-status-lifecycle', workspace_id: 'ws-1', status: jobStatus, progress: 10 }
          : [{ id: 'job-status-lifecycle', document_id: 'doc-status-lifecycle', workspace_id: 'ws-1', status: jobStatus, progress: jobStatus === 'completed' ? 100 : 10 }],
      });
    });

    await page.route('**/functions/v1/process-document', async (route) => {
      await route.fulfill({ status: 202, json: { accepted: true, job_id: 'job-status-lifecycle' } });
    });

    await page.goto('/dashboard');
    await expect(page.getByText('Click to upload or drag and drop')).toBeVisible();

    const filePath = path.resolve(process.cwd(), 'tests', 'fixtures', 'small-native.pdf');
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await expect(page.getByText(/Uploading · \d+%/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel upload of small-native.pdf' }).click();
    await expect(page.getByText('PDF uploads')).toHaveCount(0);
    await expect(page.getByTestId('document-card-doc-status-lifecycle')).toHaveCount(0);

    await page.locator('input[type="file"]').setInputFiles(filePath);

    await expect(page.getByText('small-native.pdf').first()).toBeVisible();
    const status = page.getByTestId('document-status-doc-status-lifecycle');
    await expect(status).toHaveText('Analyzing');
    await expect(status).not.toHaveText('Ready');

    jobStatus = 'completed';
    if (document) document = { ...document, status: 'ready' };

    await expect(status).toHaveText('Ready', { timeout: 5_000 });
    await expect(page.getByText('Uploading', { exact: true })).toHaveCount(0);

    jobStatus = 'failed';
    if (document) document = { ...document, status: 'error' };
    await page.reload();
    const failedStatus = page.getByTestId('document-status-doc-status-lifecycle');
    await expect(failedStatus).toHaveText('Failed');
    await page.getByText('Retry', { exact: true }).click();
    await expect(failedStatus).toHaveText('Analyzing');
    expect(processingJobPosts).toBe(2);

    jobStatus = 'completed';
    if (document) document = { ...document, status: 'ready' };
    await expect(failedStatus).toHaveText('Ready', { timeout: 5_000 });

    await page.getByTestId('document-card-doc-status-lifecycle').click();
    await expect(page).toHaveURL(/\/viewer\/doc-status-lifecycle$/);
  });
});
