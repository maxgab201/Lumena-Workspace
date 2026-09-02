# Lumena Workspace

API Specification

Version: 1.0

Status: Implemented (Edge Functions + Supabase Client)

Last Updated: 2026-07-26

---

# Table of Contents

1. API Philosophy
2. API Goals
3. Design Principles
4. Authentication
5. Authorization
6. API Versioning
7. Request Lifecycle
8. Error Handling
9. Rate Limiting
10. Response Format
11. Supabase Client Methods (Frontend → Database)
12. Edge Function Endpoints (Frontend → Backend)
13. Workspace Endpoints
14. Document Endpoints
15. Upload Endpoints
16. OCR Endpoints
17. Highlight Endpoints
18. Chat Endpoints
19. Knowledge Endpoints
20. Credits & Billing Endpoints
21. User & Settings Endpoints
22. Webhooks
23. Background Jobs
24. Streaming
25. Pagination
26. Filtering
27. Validation
28. Security
29. Logging
30. Monitoring
31. Future API

---

# 1. API Philosophy

Lumena uses a **hybrid API architecture**:

- **Direct Database Access**: Frontend uses `@supabase/supabase-js` client for CRUD operations on user-owned data (protected by RLS)
- **Edge Functions**: Business logic, AI orchestration, billing, and security-critical operations run in Deno Edge Functions
- **No REST API**: We do not expose a traditional REST API. The Supabase client *is* the API.

---

# 2. API Goals

- Zero-trust: All authorization enforced at database (RLS) and Edge Function level
- Type-safe: TypeScript types generated from database schema
- Real-time: Supabase Realtime for live updates (processing status, collaborative features)
- Provider-agnostic: AI operations abstracted through Gateway

---

# 3. Design Principles

- **Frontend never calls provider APIs directly** (OpenAI, Gemini, etc.)
- **All credit consumption happens in Edge Functions**
- **RLS policies are the primary authorization mechanism**
- **Edge Functions use `service_role` key for writes to financial tables**
- **Optimistic UI updates with server reconciliation**

---

# 4. Authentication

**Method**: Supabase Auth (JWT)

**Flow**:
1. User signs in via Email/Password, Google OAuth, GitHub OAuth, or Magic Link
2. Supabase returns access token (JWT) + refresh token
3. Client stores tokens in memory/localStorage
4. All requests include `Authorization: Bearer <access_token>`
5. RLS policies evaluate `auth.uid()` against workspace membership

**Token Refresh**: Automatic via Supabase client

**Session Persistence**: `onAuthStateChange` listener in `userStore.initialize()`

---

# 5. Authorization

**Database Level (RLS)**:
- All user-facing tables have RLS enabled
- Policies use `get_user_workspace_ids()` helper
- Users can only access data in workspaces they belong to

**Edge Function Level**:
- `ai-gateway`: Verifies workspace membership, plan limits, credit quota
- `generate-knowledge`: Verifies workspace membership, document access, credit balance
- `process-document`: Verifies credit reservation, workspace access
- `create-checkout-session`: Verifies workspace membership
- `stripe-webhook`: Validates Stripe signature, processes as `service_role`

**Frontend**: Never trusted for authorization decisions

---

# 6. API Versioning

**Database**: Migrations are additive. Breaking changes require new columns/tables.

**Edge Functions**: Versioned via URL path: `/functions/v1/<function-name>`

**Types**: Generated from DB schema (`src/types/supabase.ts`). Regenerate on migration.

---

# 7. Request Lifecycle

## Direct Database (Supabase Client)

```
Frontend (Zustand Store)
    ↓
Repository (src/repositories/*.ts)
    ↓
supabase.from('table').select/insert/update/delete
    ↓
PostgreSQL (RLS enforced)
    ↓
Response → Repository → Store → UI
```

## Edge Function

```
Frontend (Store/Component)
    ↓
supabase.functions.invoke('function-name', { body })
    ↓
Deno Edge Function (service_role)
    ↓
Business logic + DB writes (bypasses RLS for financial tables)
    ↓
Response → Frontend → Store update → UI
```

---

# 8. Error Handling

## Supabase Client Errors

```typescript
const { data, error } = await supabase.from('table').select()
if (error) throw error // PostgrestError: { message, code, details, hint }
```

## Edge Function Errors

```typescript
const { data, error } = await supabase.functions.invoke('fn', { body })
if (error) throw new Error(error.message) // FunctionsError
if (data?.error) throw new Error(data.error) // Application error from function
```

## HTTP Status Codes (Edge Functions)

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (validation) |
| 401 | Unauthorized (missing/invalid token) |
| 402 | Payment Required (insufficient credits) |
| 403 | Forbidden (plan restriction, not member) |
| 404 | Not Found |
| 422 | Unprocessable Entity (business rule) |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |

---

# 9. Rate Limiting

**AI Gateway**: 50 actions/hour per workspace (fixed window)
- Stored in `rate_limit_counters` table
- Scope: `workspace`, Metric: `actions_per_hour`
- Returns 429 when exceeded

**Document Upload**: 50MB max, PDF only

**Edge Function Invocation**: Supabase built-in limits (future: custom)

---

# 10. Response Format

## Success

```typescript
// Supabase Client
{ data: T, error: null }

// Edge Function
{ text: string, usage: { inputTokens, outputTokens, costCredits }, usedModel: string }
```

## Error

```typescript
// Supabase Client
{ data: null, error: { message, code, details, hint } }

// Edge Function
{ error: string, status?: number, required?: number, available?: number }
```

---

# 11. Supabase Client Methods (Frontend → Database)

These are the repository methods used by the frontend. All are workspace-scoped via RLS.

## Workspace Repository (`workspace.repository.ts`)

| Method | SQL Operation | Returns |
|--------|---------------|---------|
| `createWorkspace(name)` | INSERT workspaces + workspace_members | Workspace |
| `getWorkspaceById(id)` | SELECT workspaces | Workspace |
| `listWorkspaces()` | SELECT workspaces JOIN workspace_members | Workspace[] |
| `updateWorkspace(id, name)` | UPDATE workspaces | Workspace |
| `deleteWorkspace(id)` | DELETE workspaces | void |
| `getMembers(workspaceId)` | SELECT workspace_members | Member[] |
| `addMember(workspaceId, userId, role)` | INSERT workspace_members | Member |
| `removeMember(workspaceId, userId)` | DELETE workspace_members | void |

## Document Repository (`document.repository.ts`)

| Method | SQL Operation | Returns |
|--------|---------------|---------|
| `uploadFile(path, file, onProgress)` | storage.upload | UploadResult |
| `createDocumentRecord(doc)` | INSERT documents | Document |
| `createProcessingJob(workspaceId, documentId)` | INSERT processing_jobs | ProcessingJob |
| `subscribeToProcessingJobs(workspaceId, onUpdate)` | Realtime channel | Subscription |
| `getDocument(id)` | SELECT documents | Document |
| `listDocuments(workspaceId)` | SELECT documents ORDER BY created_at DESC | Document[] |
| `renameDocument(id, name)` | UPDATE documents | Document |
| `updateDocumentStatus(id, status, pageCount?)` | UPDATE documents | Document |
| `deleteDocument(id, filePath)` | storage.remove + DELETE documents | void |
| `getSignedUrl(filePath, expiresIn?)` | storage.createSignedUrl | string |

## Chat Repository (`chat.repository.ts`)

| Method | SQL Operation | Returns |
|--------|---------------|---------|
| `getOrCreateSession(documentId, workspaceId)` | SELECT/INSERT chat_sessions | ChatSession |
| `getMessages(sessionId)` | SELECT chat_messages ORDER BY created_at | ChatMessage[] |
| `addMessage(sessionId, role, content, refs?)` | INSERT chat_messages | ChatMessage |
| `updateMessage(messageId, content)` | UPDATE chat_messages | void |
| `clearSession(sessionId)` | DELETE chat_messages | void |

## Highlight Repository (`highlight.repository.ts`)

| Method | SQL Operation | Returns |
|--------|---------------|---------|
| `listHighlights(documentId)` | SELECT highlights | Highlight[] |
| `listHighlightsForPage(documentId, pageIndex)` | SELECT highlights | Highlight[] |
| `createHighlight(highlight)` | INSERT highlights | Highlight |
| `updateHighlight(id, updates)` | UPDATE highlights | Highlight |
| `deleteHighlight(id)` | DELETE highlights | void |
| `listCategories(workspaceId)` | SELECT highlight_categories | Category[] |
| `createCategory(workspaceId, name, color)` | INSERT highlight_categories | Category |

## Knowledge Repository (`knowledge.repository.ts`)

| Method | SQL Operation | Returns |
|--------|---------------|---------|
| `listFlashcards(documentId)` | SELECT flashcards | Flashcard[] |
| `addFlashcard(card)` | INSERT flashcards | Flashcard |
| `updateFlashcard(id, updates)` | UPDATE flashcards | Flashcard |
| `deleteFlashcard(id)` | DELETE flashcards | void |
| `listGlossaryTerms(documentId)` | SELECT glossary_terms | GlossaryTerm[] |
| `addGlossaryTerm(term)` | INSERT glossary_terms | GlossaryTerm |
| `updateGlossaryTerm(id, updates)` | UPDATE glossary_terms | GlossaryTerm |
| `deleteGlossaryTerm(id)` | DELETE glossary_terms | void |
| `listMindMapNodes(documentId)` | SELECT mind_map_nodes | MindMapNode[] |
| `addMindMapNode(node)` | INSERT mind_map_nodes | MindMapNode |
| `updateMindMapNode(id, updates)` | UPDATE mind_map_nodes | MindMapNode |
| `deleteMindMapNode(id)` | DELETE mind_map_nodes | void |
| `listTimelineEvents(documentId)` | SELECT timeline_events | TimelineEvent[] |
| `addTimelineEvent(event)` | INSERT timeline_events | TimelineEvent |
| `deleteTimelineEvent(id)` | DELETE timeline_events | void |
| `loadAllForDocument(documentId)` | 4 parallel SELECTs | { flashcards, glossary, mindMapNodes, timelineEvents } |

## Billing Repository (`billing.repository.ts`)

| Method | SQL Operation | Returns |
|--------|---------------|---------|
| `getSubscription(workspaceId)` | SELECT subscriptions JOIN plans | Subscription |
| `getCreditAccount(workspaceId)` | SELECT credit_accounts | CreditAccount |
| `getLedgerEntries(workspaceId)` | SELECT credit_ledger ORDER BY created_at DESC | LedgerEntry[] |
| `getCreditPackages()` | SELECT credit_packages WHERE is_active | CreditPackage[] |
| `createCheckoutSession(workspaceId, packageId)` | Edge Function invoke | { url } |

---

# 12. Edge Function Endpoints (Frontend → Backend)

## `ai-gateway`

**Invoke**: `supabase.functions.invoke('ai-gateway', { body })`

**Request**:
```typescript
{
  prompt: string,
  workspace_id: string,
  action_type: 'chat' | 'extract' | 'ocr' | 'analyze',
  model_code: 'gemini-1.5-flash' | 'gemini-1.5-pro',
  fallback_models?: string[],
  document_id?: string
}
```

**Response**:
```typescript
{
  text: string,
  usage: { inputTokens, outputTokens, costCredits },
  usedModel: string
}
```

**Errors**: 401, 402 (quota/credits), 403 (plan), 429 (rate limit), 500

---

## `generate-knowledge`

**Invoke**: `supabase.functions.invoke('generate-knowledge', { body })`

**Request**:
```typescript
{
  document_id: string,
  workspace_id: string,
  action_type: 'flashcards' | 'glossary' | 'mindmap' | 'timeline' | 'presentation'
}
```

**Response**:
```typescript
{
  items: Flashcard[] | GlossaryTerm[] | MindMapNode[] | TimelineEvent[] | Presentation[],
  count: number,
  warning?: string // if presentations table not yet created
}
```

**Errors**: 401, 402, 403, 404, 422 (insufficient text), 500

---

## `process-document`

**Triggered by**: Database INSERT on `processing_jobs` (via Supabase Database Webhook) OR manual invoke

**Request** (from webhook payload):
```typescript
{
  record: {
    id: string,        // job id
    document_id: string,
    workspace_id: string,
    status: 'queued'
  }
}
```

**Response**: `{ success: true, jobId, cost }` or error

---

## `create-checkout-session`

**Invoke**: `supabase.functions.invoke('create-checkout-session', { body })`

**Request**:
```typescript
{
  workspace_id: string,
  package_id: string,
  success_url: string,
  cancel_url: string
}
```

**Response**:
```typescript
{ url: string, mocked?: boolean }
```

**Errors**: 401, 403, 404, 500

---

## `stripe-webhook`

**Endpoint**: `POST /functions/v1/stripe-webhook`

**Headers**: `stripe-signature`

**Body**: Raw Stripe event JSON

**Handled Events**:
- `checkout.session.completed` → Grant credits via ledger

**Response**: `{ received: true }` (200) or error (400)

---

# 13. Workspace Endpoints

| Operation | Method |
|-----------|--------|
| Create Workspace | `WorkspaceRepository.createWorkspace(name)` |
| List Workspaces | `WorkspaceRepository.listWorkspaces()` |
| Get Workspace | `WorkspaceRepository.getWorkspaceById(id)` |
| Update Workspace | `WorkspaceRepository.updateWorkspace(id, name)` |
| Delete Workspace | `WorkspaceRepository.deleteWorkspace(id)` |
| Get Members | `WorkspaceRepository.getMembers(workspaceId)` |
| Add Member | `WorkspaceRepository.addMember(workspaceId, userId, role)` |
| Remove Member | `WorkspaceRepository.removeMember(workspaceId, userId)` |

---

# 14. Document Endpoints

| Operation | Method |
|-----------|--------|
| Upload Document | `DocumentRepository.uploadFile()` + `createDocumentRecord()` |
| List Documents | `DocumentRepository.listDocuments(workspaceId)` |
| Get Document | `DocumentRepository.getDocument(id)` |
| Rename Document | `DocumentRepository.renameDocument(id, name)` |
| Update Status | `DocumentRepository.updateDocumentStatus(id, status, pageCount)` |
| Delete Document | `DocumentRepository.deleteDocument(id, filePath)` |
| Get Signed URL | `DocumentRepository.getSignedUrl(filePath)` |
| Subscribe to Processing | `DocumentRepository.subscribeToProcessingJobs(workspaceId, callback)` |

---

# 15. Upload Endpoints

**Flow**:
1. `DocumentRepository.uploadFile(path, file)` → Supabase Storage
2. `DocumentRepository.createDocumentRecord({ workspace_id, name, size_bytes, file_path, mime_type })`
3. `DocumentRepository.createProcessingJob(workspaceId, documentId)` → triggers `process-document` Edge Function via DB webhook
4. Real-time updates via `subscribeToProcessingJobs()`

---

# 16. OCR Endpoints

**No direct OCR endpoint.** OCR runs as part of `process-document` pipeline.

**Provider Framework** (for future extensibility):
- `ProviderRegistry.listByCapability('ocr')`
- `ProviderRouter.getBestProvider('ocr', documentProfile)`
- `ProviderFallback.executeWithFallback(['surya-ocr', 'tesseract-ocr'], fn)`

---

# 17. Highlight Endpoints

| Operation | Method |
|-----------|--------|
| List Highlights | `HighlightRepository.listHighlights(documentId)` |
| List for Page | `HighlightRepository.listHighlightsForPage(documentId, pageIndex)` |
| Create Highlight | `HighlightRepository.createHighlight(highlight)` |
| Update Highlight | `HighlightRepository.updateHighlight(id, updates)` |
| Delete Highlight | `HighlightRepository.deleteHighlight(id)` |
| List Categories | `HighlightRepository.listCategories(workspaceId)` |
| Create Category | `HighlightRepository.createCategory(workspaceId, name, color)` |

---

# 18. Chat Endpoints

| Operation | Method |
|-----------|--------|
| Get/Create Session | `ChatRepository.getOrCreateSession(documentId, workspaceId)` |
| Get Messages | `ChatRepository.getMessages(sessionId)` |
| Send Message | `ChatRepository.addMessage()` + `AIGateway.generateStream()` |
| Update Message | `ChatRepository.updateMessage(messageId, content)` |
| Clear Session | `ChatRepository.clearSession(sessionId)` |

---

# 19. Knowledge Endpoints

| Operation | Method |
|-----------|--------|
| Load All for Document | `KnowledgeRepository.loadAllForDocument(documentId)` |
| Flashcards CRUD | `listFlashcards`, `addFlashcard`, `updateFlashcard`, `deleteFlashcard` |
| Glossary CRUD | `listGlossaryTerms`, `addGlossaryTerm`, `updateGlossaryTerm`, `deleteGlossaryTerm` |
| Mind Map CRUD | `listMindMapNodes`, `addMindMapNode`, `updateMindMapNode`, `deleteMindMapNode` |
| Timeline CRUD | `listTimelineEvents`, `addTimelineEvent`, `deleteTimelineEvent` |
| Generate (AI) | `knowledgeStore.generateFlashcards/Glossary/MindMap/Timeline/Presentation()` → Edge Function |

---

# 20. Credits & Billing Endpoints

| Operation | Method |
|-----------|--------|
| Get Subscription | `BillingRepository.getSubscription(workspaceId)` |
| Get Credit Account | `BillingRepository.getCreditAccount(workspaceId)` |
| Get Ledger | `BillingRepository.getLedgerEntries(workspaceId)` |
| Get Packages | `BillingRepository.getCreditPackages()` |
| Checkout | `BillingRepository.createCheckoutSession(workspaceId, packageId)` |
| Fetch All | `billingStore.fetchBillingData()` (parallel) |

**Note**: Frontend cannot directly consume credits. All consumption happens in Edge Functions.

---

# 21. User & Settings Endpoints

| Operation | Method |
|-----------|--------|
| Get User | `AuthRepository.getUser()` |
| Get Session | `AuthRepository.getSession()` |
| Sign Up | `AuthRepository.signUp(email, password, options)` |
| Sign In (Password) | `AuthRepository.signInWithPassword(email, password)` |
| Sign In (OAuth) | `AuthRepository.signInWithOAuth(provider, redirectTo)` |
| Sign Out | `AuthRepository.signOut()` |
| Reset Password | `AuthRepository.resetPasswordForEmail(email, redirectTo)` |
| Update User | `AuthRepository.updateUser({ password, data })` |
| Get Settings | `SettingsRepository.getSettings()` |
| Update Settings | `SettingsRepository.updateSettings({ theme, view_mode, ... })` |

---

# 22. Webhooks

## Stripe Webhook

**URL**: `https://<project>.supabase.co/functions/v1/stripe-webhook`

**Events Handled**:
- `checkout.session.completed` → Grant credits to workspace

**Verification**: Stripe signature header validation (future: implement in Edge Function)

**Idempotency**: `payment_events.external_event_id` UNIQUE

---

# 23. Background Jobs

**Processing Jobs**: Created via `processing_jobs` table, picked up by `process-document` Edge Function (triggered by Supabase Database Webhook on INSERT).

**Job Status Flow**:
```
queued → inspecting → extracting → ocr → layout → completed
                    ↘ failed (on error)
```

**Real-time Updates**: Frontend subscribes via `DocumentRepository.subscribeToProcessingJobs()`

---

# 24. Streaming

**Chat Streaming**: `AIGateway.generateStream()` mocks streaming by chunking the synchronous Edge Function response.

**Future**: Native streaming via Edge Function `ReadableStream` response.

**Knowledge Generation**: Synchronous (returns complete JSON array).

---

# 25. Pagination

**Not yet implemented.** Current queries return full result sets.

**Future**:
```typescript
// Supabase Client
supabase.from('table').select().range(offset, offset + limit - 1)
// or cursor-based
supabase.from('table').select().lt('created_at', cursor).limit(limit)
```

---

# 26. Filtering

**Current**: Repository methods accept filter parameters (workspaceId, documentId, etc.)

**Future**: Generic filter builder for complex queries.

---

# 27. Validation

**Frontend**: TypeScript types + Zod (future) for form validation

**Edge Function**: Manual validation in Deno (no Zod in Deno std yet)

**Database**: CHECK constraints, NOT NULL, FK, ENUMs

---

# 28. Security

- All Edge Functions verify `Authorization: Bearer <token>`
- RLS policies enforce workspace isolation
- Financial tables only writable by `service_role`
- Rate limiting in `ai-gateway`
- Prompt injection detection in `ai-gateway`
- Circuit breaker in `ai-gateway`
- File type/size validation in `document.repository.ts`
- Signed URLs for private file access (1hr TTL)

---

# 29. Logging

**Edge Functions**: `console.log/error/warn` → Supabase Logs

**Database**: 
- `processing_logs` (per-job)
- `security_events` (abuse detection)
- `credit_ledger` (immutable audit)
- `usage_jobs` (AI metering)

---

# 30. Monitoring

**Current**: Supabase Dashboard (Logs, Database, API, Realtime)

**Future**:
- Sentry (errors)
- Better Stack (logs)
- Vercel Analytics (frontend)
- Custom dashboards (credits, usage, errors)

---

# 31. Future API

- **Public REST API**: `/api/v1/...` with API keys
- **GraphQL**: For flexible knowledge graph queries
- **WebSocket**: Real-time collaboration
- **SDK**: TypeScript/Python client libraries
- **Plugin System**: Custom Edge Functions
- **Enterprise API**: SCIM, SSO, Audit Logs