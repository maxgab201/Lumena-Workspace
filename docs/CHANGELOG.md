# Lumena Workspace

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
