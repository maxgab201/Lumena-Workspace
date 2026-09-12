// Upload a fixture PDF to production via the Supabase REST API using the
// QA user session — the same flow the app performs (storage + document row).
import fs from 'fs';
const SUPABASE_URL = 'https://nsjetmjtwbhellqasggw.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zamV0bWp0d2JoZWxscWFzZ2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3ODA5NDYsImV4cCI6MjA5OTM1Njk0Nn0.ueBlzTVAaNMezBqsVIczcO6-ogiJyML340pGwwpPN1s';

const filePath = process.argv[2];
const fileName = process.argv[3];
const workspaceId = process.argv[4] || '7e80d862-e553-44ab-b710-1a2d972f9007';

const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'lumena-staging-e2e-test@example.com', password: 'test123456' }),
});
const { access_token } = await auth.json();

const bytes = fs.readFileSync(filePath);
const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
const fileHash = Array.from(new Uint8Array(hashBuf), b => b.toString(16).padStart(2, '0')).join('');
const storagePath = `${workspaceId}/${fileHash}.pdf`;

// 1. Upload to storage
const up = await fetch(`${SUPABASE_URL}/storage/v1/object/workspace_documents/${storagePath}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${access_token}`, apikey: ANON, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
  body: bytes,
});
if (!up.ok && up.status !== 409) {
  console.error('storage upload failed:', up.status, await up.text());
  process.exit(1);
}

// 2. Duplicate check (like the app)
const dup = await fetch(`${SUPABASE_URL}/rest/v1/documents?select=id&workspace_id=eq.${workspaceId}&file_hash=eq.${fileHash}`, {
  headers: { Authorization: `Bearer ${access_token}`, apikey: ANON },
});
const dups = await dup.json();
if (dups.length > 0) {
  console.log(JSON.stringify({ id: dups[0].id, duplicate: true }));
  process.exit(0);
}

// 3. Create the document row
const doc = await fetch(`${SUPABASE_URL}/rest/v1/documents`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${access_token}`, apikey: ANON, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({
    workspace_id: workspaceId,
    name: fileName,
    size_bytes: bytes.length,
    file_path: storagePath,
    file_hash: fileHash,
    mime_type: 'application/pdf',
    status: 'processing',
  }),
});
const [docRow] = await doc.json();

// 4. Queue the processing job (DB trigger calls process-document)
await fetch(`${SUPABASE_URL}/rest/v1/processing_jobs`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${access_token}`, apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ workspace_id: workspaceId, document_id: docRow.id, status: 'queued', progress: 0 }),
});
console.log(JSON.stringify({ id: docRow.id, status: docRow.status }));
