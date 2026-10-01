# Lumena Workspace

<!-- LUMENA_AUTO_STATUS_START -->
> [!NOTE]
> **Automated project status — source of truth for current implementation state.**
> Synced from `docs/project-status.json` at commit [`cd78ef6`](https://github.com/maxgab201/Lumena-Workspace/commit/cd78ef6e11495bceba7e614fd39203b738868a3f) on `2026-09-22T16:06:20-03:00` (branch `main`). If older prose below conflicts with this block, this generated block wins.

- **Lifecycle:** Alpha
- **Current focus:** Core Reading Experience
- **Current checkpoint:** Reader Validation & Preview Review
- **Status:** active-development
- **Completed:**
  - Workspace and document dashboard foundation
  - PDF upload and resilient processing for large documents
  - PDF viewer with virtualization, zoom and rotation
  - Manual highlights, notes and reactive annotations
  - Per-page native-text/OCR inventory
  - Semantic AI highlights grounded to real PDF geometry
  - Reader-connected AI chat with selection/page context
  - Chat-triggered highlight actions
  - Persistent profile/settings controls
  - Lumena blue brand system, logo lockups and favicon
  - PDF-native logical page labels with roman/front-matter support
  - Manual logical-to-physical page mapping with sequential corrections
  - Logical page-aware chat and bounded AI-highlight page ranges
  - Real in-document native-text/OCR search with Ctrl/Cmd+F
  - Citation cards that display logical page labels while navigating physical PDF pages
  - Persistent logical page corrections deployed to Supabase with workspace-bound RLS
  - Logical-page AI gateway and page-range highlight authorization deployed to Supabase
- **In progress:**
  - Final preview/manual reader review before merging the feature branch
- **Next:**
  - Search-result text highlighting and richer semantic navigation
  - Reader polish from preview feedback
  - Knowledge tools completion after the reader core is stable
- **Product rules:**
  - Core reading remains usable without AI credits
  - AI semantics never invent PDF geometry
  - Provider-specific AI logic stays behind the gateway/service layer
  - Documentation status is synchronized automatically from this file
<!-- LUMENA_AUTO_STATUS_END -->

Changelog

Version: 1.0.0-rc.1

Status: Living Document

Last Updated: 2026-09-02

---

# Table of Contents

1. Changelog Policy
2. Versioning
3. Release Types
4. Release Checklist
5. Release History
6. Upcoming Changes
7. Breaking Changes
8. Migration Notes
9. Known Issues
10. Contributors

---

# 1. Changelog Policy

- Every completed block/phase must update this document.
- Never release undocumented changes.
- Every release should include: Added, Changed, Improved, Fixed, Removed, Deprecated, Security, Performance, Documentation, Infrastructure.
- Follow [Keep a Changelog](https://keepachangelog.com/) format.

---

# 2. Versioning

**Semantic Versioning**: MAJOR.MINOR.PATCH

| Version | When |
|---------|------|
| PATCH | Bug fixes, small improvements, documentation |
| MINOR | New features, backwards compatible |
| MAJOR | Breaking changes, architecture redesign |

**Current**: `1.0.0-rc.1` (Phase 11 Release Candidate)

**Pre-release tags**: `-alpha`, `-beta`, `-rc.N`

---

# 3. Release Types

| Type | Description | Trigger |
|------|-------------|---------|
| Development | Local dev builds | `pnpm dev` |
| Preview | PR validation | GitHub PR opened/updated |
| Staging | Pre-production | Merge to `main` |
| Release Candidate | Pre-release testing | Tag `vX.Y.Z-rc.N` |
| Stable | Production | Tag `vX.Y.Z` |
| Hotfix | Critical fix | Tag `vX.Y.Z+1` |

---

# 4. Release Checklist

- [ ] All CI checks pass (lint, typecheck, build, tests)
- [ ] E2E critical paths pass
- [ ] Manual release checklist complete (see DEPLOYMENT.md)
- [ ] Accessibility audit (axe + manual)
- [ ] Performance budgets met (Lighthouse > 90)
- [ ] Security review (dependencies, secrets, headers)
- [ ] Documentation updated (CHANGELOG, relevant docs)
- [ ] Database migrations applied to staging
- [ ] Edge Functions deployed to staging
- [ ] Stripe webhooks configured for staging
- [ ] Smoke tests on staging
- [ ] Tag release (`git tag vX.Y.Z && git push origin vX.Y.Z`)
- [ ] Production deploy
- [ ] Post-deploy verification

---

# 5. Release History

## [Unreleased] - 2026-09-30 — Audit round 1

### Security

- `ai-gateway` now verifies workspace membership (and that the document belongs to that workspace) before touching quota, credits or the usage ledger. It ran on the service-role client without the check every other user-facing function has.
- Untrusted text (PDF text, OCR, page labels, file names, highlights, earlier turns) is neutralised before it enters the chat prompt, and prompt payload sizes are bounded.
- A static guard test asserts that every user-facing Edge Function checks membership before using workspace data.

### Fixed

- Per-user state (workspace, documents, chat, credits) is reset on sign-out and when the account changes; settings load on sign-in.
- Uploads keep the workspace they were queued for; deleting the active workspace reloads the next one; deleting a workspace or document removes its Storage objects (row first, files after).
- AI Highlight replaces old AI highlights per page only after that page succeeded (a failed re-run no longer erases them).
- Page references ("páginas 50 a 55", "pág. 12") are parsed with word boundaries; ordinary words no longer produce phantom pages.
- The stale-job watchdog re-runs while documents process; cancelled jobs are no longer resurrected by an in-flight `process-document` run; documents over 1000 pages no longer chain into themselves forever.
- The chat runs in the workspace of the document being read; the Study Mode "Ask" tab sends a request the gateway can answer.
- The notification center and the notification preferences are labelled as not available yet.

## [Unreleased] - 2026-10-01 — Audit round 3

### Changed

- **Presentations is behind a feature flag and makes no request while it is off.** Opening a document used to ask for the `presentations` table, which does not exist in production, and logged a 404 (PGRST205) on every open, with the error swallowed afterwards. `VITE_FEATURE_PRESENTATIONS` (build time, off unless `true`/`1`, see `.env.example` and `src/config/features.ts`) now gates it: while it is off `loadAllForDocument` does not call `listPresentations`, every presentation method of the repository and `generatePresentation` refuse before making a request, and the Knowledge sidebar offers no Presentation tab and no "Generate Presentation". The table, its migration and the Edge Function support are left as they are for when the feature is turned on. Verified in a real browser with a real QA login: opening a document sends 0 requests to `/presentations` and gets 0 404s. Pinned by `tests/unit/presentations-feature-flag.test.tsx` (including that the loader does not even call the repository, and that every repository method that reaches the table is guarded); the production E2E no longer tolerates presentations errors.

### Verified in production (after merging audit round 2, `main` at `6e9d50b`)

- With browser storage blocked the app renders (it was a blank page) and login, upload, the reader and the page-label editor work; security headers are served.
- A `/Rotate 90` page is displayed landscape (`data-main-rotation` 90), a highlight lands on its text (IoU 1.00), stays after rotating 90° more and after reload; OCR of a sideways `/Rotate 90` scan reads the same six lines as the upright one (6 of 6 known words).
- One selection + double-click saves one highlight; a failed save keeps the toolbar and a retry after the network returns saves it; Ctrl+F `Mach*ne` no longer matches "Machine"; a long OCR search lists 60 pages (about 15 before); labels "mid" and "iiii" are stored as typed while "iv" still continues the sequence.

## [Unreleased] - 2026-09-30 — Audit round 2 (production smoke)

### Fixed

- **Free-plan chat answered 500 for every model.** The Free Gemini models declared by the model catalog (`gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`) had no row in `provider_models`, and the gateway refuses a model it cannot price; the seeded OpenRouter `:free` model had been retired upstream (404 "unavailable for free"). New migration `20260930000002_register_free_gemini_models.sql` registers the two Gemini models.
- The catalog no longer offers a seeded OpenRouter model that OpenRouter's live list has dropped, and the Free OpenRouter models it discovers at runtime (never in the registry) now run unmetered instead of failing with "not found or inactive". A Pro model without a price is still refused.
- `ai-gateway` rejects a non-string `prompt` / `workspace_id` with 400 instead of passing it to the provider (500 after spending a quota unit).
- **One failed embedding threw away its whole batch.** When the embedding provider answered 429 for some chunks (production: 21 of 120), the empty vectors made the database reject all 100 rows of the batch ("vector must have at least 1 dimension") and stopped every later batch, so a 120-page document kept no embeddings at all. `process-document` now leaves out only the chunks without an embedding (production after the fix: 105 of 120 stored) and records "Partially indexed: N of M chunks".
- **A Free-plan request that got no answer still cost a unit of the daily quota.** `ai-gateway` takes the unit before it calls a provider, so when every provider failed, or the request was refused afterwards (hourly rate limit, circuit breaker, no allowed model), the user lost a unit for nothing (19 of 50 in one day on the QA workspace). New migration `20261001000002_refund_ai_request.sql` adds `refund_ai_request(workspace, day)`, callable only by `service_role`, which only lowers `chat_count` (never below 0) for the day the unit was taken; the gateway gives the unit back at most once on those paths. A prompt blocked for injection is still charged. Verified live: a request refused with 503 leaves the quota unchanged, a successful one costs exactly one, and member, non-member and anonymous callers cannot call the refund RPC.
- **A scanned PDF of three or more pages was not recognised as scanned.** The `---PAGE n---` markers were counted as text, so it skipped the scanned-document path and ended with `embedding_status = completed` and zero chunks instead of waiting for OCR.
- **The reader loaded no flashcards, glossary, mind map or timeline in production.** `loadAllForDocument` used `Promise.all`, and the `presentations` table does not exist in that database (PostgREST 404 / PGRST205, although its migration is recorded as applied), so that one failure emptied every knowledge section for every document. Each section now loads on its own; the error still surfaces when all of them fail.
- Opening the chat could log a 409 on `POST /chat_sessions` and fail the session load: two callers raced past the "does a session exist?" lookup and the loser hit the `(document_id, user_id)` unique constraint. It now reads the session the winner created, and callers that ask for the same session at the same moment share one lookup/insert, so the reader no longer sends the losing request at all.
- **A member could point a document at another workspace's Storage prefix.** `move_document_workspace` stored any `p_new_file_path`, and the documents UPDATE policy has no column restriction; `process-document` downloads `file_path` with the service-role key. New migration `20261001000001_documents_file_path_in_workspace_prefix.sql` adds `CHECK (file_path LIKE workspace_id::text || '/%')`, which closes every writer at once (the 27 existing rows already conformed). Verified live: the RPC with a foreign path and a direct PATCH both fail with 23514, renaming inside the own prefix and a legitimate A↔B move still work.
- **In-document search (Ctrl+F) treated `*` as a wildcard.** PostgREST rewrites every `*` in an `ilike` value to `%` and offers no escape (verified in production: `name=ilike.%My*Space%` matched "My Workspace"), so searching `2*3` listed pages with "2x3" or "2 apples 3". The pattern now sends `_` for `*` and drops the rows that do not contain the literal text; queries without `*` behave exactly as before.
- **Searching a very common word in a scanned PDF only reached the first pages.** The OCR read stopped at 180 matching segments, so with ~12 matches per page a word like "the" listed about 15 pages of a 300-page scan. It now reads in batches of 500 segments until the 60 wanted pages are complete (at most 6 batches), keeping what it already read if a later batch fails.
- **With browser storage blocked, production rendered a blank page.** Reading `window.localStorage` throws a SecurityError when the browser blocks site data (Safari "block all cookies", Firefox strict mode, a sandboxed iframe), and the i18n module read it while it was being imported, so the whole app died with "The operation is insecure." (reproduced against the production site: `#root` empty). Every remaining raw storage access (language, AI Highlight model preference, theme fallback, local page-label fallback) now goes through `src/lib/safeStorage.ts`, which never throws; a static test keeps new code from reading storage unguarded. With the fix, login, upload, the reader and the page-label editor work in the same blocked-storage browser (the session simply does not survive a reload, as no browser would let it).
- **A double-click on a highlight colour saved the highlight twice.** The second click arrived before the first save returned and the selection was cleared, so the editor inserted the same highlight again (reproduced in a real browser against production data: one selection + double-click = 2 rows). The editor now ignores clicks while a save is in flight. If a save fails (the store already shows the "Failed to save highlight" toast) the toolbar and the selection stay, so one click retries it instead of making the user select the text again.
- **A PDF page with its own `/Rotate` was displayed unrotated.** Scanners and phone-scanner apps commonly store pages sideways and set `/Rotate 90`/`270` so viewers turn them upright. The reader passed its own rotation (0) to react-pdf, which treats an explicit `rotate` as absolute and only uses the page's own value when none is given, so such scans showed sideways and looked identical to a file without `/Rotate` (reproduced in a real browser: `data-main-rotation` "0", portrait). The page's own rotation is now read when it loads and the reader's rotate button adds to it; highlights are stored in the unrotated page frame and are now drawn at the rotation the page is really displayed at. Verified live: the `/Rotate 90` page is landscape, a highlight lands exactly on its text (IoU 1.00), stays on it after rotating 90° more and after a reload; a file without `/Rotate` behaves as before.
- **OCR returned garbage for scans stored sideways with `/Rotate`.** The OCR rasterised every page at rotation 0, so a scan stored sideways (what scanner apps produce, with `/Rotate 90` so viewers show it upright) reached Tesseract as sideways pixels: in a real browser the same scan stored upright gave all six lines and every known word, the `/Rotate 90` copy gave 16 junk segments and none, which also left Ctrl+F and AI Highlight useless on such documents. OCR now draws the page the way a viewer shows it, groups words into lines and sentences there (text runs horizontally; grouping them on the sideways frame scrambled the sentences), and maps only the finished rects back to the unrotated page every stored rect uses (`rectToCanonical`, the exact inverse of how highlights are drawn, pinned for all four rotations). Verified live: the `/Rotate 90` scan now yields the same six lines in order, and the stored title rect, drawn at the page's rotation, lands exactly where the upright scan's rect does.
- **The page-label editor could stay stuck on "Guardando…".** It wrote its local fallback to localStorage before its own try/catch, so a full or blocked storage threw before the database save was even attempted.
- **A page label the user typed could be rewritten.** Typing a word made of roman letters ("mid", "dim") or a variant numeral ("iiii") with "continue the sequence" on stored the canonical numeral instead ("mcdxcix", "iv"). Only canonical numerals continue a sequence now; anything else is saved exactly as typed.

### Security

- The hosting config now sends `X-Frame-Options: DENY` (and CSP `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that turns off camera, microphone and geolocation. Production sent only HSTS, so the app could be framed (clickjacking). A script-src CSP is deliberately not added: PDF.js and Tesseract load code and data from unpkg/jsDelivr, and it needs its own rollout.
- Pinned that assistant output (hostile input, built from PDF text) renders without raw HTML and without `javascript:`/`data:` links.

### Verified in production

- Live attack matrix with a second QA account against the first one's real data: all 49 public tables read as the other user and as anonymous (none returns the victim's workspace id, user id or content); cross-workspace writes (documents, highlights, flashcards, chat, jobs, memberships, workspace name/delete, self-promotion to owner); billing and quota tampering in the attacker's own workspace (plan, credits, ledger, daily quota, rate limits, purchases, `consume_ai_request`); Storage sign/download/list/upload/move/copy/remove across prefixes, in both directions. Every attempt is refused.
- Real-browser run with a real QA login and no mocks: dashboard, reader, Ctrl+F search (5 results), chat answering "la página 2" and "pág. 3" with a real model, account switch showing none of the previous account's documents.
- Cancelling a 900-page job mid-flight leaves it cancelled (heartbeat frozen), and the retry completes with 900/900 pages; the stale-job watchdog fails only a stale job in the caller's own workspaces (a non-member reaps nothing, anonymous gets 401).

- A user who is not a member of a workspace gets 403 from `ai-gateway` for that workspace, with a normal prompt, an injection phrase, a Pro model or a document id; nothing is written to the victim's quota, usage ledger, rate-limit counters or security events. The same non-member also gets 403 from `ai-highlight`, `create-highlights`, `generate-knowledge`, `rag-retrieve` and `ai-config`.

### Infrastructure

- `pnpm typecheck` now runs `tsc -b` (the previous command checked nothing). Coverage is measured over all of `src` with honest floors.

## [Unreleased] - 2026-09-02 — Core Reading Experience: Checkpoint 1

### Added

- Real upload progress, queued multi-PDF uploads, cancellation, retry, and duplicate detection.
- User-facing document stages derived from persisted processing jobs: Uploaded, Processing, OCR, Analyzing, Ready, and Failed.
- Realtime document/job subscriptions with active polling reconciliation and processing retry.

### Fixed

- Documents no longer remain stuck at Uploading when a fast processing event is missed.
- Core PDF processing is no longer blocked by the not-yet-approved billing system.
- Partial upload failures clean up Storage and document rows instead of leaving ghost documents.
- The PDF viewer now measures its page container after loading and reports invalid PDF errors clearly.

### Removed

- Non-functional document search and developer overlay controls from the user-facing PDF toolbar.
- The Dashboard Global AI Search call-to-action that had no action attached.

## [1.0.0-rc.1] - 2026-07-27 — Phase 11 Release Candidate

### Added

- **Phase 10: Knowledge Tools** — Flashcards, Glossary, Mind Maps, Timelines with Study Mode
  - `knowledgeStore` with Flashcard, GlossaryTerm, MindMapNode, TimelineEvent types
  - `KnowledgeSidebar` with tabbed navigation (Flashcards | Glossary | Mind Map | Timeline)
  - `FlashcardsView` / `GlossaryView` with add/edit/delete + AI generation
  - `MindMapView` / `TimelineView` — placeholder UIs (Phase 23)
  - `StudyModeOverlay` — immersive 3D flip flashcard review (Space=flip, Arrows=nav, Esc=close)
  - `KnowledgeCard` / `FlashcardFlip` reusable components
  - `generate-knowledge` Edge Function v2 — supports `flashcards`, `glossary`, `mindmap`, `timeline`, `presentation` action_types
  - Credit cost: 10 credits per knowledge generation

- **Phase 9: Billing & Credits System**
  - `billingStore` — plan, credits, buckets, history, subscriptions
  - `BillingPage` — PlanComparison, CreditUsageBar, CreditHistory, PurchaseCredits, SubscriptionStatus
  - `UpgradeModal` — glassmorphic package selection + Stripe Checkout
  - Ledger-based credit system: immutable `credit_ledger`, reservations, buckets, monthly quotas
  - Free: 50 credits/month | Pro: 1,000 credits/month | Max: 10,000 credits/month
  - Circuit breaker: 10,000 credits/day/workspace
  - Rate limiting: 50 actions/hour/workspace
  - `create-checkout-session` / `stripe-webhook` Edge Functions
  - Credit costs: Chat (Flash: 1, Pro: 5), Knowledge (10), OCR (2/page), Processing (5/doc)

- **Phase 8: Chat System**
  - `chatStore` — messages, streaming, model selection, abort controller
  - `ChatSidebar` — integrated in Viewer right sidebar
  - `ChatMessage` — user/assistant/system bubbles, citations, streaming
  - `ChatInput` — auto-resize textarea, model selector, credit estimate
  - `ModelSelector` — plan-gated (Free: Flash only; Pro: Flash + Pro)
  - Streaming via `AIGateway.generateStream()` with chunked response
  - Credit reservation → generation → settlement flow

- **Phase 7: Highlights System**
  - `highlightStore` — highlights, editor state, selection→PDF coords
  - `HighlightEngine` — DOM Selection → normalized % coordinates (0.0-1.0)
  - `HighlightOverlay` — renders highlights as CSS % positioned divs (zoom-invariant)
  - `HighlightEditor` — floating toolbar on text selection (5 colors, note, save/cancel)
  - `HighlightSidebar` — document highlights list, grouped by page, jump to page
  - 5 highlight colors: Yellow, Green, Blue, Pink, Purple (CSS variables)
  - Persisted to `highlights` table with RLS

- **Phase 6: AI Gateway**
  - `AIGateway` service class — unified router for all LLM calls
  - Provider Framework: `AIProvider` interface, Registry, Router, Fallback
  - `MockAIProvider` — deterministic responses for dev/test/CI
  - Plan enforcement, credit quotas, rate limiting (50/hr), circuit breaker (10k/day)
  - Prompt injection detection (regex-based, logs to `security_events`)
  - Streaming support (`generateStream`)

- **Phase 5: UI Overlay System**
  - CSS-percentage coordinate system for all overlays (zoom-invariant)
  - `LayoutOverlay` — structural elements (titles, paragraphs, images, tables) — blue
  - `OCROverlay` — OCR text blocks — green
  - `VisionOverlay` — semantic AI detections — violet
  - `HighlightOverlay` — user highlights — 5 colors
  - Layers toggle in `PDFToolbar` (OCR, Layout, Vision, Highlights)

- **Phase 4: PDF Viewer & Virtualization**
  - `PDFViewer` — root viewer, document load, keyboard shortcuts
  - `PDFPageList` — @tanstack/react-virtual virtualized thumbnails (300+ pages)
  - `PDFPage` — layered architecture: Canvas + OverlayContainer
  - `PDFToolbar` — navigation, zoom, rotation, layers, sidebar toggles
  - Keyboard shortcuts: ←/→ (nav), +/- (zoom), 0/W (fit), R (rotate), H/L (layers/sidebars)
  - Page registry store — per-page OCR/layout/vision status

- **Phase 3: Workspace Experience**
  - Three-panel layout: Sidebar | Main | Right Sidebar
  - `WorkspaceSidebar` — workspace switcher, nav (Documents, Chat, Knowledge, Settings)
  - `Dashboard` — workspace grid/list, empty state with drag-drop upload
  - `DocumentCard` — thumbnail, metadata, status badge, credit cost
  - `UploadZone` — drag-drop, validation (PDF, ≤50MB), progress
  - Workspace CRUD (create, rename, delete) with optimistic UI
  - `ActivityFeed` — mock recent activity (right sidebar)

- **Phase 2: Auth & Data Foundation**
  - Supabase Auth: Email/Password, Google OAuth, GitHub OAuth
  - `userStore` — session, profile, auth actions
  - `workspaceStore` — workspaces, members, current workspace
  - Auto-provisioning: `auth.users` insert trigger → profile + "My Workspace"
  - RLS policies on all tables via `get_user_workspace_ids()`
  - Protected routes with `LoadingPage` session restoration

- **Phase 1: Foundation**
  - React 19 + TypeScript 6 + Vite 8 + Tailwind v4
  - Radix UI primitives + Framer Motion + Zustand + TanStack Virtual
  - Design system: colors, typography, spacing, radius, shadows, glassmorphism
  - UI primitives: 30+ components (Button, Input, Dialog, Sheet, DropdownMenu, etc.)
  - Landing page: mesh gradient hero, features, viewer preview, pricing
  - App shell: `AppLayout`, `ViewerLayout`, `Topbar`, `Sidebar`, `RightSidebar`

### Changed

- **Architecture**: Migrated from monolithic processing to Provider Framework (Phases 6-7)
- **State Management**: Consolidated to 9 Zustand stores with Immer middleware
- **Overlay System**: Unified CSS-percentage coordinate system (ADR-0008, ADR-0010)
- **Billing**: Replaced simple credit counter with ledger + reservations + buckets
- **AI Access**: All LLM calls routed through `AIGateway` Edge Function (plan enforcement)
- **Documentation**: Complete rewrite of all 19 docs to match implementation

### Improved

- **Performance**: Virtualized PDF thumbnails (60fps at 500 pages)
- **UX**: Optimistic updates, loading skeletons, toast notifications, command palette (⌘K)
- **Accessibility**: Radix primitives guarantee ARIA, focus management, keyboard nav
- **Developer Experience**: Oxlint (fast lint), Vitest (fast tests), TypeScript strict mode
- **Security**: RLS on all tables, service_role only in Edge Functions, prompt injection detection

### Fixed

- **PDF.js Worker**: Correct version pinning (5.3.31) via Vite config
- **Text Selection**: HighlightEngine handles edge cases (cross-line, rotated pages)
- **Credit Race Conditions**: Reservations with expiry prevent overcommit
- **Session Restoration**: LoadingPage waits for Supabase auth state resolution
- **Mobile Layout**: Sidebar → Sheet, Right Sidebar → Bottom Sheet

### Security

- Implemented prompt injection detection in `ai-gateway`
- Rate limiting (50 actions/hour) with `security_events` logging
- Circuit breaker (10,000 credits/day) with `security_events` logging
- All financial writes via `service_role` in Edge Functions only
- RLS policies enforce workspace isolation at database level
- Stripe webhook idempotency via `payment_events.external_event_id` unique constraint

### Documentation

- All 19 documentation files rewritten from source code (PRODUCT, ARCHITECTURE, ROADMAP, STACK, DATABASE, API, SECURITY, DEPLOYMENT, TESTING, DESIGN, COMPONENTS, FILE_STRUCTURE, DECISIONS, CHANGELOG, BRAND, USER_FLOW, MCP, BUSINESS_MODEL, monetization-architecture)
- ADRs documented for 28 key decisions
- Version updated to 1.0.0-rc.1 across all docs

---

## [0.11.0] - 2026-07-20 — Phase 10 Complete (Knowledge Tools)

### Added
- Flashcards, Glossary, Mind Maps, Timelines data models
- `generate-knowledge` Edge Function with 5 action types
- Study Mode with 3D CSS flip animations
- Knowledge Sidebar tabbed interface

### Changed
- `knowledgeStore` replaces mock knowledge state
- Viewer right sidebar now toggles Chat ↔ Knowledge

---

## [0.10.0] - 2026-07-15 — Phase 9 Complete (Billing)

### Added
- Ledger-based credit system (immutable, auditable)
- Stripe Checkout integration
- Plan tiers: Free/Pro/Max with monthly quotas
- Credit usage bars, history table, purchase flow

### Fixed
- Credit reservation race conditions
- Webhook idempotency

---

## [0.9.0] - 2026-07-10 — Phase 8 Complete (Chat)

### Added
- Streaming chat with citations
- Model selector (plan-gated)
- Credit estimation before send

---

## [0.8.0] - 2026-07-05 — Phase 7 Complete (Highlights)

### Added
- Text selection → highlight creation
- 5 highlight colors
- Highlight sidebar with page grouping

---

## [0.7.0] - 2026-07-01 — Phase 6 Complete (AI Gateway)

### Added
- Provider Framework (Registry, Router, Fallback)
- MockAIProvider for development
- Plan enforcement, rate limiting, circuit breaker
- Prompt injection detection

---

## [0.6.0] - 2026-06-25 — Phase 5 Complete (UI Overlays)

### Added
- CSS-percentage overlay system
- Layout, OCR, Vision, Highlight overlays
- Layer toggles in toolbar

---

## [0.5.0] - 2026-06-20 — Phase 4 Complete (PDF Viewer)

### Added
- @tanstack/react-virtual page list
- react-pdf (PDF.js 5.3.31) rendering
- Keyboard shortcuts
- Page registry

---

## [0.4.0] - 2026-06-15 — Phase 3 Complete (Workspace)

### Added
- Three-panel layout
- Workspace CRUD
- Document browser (grid/list)
- Drag-drop upload

---

## [0.3.0] - 2026-06-10 — Phase 2 Complete (Auth & Data)

### Added
- Supabase Auth (Email, Google, GitHub)
- Auto-provisioning trigger
- RLS policies

---

## [0.2.0] - 2026-06-05 — Phase 1 Complete (Foundation)

### Added
- React 19 + TS + Vite + Tailwind v4
- Design system + 30 UI primitives
- Landing page
- App shell

---

## [0.1.0] - 2026-06-01 — Project Initialization

### Added
- Repository setup
- Initial documentation
- Supabase project creation

---

# 6. Upcoming Changes

## [1.0.0] - Target: 2026-08-15 — Phase 23 (Timeline & Presentations Frontend)

### Planned
- **Fix Edge Function Deployment** — Resolve MCP `apply_migration` / `deploy_edge_function` failures
- **Apply Presentations Migration** — `20240711000001_presentations.sql` to Supabase
- **Deploy `generate-knowledge` v2** — With `timeline` + `presentation` action types
- **Implement `TimelineView.tsx`** — Connect to `knowledgeStore`, integrate vis-timeline or custom SVG
- **Create `PresentationsView.tsx`** — Slide deck viewer (Reveal.js or custom)
- **Add Presentation Generation** — `generate-knowledge` action_type: `presentation`
- **Mind Map View** — React Flow integration (Phase 24)

### Future (Post-Launch)
- Podcast Player (TTS + transcript sync)
- Knowledge Graph (RAG + pgvector)
- Collaboration (Yjs + Supabase Realtime)
- Annotations (PDF-lib + PDF.js annotation layer)
- Table Extraction View
- Public API
- Mobile App (React Native / Expo)
- Browser Extension
- Desktop App (Tauri)

---

# 7. Breaking Changes

| Version | Description | Reason | Migration Required | Impact | Replacement |
|---------|-------------|--------|-------------------|--------|-------------|
| 1.0.0 | Credit system: `credits` column → `credit_ledger` | Auditability | Run migration `20240707000000_credit_system.sql` | High | Ledger + buckets |
| 1.0.0 | AI calls: Direct Gemini → `ai-gateway` Edge Function | Plan enforcement | Update `chatStore`, `knowledgeStore` | High | AIGateway |
| 1.0.0 | Overlays: Pixel coords → CSS % | Zoom invariance | Update all overlay components | Medium | % positioning |
| 1.0.0 | Processing: Monolithic → Provider Framework | Extensibility | Migrate providers | Medium | Registry/Router |
| 0.11.0 | Knowledge: Mock → `generate-knowledge` Edge Function | Real AI | Update `knowledgeStore.generate*` | Low | Edge Function |

---

# 8. Migration Notes

## Database

- **Run all 18 migrations in order** via `supabase db push` or `supabase db reset`
- **Critical**: `20240711000001_presentations.sql` not yet applied (MCP issues)
- **Backup** before production migrations (`supabase db dump`)

## API

- **Edge Functions**: Deploy all 5 functions (`supabase functions deploy`)
- **Secrets**: Set `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Supabase Dashboard
- **Stripe**: Configure webhook endpoint to `stripe-webhook` function URL

## Configuration

- **Vercel**: Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` per environment
- **Supabase**: Update `config.toml` for project ref
- **DNS**: `lumena.app` → Vercel, `api.lumena.app` → Supabase (future)

## Dependencies

- **Node**: 20+ (per `.nvmrc`)
- **pnpm**: 9+ (lockfile v9)
- **Supabase CLI**: 2.x for local dev

---

# 9. Known Issues

### Current Limitations

| Issue | Area | Severity | Workaround | Target Fix |
|-------|------|----------|------------|------------|
| Mind Map / Timeline / Presentations — placeholder only | Knowledge | High | N/A | Phase 23 |
| `generate-knowledge` Edge Function v2 not deployed | Backend | High | Use MockAIProvider | Phase 23 |
| Presentations table missing in Supabase | Database | High | Apply migration manually | Phase 23 |
| Stripe webhook signature verification not implemented | Billing | Medium | Test mode only | Pre-launch |
| No light theme | Design | Medium | Dark only | v1.1 |
| No automated CI/CD | Infra | Medium | Manual deploy | Post-launch |
| No Sentry / error tracking | Monitoring | Medium | Console logs | Pre-launch |
| PDF password-protected detection only (no unlock) | PDF | Low | User must unlock externally | Future |
| Cross-page text selection not supported | Highlights | Low | Single page only | Future |
| No offline support (Service Worker) | PWA | Low | Online only | Future |

### Open Bugs

- None critical at rc.1

### Technical Debt

- `MCP.md` references MCP but not actively used in CI
- `monetization-architecture.md` legacy doc (superseded by BUSINESS_MODEL.md)
- Some `any` types in provider interfaces (to be tightened)
- `pageRegistryStore` and `viewerStore` have overlapping page state
- `TesseractOCRProvider` loads all languages upfront (should lazy-load)

---

# 10. Contributors

| Role | Name |
|------|------|
| Project Owner | maxgab201@gmail.com |
| Tech Lead | AI Agent (Claude Opus 5) |
| AI Agents | Claude Code, Subagents |
| External Contributors | — |

**Special Thanks**: Supabase, Vercel, Radix UI, TanStack, Framer Motion, Lucide, Geist Font teams.
