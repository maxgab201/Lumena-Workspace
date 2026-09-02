// E2E test: full Lumena pipeline against the deployed Supabase project.
// Uploads a generated PDF, triggers processing, verifies extraction,
// chunks, embeddings, RAG retrieval and AI gateway SSE streaming.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const TEST_EMAIL = 'lumena.test.user.123@gmail.com';
const TEST_PASSWORD = process.env.LUMENA_TEST_PASSWORD;

if (!SUPABASE_URL || !ANON_KEY) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
if (!TEST_PASSWORD) throw new Error('Missing LUMENA_TEST_PASSWORD');

const supabase = createClient(SUPABASE_URL, ANON_KEY);

// ---------- 0. Auth ----------
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
});
if (authError) throw new Error('Auth failed: ' + authError.message);
const user = authData.user;
console.log('[auth] signed in:', user.email);
const accessToken = authData.session.access_token;

const WORKSPACE_ID = '5c9a7bda-a110-455d-987d-cb46293f08ce';

async function callFn(name, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  return res;
}

// ---------- 1. Generate test PDF ----------
async function makePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = [
    {
      title: 'Lumena E2E Test Document',
      lines: [
        'This is a test document for Lumena Workspace end-to-end processing.',
        '',
        'Chapter 1: The Zephyrium Crystal',
        'The zephyrium crystal was first catalogued in 1947 by Dr. Elena Vasquez',
        'in the Atacama Desert. It has a refractive index of 3.14159 and glows',
        'with a soft blue luminescence when exposed to barometric pressure above',
        '890 hectopascals. Only 14 specimens are known to exist worldwide.',
      ],
    },
    {
      title: 'Chapter 2: Applications',
      lines: [
        'Zephyrium crystals are used in three main applications:',
        '1. Quantum resonance imaging in medical diagnostics.',
        '2. Calibration of deep-sea pressure sensors at abyssal depths.',
        '3. Stabilization of atomic clocks in GPS satellites.',
        '',
        'The largest known specimen weighs 2.4 kilograms and is housed at the',
        'Vasquez Institute in Santiago, Chile. Its market value exceeds',
        '4.7 million US dollars per gram, making it rarer than diamond.',
      ],
    },
  ];
  for (const p of pages) {
    const page = doc.addPage([595, 842]);
    let y = 790;
    for (const line of [p.title, ...p.lines]) {
      page.drawText(line, { x: 50, y, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 20;
    }
  }
  return Buffer.from(await doc.save());
}

const pdfBytes = await makePdf();
console.log('[pdf] generated', pdfBytes.length, 'bytes');
fs.writeFileSync('scripts/e2e-test-doc.pdf', pdfBytes);

// ---------- 2. Create document record + upload ----------
const fileName = `e2e-zephyrium-${Date.now()}.pdf`;
const filePath = `${WORKSPACE_ID}/${fileName}`;

const { error: upErr } = await supabase.storage
  .from('workspace_documents')
  .upload(filePath, pdfBytes, { contentType: 'application/pdf', upsert: false });
if (upErr) throw new Error('Storage upload failed: ' + upErr.message);
console.log('[storage] uploaded', filePath);

const { data: docRow, error: docErr } = await supabase
  .from('documents')
  .insert({
    workspace_id: WORKSPACE_ID,
    name: fileName,
    size_bytes: pdfBytes.length,
    file_path: filePath,
    mime_type: 'application/pdf',
    status: 'processing',
  })
  .select()
  .single();
if (docErr) throw new Error('DB insert failed: ' + docErr.message);
console.log('[db] document created:', docRow.id);

// ---------- 3. Trigger processing (same as pg_net webhook does) ----------
// Create a real processing_job row (process-document reserves credits against it).
const { data: jobRow, error: jobErr } = await supabase
  .from('processing_jobs')
  .insert({
    workspace_id: WORKSPACE_ID,
    document_id: docRow.id,
    status: 'queued',
    progress: 0,
  })
  .select()
  .single();
if (jobErr) throw new Error('Job insert failed: ' + jobErr.message);
console.log('[db] processing job created:', jobRow.id);

console.log('[process] invoking process-document...');
const procRes = await callFn('process-document', {
  record: {
    id: jobRow.id,
    document_id: docRow.id,
    workspace_id: WORKSPACE_ID,
    status: 'queued',
  },
});
console.log('[process] HTTP', procRes.status);
const procBody = await procRes.json().catch(() => null);
if (procRes.status !== 200) {
  console.log('[process] body:', JSON.stringify(procBody));
}

// ---------- 4. Verify DB state ----------
await new Promise((r) => setTimeout(r, 4000));

const { data: finalDoc } = await supabase
  .from('documents')
  .select(
    'status, extracted_text, chunk_count, embedding_status, page_count, embedding_error'
  )
  .eq('id', docRow.id)
  .single();

console.log('=== DOCUMENT STATE ===');
console.log(JSON.stringify(
  {
    ...finalDoc,
    extracted_text_preview: finalDoc?.extracted_text?.slice(0, 150),
    extracted_text_len: finalDoc?.extracted_text?.length,
  },
  null,
  2
));

const hasPlaceholder =
  finalDoc?.extracted_text?.includes('placeholder') ||
  finalDoc?.extracted_text?.includes('Page 1 content here');
console.log('[verify] placeholder text present:', hasPlaceholder);

const { count: embCount } = await supabase
  .from('document_embeddings')
  .select('*', { count: 'exact', head: true })
  .eq('document_id', docRow.id);
console.log('[verify] embeddings rows:', embCount);

// ---------- 5. RAG test ----------
console.log('\n[rag] querying rag-retrieve...');
const ragRes = await callFn('rag-retrieve', {
  query: 'Who catalogued the zephyrium crystal and where?',
  workspace_id: WORKSPACE_ID,
  document_id: docRow.id,
  limit: 3,
  similarity_threshold: 0.3,
});
console.log('[rag] HTTP', ragRes.status);
const ragJson = await ragRes.json().catch(() => null);
console.log('[rag] results:', ragJson?.results?.length ?? 0);
if (ragJson?.results?.length) {
  console.log('[rag] top match:', JSON.stringify({
    document_id: ragJson.results[0].document_id,
    page_number: ragJson.results[0].page_number,
    similarity: ragJson.results[0].similarity,
    text_preview: ragJson.results[0].chunk_text?.slice(0, 100),
  }, null, 2));
} else if (ragJson) {
  console.log('[rag] body:', JSON.stringify(ragJson).slice(0, 300));
}

// ---------- 6. AI Gateway SSE test ----------
console.log('\n[gateway] streaming chat with RAG context...');
const gatewayRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-gateway`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    prompt: 'Who first catalogued the zephyrium crystal? Answer in one sentence and cite [1].',
    workspace_id: WORKSPACE_ID,
    action_type: 'chat',
    model_code: 'gemini-flash-latest',
    stream: true,
    document_id: docRow.id,
    context: ragJson?.results?.length
      ? {
          ragChunks: ragJson.results.map((r) => ({
            document_name: r.document_name,
            page_number: r.page_number,
            chunk_text: r.chunk_text,
          })),
        }
      : null,
  }),
});
console.log('[gateway] HTTP', gatewayRes.status, gatewayRes.headers.get('content-type'));

let chunkCount = 0;
let sawDone = false;
let sawUsage = false;
let fullText = '';
// Note: Node's undici getReader() can drop streamed bodies from Supabase Edge
// Functions; reading the full body works reliably (verified via curl -N that
// events arrive incrementally over the wire).
const sseBody = await gatewayRes.text();
for (const line of sseBody.split('\n')) {
  if (!line.startsWith('data: ')) continue;
  try {
    const ev = JSON.parse(line.slice(6));
    if (ev.chunk) {
      chunkCount++;
      fullText += ev.chunk;
    }
    if (ev.done) {
      sawDone = true;
      if (ev.usage) sawUsage = true;
    }
    if (ev.error) console.log('[gateway] stream error event:', ev.error);
  } catch {}
}
console.log('[gateway] chunks received:', chunkCount);
console.log('[gateway] done event:', sawDone, '| usage event:', sawUsage);
console.log('[gateway] response text:', fullText.slice(0, 300));

// ---------- 7. Credit accounting ----------
const { data: account } = await supabase
  .from('credit_accounts')
  .select('available, reserved, consumed')
  .eq('workspace_id', WORKSPACE_ID)
  .single();
console.log('\n[billing] account after tests:', JSON.stringify(account));

console.log('\n[test-document-id]', docRow.id);
