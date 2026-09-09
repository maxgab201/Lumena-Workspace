# Lumena Workspace

File Structure Specification

Version: 1.0

Status: Implemented

Last Updated: 2026-07-27

---

# Table of Contents

1. Philosophy
2. Repository Structure
3. Root Directory
4. Frontend Structure (src/)
5. Backend Structure (supabase/)
6. Shared Code
7. Components Organization
8. Pages Organization
9. Features Organization
10. Hooks
11. Stores
12. Repositories
13. Libraries
14. Types
15. Assets
16. Public Files
17. Configuration Files
18. Environment Files
19. Documentation
20. Testing Structure
21. Scripts
22. Naming Conventions
23. Import Rules
24. Module Boundaries
25. Generated Files
26. Build Output
27. Temporary Files
28. Future Structure

---

# 1. Philosophy

**Colocation by Feature, Separation by Layer**

- Frontend (`src/`) and Backend (`supabase/`) are top-level domains
- Within frontend: Colocate components, hooks, types by feature
- Shared utilities, stores, types at `src/` root
- Configuration at root for tooling visibility

**No `apps/` or `packages/` Monorepo** — Single Vite app + Supabase project is simpler for this scale.

---

# 2. Repository Structure

```
Lumena-Workspace-ALL/
├── .claude/                    # Claude Code config (agents, commands, hooks)
├── .github/                    # GitHub Actions (future CI/CD)
├── docs/                       # Project documentation (19 files)
├── public/                     # Static assets (copied to dist/)
├── scripts/                    # Build/deploy utilities
├── src/                        # Frontend source (React 19 + TS + Vite)
├── supabase/                   # Backend (PostgreSQL + Edge Functions)
├── tests/                      # Test files (future)
├── .env.example                # Environment template
├── .gitignore
├── .nvmrc                      # Node version (20)
├── AGENTS.md                   # Agent instructions
├── CLAUDE.md                   # Project context for Claude
├── components.json             # shadcn/ui config (unused, legacy)
├── eslint.config.js            # Oxlint config
├── index.html                  # Vite entry HTML
├── package.json
├── pnpm-lock.yaml
├── postcss.config.js           # PostCSS (Tailwind v4)
├── README.md
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts              # Vite config
└── vitest.config.ts            # Vitest config
```

---

# 3. Root Directory

| File/Directory | Purpose |
|----------------|---------|
| `.claude/` | Claude Code agents, commands, hooks, memory |
| `.github/` | GitHub Actions workflows (future) |
| `docs/` | All project documentation |
| `public/` | Static assets → `dist/` (favicon, robots.txt, manifest) |
| `scripts/` | Node scripts (build, deploy, db utilities) |
| `src/` | Frontend application source |
| `supabase/` | Supabase project (migrations, functions, config) |
| `tests/` | Test files (unit, component, e2e) — future |
| `.env.example` | Template for local env vars |
| `.gitignore` | Git ignore rules |
| `.nvmrc` | Node.js version pin (20) |
| `AGENTS.md` | Instructions for AI agents working on this repo |
| `CLAUDE.md` | Project context for Claude Code |
| `components.json` | Legacy shadcn config (not used) |
| `eslint.config.js` | Oxlint (fast ESLint alternative) config |
| `index.html` | Vite entry HTML |
| `package.json` | Dependencies, scripts |
| `pnpm-lock.yaml` | Lockfile (pnpm 9+) |
| `postcss.config.js` | PostCSS plugins (Tailwind v4) |
| `README.md` | Project overview |
| `tsconfig.json` | TypeScript config (app) |
| `tsconfig.node.json` | TypeScript config (Node scripts) |
| `vite.config.ts` | Vite bundler config |
| `vitest.config.ts` | Vitest test config |

---

# 4. Frontend Structure (src/)

```
src/
├── main.tsx                    # App entry, providers, router mount
├── App.tsx                     # Root component, routes, error boundary
├── index.css                   # Tailwind v4 @theme, globals, CSS vars
├── vite-env.d.ts               # Vite type declarations
├── components/                 # React components (see §7)
├── pages/                      # Route-level components (see §8)
├── features/                   # Feature-specific logic (see §9)
├── hooks/                      # Shared custom hooks (see §10)
├── stores/                     # Zustand stores (see §11)
├── repositories/               # Data access layer (see §12)
├── lib/                        # Shared utilities & libraries (see §13)
├── types/                      # Shared TypeScript types (see §14)
├── assets/                     # Static assets imported in code (see §15)
└── utils/                      # Legacy alias for lib/utils.ts
```

---

# 5. Backend Structure (supabase/)

```
supabase/
├── config.toml                 # Supabase CLI config
├── migrations/                 # SQL migrations (18 files, chronological)
│   ├── 20240701000000_initial_schema.sql
│   ├── 20240702000000_rls_policies.sql
│   ├── 20240703000000_profiles_workspaces.sql
│   ├── 20240704000000_documents_storage.sql
│   ├── 20240705000000_processing_jobs.sql
│   ├── 20240706000000_highlights.sql
│   ├── 20240707000000_credit_system.sql
│   ├── 20240708000000_usage_jobs.sql
│   ├── 20240709000000_security_events.sql
│   ├── 20240710000000_knowledge_tools.sql
│   ├── 20240711000001_presentations.sql
│   ├── 20240711000002_podcasts.sql
│   ├── 20240711000003_storage.sql
│   ├── 20240711000004_chat_messages.sql
│   ├── 20240711000005_subscriptions.sql
│   └── 20240711000006_credit_buckets.sql
├── functions/                  # Edge Functions (Deno)
│   ├── ai-gateway/
│   │   └── index.ts            # AI routing, credits, rate limit, injection detection
│   ├── generate-knowledge/
│   │   └── index.ts            # Flashcards, glossary, mindmap, timeline, presentation
│   ├── process-document/
│   │   └── index.ts            # Inspection, OCR, Layout, Extraction, AI analysis
│   ├── create-checkout-session/
│   │   └── index.ts            # Stripe Checkout Session creation
│   └── stripe-webhook/
│       └── index.ts            # Stripe webhook handler (checkout.session.completed)
├── seed.sql                    # Development seed data
└── .env.local                  # Local dev secrets (gitignored)
```

---

# 6. Shared Code

Currently **no shared code** between frontend and backend.

**Future**: `packages/shared/` for:
- TypeScript types (database, API contracts)
- Zod schemas (validation)
- Constants (enums, error codes)
- Utility functions

---

# 7. Components Organization

```
src/components/
├── ui/                         # 30+ Primitive components (Radix + Tailwind)
│   ├── index.ts                # Barrel export
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Textarea.tsx
│   ├── Select.tsx
│   ├── Checkbox.tsx
│   ├── RadioGroup.tsx
│   ├── Switch.tsx
│   ├── Slider.tsx
│   ├── Badge.tsx
│   ├── Avatar.tsx
│   ├── Card.tsx
│   ├── Separator.tsx
│   ├── Tabs.tsx
│   ├── Accordion.tsx
│   ├── Dialog.tsx
│   ├── Sheet.tsx
│   ├── DropdownMenu.tsx
│   ├── Tooltip.tsx
��   ├── HoverCard.tsx
│   ├── Popover.tsx
│   ├── Command.tsx
│   ├── ContextMenu.tsx
│   ├── ScrollArea.tsx
│   ├── Skeleton.tsx
│   ├── Spinner.tsx
│   ├── Label.tsx
│   ├── Toaster.tsx
│   └── cn.ts                   # clsx + tailwind-merge utility
├── layout/                     # App shells
│   ├── AppLayout.tsx           # Authenticated app shell (Topbar + Sidebar + Main)
│   ├── ViewerLayout.tsx        # Viewer shell (full-width, no app sidebar)
│   ├── Topbar.tsx              # Global search, notifications, user menu
│   ├── Sidebar.tsx             # Collapsible app sidebar (navigation)
│   ├── WorkspaceSidebar.tsx    # Workspace-specific sidebar (docs, chat, knowledge)
│   └── RightSidebar.tsx        # Conditional right panel (chat/knowledge)
├── pdf/                        # PDF Viewer components
│   ├── PDFViewer.tsx           # Root viewer, document load, keyboard shortcuts
│   ├── PDFToolbar.tsx          # Navigation, zoom, layers, sidebar toggles
│   ├── PDFPageList.tsx         # Virtualized thumbnail list (@tanstack/react-virtual)
│   ├── PDFPage.tsx             # Single page canvas + overlay container
│   ├── PDFThumbnail.tsx        # Thumbnail image with status badges
│   └── overlays/               # Overlay layers (CSS % positioning)
│       ├── LayoutOverlay.tsx   # Structural elements (blue)
│       ├── OCROverlay.tsx      # OCR text blocks (green)
│       ├── VisionOverlay.tsx   # AI semantic boxes (violet)
│       ├── HighlightOverlay.tsx# User highlights (yellow/green/blue/pink/purple)
│       └── HighlightEditor.tsx # Floating toolbar on text selection
├── chat/                       # Chat sidebar
│   ├── ChatSidebar.tsx         # Container, message list, input
│   ├── ChatMessage.tsx         # User/Assistant/System bubbles
│   ├── ChatInput.tsx           # Textarea, model selector, send
│   ├── ChatEmpty.tsx           # Empty state
│   ├── ModelSelector.tsx       # Plan-gated model dropdown
│   └── StreamingIndicator.tsx  # "Thinking..." animation
├── knowledge/                  # Knowledge tools sidebar
│   ├── KnowledgeSidebar.tsx    # Tabbed container (Flashcards/Glossary/MindMap/Timeline)
│   ├── FlashcardsView.tsx      # List + add flashcard
│   ├── GlossaryView.tsx        # List + add term
│   ├── MindMapView.tsx         # Placeholder (React Flow future)
│   ├── TimelineView.tsx        # Placeholder (vis-timeline future)
│   ├── StudyModeOverlay.tsx    # Full-screen 3D flip flashcard study
│   ├── KnowledgeCard.tsx       # Unified card for flashcard/glossary
│   ├── FlashcardFlip.tsx       # 3D CSS flip animation
│   └── EmptyKnowledge.tsx      # Empty states per tool
├── workspace/                  # Dashboard & Workspace
│   ├── Dashboard.tsx           # Workspace grid/list, empty state, create modal
│   ├── WorkspaceCard.tsx       # Workspace preview card
│   ├── DocumentCard.tsx        # Document preview card (grid)
│   ├── UploadZone.tsx          # Drag-drop upload with progress
│   ├── EmptyState.tsx          # Reusable empty state component
│   └── ActivityFeed.tsx        # Mock activity feed (right sidebar)
├── billing/                    # Billing page components
│   ├── BillingPage.tsx         # Main billing page composition
│   ├── PlanCard.tsx            # Plan comparison card
│   ├── CreditUsageBar.tsx      # Visual credit progress bar
│   ├── CreditHistory.tsx       # Transaction history table
│   ├── PurchaseCredits.tsx     # Stripe Checkout button
│   ├── SubscriptionStatus.tsx  # Current plan, renewal, cancel
│   └── UpgradeModal.tsx        # Glassmorphic upgrade/purchase modal
├── auth/                       # Auth pages
│   ├── AuthLayout.tsx          # Centered card layout
│   ├── LoginForm.tsx           # Email/password + OAuth
│   ├── RegisterForm.tsx        # Name, email, password + OAuth
│   ├── OAuthButtons.tsx        # Google/GitHub buttons
│   └── ForgotPasswordForm.tsx  # Reset email
├── settings/                   # Settings page
│   ├── SettingsPage.tsx        # Tabbed settings container
│   ├── SettingsTabs.tsx        # Navigation tabs
│   ├── ProfileForm.tsx         # Name, avatar, email, password
│   ├── AppearanceSettings.tsx  # Theme, density, animations
│   ├── NotificationSettings.tsx# Email, in-app, digest prefs
│   ├── ShortcutsSettings.tsx   # Keyboard shortcuts reference
│   ├── DataSettings.tsx        # Export, delete account
│   └── DangerZone.tsx          # Delete workspaces, revoke sessions
└── highlights/                 # Highlight sidebar
    ├── HighlightSidebar.tsx    # List of highlights for document
    └── HighlightBadge.tsx      # Color legend badge
```

---

# 8. Pages Organization

```
src/pages/
├── LandingPage.tsx             # "/" — Marketing landing page
├── AuthPage.tsx                # "/auth" — Login/Register/Forgot (tabs)
├── DashboardPage.tsx           # "/dashboard" — Workspace overview
├── WorkspacePage.tsx           # "/workspace/:workspaceId" — Document browser
├── ViewerPage.tsx              # "/viewer/:documentId" — PDF viewer + sidebars
├── SettingsPage.tsx            # "/settings" — User settings
├── BillingPage.tsx             # "/billing" — Credits, plans, history
├── NotFoundPage.tsx            # 404
└── LoadingPage.tsx             # Session restoration spinner
```

**Route Structure** (`App.tsx`):
```tsx
<Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/auth" element={<AuthPage />} />
  <Route element={<ProtectedRoute><AppLayout><Routes>...</Routes></AppLayout></ProtectedRoute>}>
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/workspace/:workspaceId" element={<WorkspacePage />} />
    <Route path="/viewer/:documentId" element={<ViewerPage />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/billing" element={<BillingPage />} />
  </Route>
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

---

# 9. Features Organization

```
src/features/
├── auth/                       # Auth feature (legacy, mostly in stores/repos)
├── workspace/                  # Workspace feature
├── document/                   # Document feature
├── viewer/                     # Viewer feature
├── chat/                       # Chat feature
├── knowledge/                  # Knowledge tools feature
├── highlights/                 # Highlights feature
├── billing/                    # Billing feature
└── processing/                 # Document processing feature
```

**Note**: Currently minimal — most logic lives in `stores/`, `repositories/`, `lib/`. Features folder reserved for future domain-driven refactor.

---

# 10. Hooks

```
src/hooks/
├── index.ts                    # Barrel export
├── useAuth.ts                  # Auth state + actions (wraps userStore)
├── useKeyboardShortcuts.ts     # Global keyboard shortcuts (⌘K, viewer keys)
├── useMediaQuery.ts            # Responsive breakpoints
├── useReducedMotion.ts         # prefers-reduced-motion hook
├── useLocalStorage.ts          # Persisted state
├── useDebounce.ts              # Debounced value
├── useClickOutside.ts          # Click outside detection
├── useOnScreen.ts              # IntersectionObserver hook
└── useToast.ts                 # Sonner toast helpers
```

---

# 11. Stores (Zustand)

```
src/stores/
├── index.ts                    # Barrel export
├── userStore.ts                # Auth user, profile, session, auth actions
├── workspaceStore.ts           # Workspaces, current, CRUD, members
├── documentStore.ts            # Documents, upload, processing status
├── viewerStore.ts              # PDF state: scale, rotation, page, overlays
├── pageRegistryStore.ts        # Page metadata: OCR, layout, vision status
├── chatStore.ts                # Messages, streaming, model, abort
├── knowledgeStore.ts           # Flashcards, glossary, mindmap, timeline
├── highlightStore.ts           # Highlights, editor, selection → PDF coords
├── billingStore.ts             # Plan, credits, buckets, history, subscriptions
└── uiStore.ts                  # Sidebars, modals, toasts, theme, shortcuts
```

**Pattern**: Each store is a standalone `createStore` with:
- `state` (immutable updates via `immer` middleware)
- `actions` (async thunks calling repositories + Edge Functions)
- `selectors` (derived state via `useStore(selector)`)

---

# 12. Repositories

```
src/repositories/
├── index.ts                    # Barrel export
├── authRepository.ts           # signIn, signUp, signOut, resetPassword, OAuth
├── workspaceRepository.ts      # CRUD workspaces, members, switch
├── documentRepository.ts       # CRUD documents, signed URLs, upload
├── highlightRepository.ts      # CRUD highlights
├── chatRepository.ts           # Messages, conversations
├── knowledgeRepository.ts      # Flashcards, glossary, mindmap, timeline
├── billingRepository.ts        # Credits, ledger, subscriptions, checkout
├── processingRepository.ts     # Jobs, logs, events
└── settingsRepository.ts       # User preferences
```

**Pattern**: Pure Supabase client calls. No business logic. Throws typed errors.

---

# 13. Libraries (lib/)

```
src/lib/
├── utils.ts                    # cn(), formatDate, formatBytes, debounce, etc.
├── supabase.ts                 # Supabase client (browser) singleton
├── providers/                  # Provider Framework (core architecture)
│   ├── types.ts                # ProviderMetadata, DocumentProfile, ProviderResult, interfaces
│   ├── interfaces/             # BaseProvider, OCRProvider, LayoutProvider, VisionProvider, TextExtractionProvider, InspectionProvider, AIProvider
│   ├── ProviderRegistry.ts     # Static registry of enabled providers
│   ├── ProviderRouter.ts       # Dynamic routing (quality, cost, latency, offline)
│   ├── ProviderFallback.ts     # Sequential fallback orchestration
│   ├── provider.config.ts      # Fallback sequences, capability overrides
│   ├── ocr/
│   │   └── TesseractOCRProvider.ts  # Browser WASM Tesseract.js
│   ├── ai/
│   │   └── MockAIProvider.ts   # Deterministic mock for dev/test
│   └── index.ts                # Barrel export
├── processing/                 # Document Processing Engine
│   ├── EventBus.ts             # Typed event emitter for pipeline stages
│   ├── ProviderRegistry.ts     # Bridge: ProcessingEngine ↔ Provider Framework
│   ├── HighlightEngine.ts      # DOM Selection → PDF % coordinates
│   ├── InspectionStage.ts      # PDF.js inspection (pages, encryption, metadata)
│   └── ExtractionStage.ts      # Text extraction via providers
├── validation/                 # Zod schemas (future)
├── constants/                  # App constants
│   ├── plans.ts                # Plan definitions (FREE, PRO, MAX)
│   ├── credits.ts              # Credit costs per action
│   ├── shortcuts.ts            # Keyboard shortcut definitions
│   └── models.ts               # AI model metadata
└── api/                        # API client helpers (future)
```

---

# 14. Types

```
src/types/
├── index.ts                    # Barrel export
├── database.ts                 # Generated from Supabase (types/database.ts)
├── api.ts                      # API contracts (Edge Function request/response)
├── pdf.ts                      # PDF.js types, viewer types
├── providers.ts                # Provider Framework types (re-export from lib/providers/types)
├── knowledge.ts                # Flashcard, GlossaryTerm, MindMapNode, TimelineEvent
├── chat.ts                     # ChatMessage, ChatConversation
├── highlights.ts               # Highlight, HighlightCategory
├── billing.ts                  # Plan, CreditAccount, CreditLedger, Subscription
├── workspace.ts                # Workspace, WorkspaceMember
├── document.ts                 # Document, ProcessingJob, ProcessingStatus
└── ui.ts                       # Toast, Modal, Sidebar, Breakpoint types
```

---

# 15. Assets

```
src/assets/
├── illustrations/              # Empty state SVGs
│   ├── empty-workspace.svg
│   ├── empty-chat.svg
│   ├── empty-knowledge.svg
│   └── empty-highlights.svg
├── icons/                      # Custom icons (if any beyond lucide)
└── fonts/                      # Local fonts (none - Geist via @fontsource)
```

---

# 16. Public Files

```
public/
├── favicon.ico
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png
├── manifest.json               # PWA manifest
├── robots.txt
└── pdf.worker.min.mjs          # PDF.js worker (copied by vite plugin)
```

---

# 17. Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite: React, TS, Tailwind v4, path aliases (`@/*`), PDF.js worker |
| `tsconfig.json` | App TS config: strict, ESNext, JSX, path aliases |
| `tsconfig.node.json` | Node scripts TS config |
| `eslint.config.js` | Oxlint: recommended + React + TypeScript + JSX a11y |
| `postcss.config.js` | PostCSS: `@tailwindcss/postcss` |
| `vitest.config.ts` | Vitest: jsdom, globals, setupFiles, coverage |
| `components.json` | Legacy shadcn config (unused) |
| `.nvmrc` | Node 20 |
| `.env.example` | Env template |

---

# 18. Environment Files

| File | Scope | Committed |
|------|-------|-----------|
| `.env.local` | Local dev (Vite vars) | ❌ |
| `.env.production` | Production build (Vite vars) | ❌ |
| `supabase/.env.local` | Local Supabase + Edge Function secrets | ❌ |
| Vercel Dashboard | Preview/Prod Vite vars | N/A |
| Supabase Dashboard | Edge Function secrets (`Deno.env`) | N/A |

**Vite Vars** (prefixed `VITE_`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Edge Function Secrets** (Deno.env):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

---

# 19. Documentation

```
docs/
├── PRODUCT.md                  # Product specification (features, status)
├── ARCHITECTURE.md             # System architecture (all layers)
├── ROADMAP.md                  # Phases 1-23+ status
├── STACK.md                    # Technology stack with versions
├── DATABASE.md                 # Complete schema (18 migrations)
├── API.md                      # API specification (Client + Edge Functions)
├── SECURITY.md                 # Security specification (Zero Trust, RLS, etc.)
├── DEPLOYMENT.md               # Deployment specification (Vercel + Supabase)
├── TESTING.md                  # Testing specification
├── DESIGN.md                   # Design system specification
├── COMPONENTS.md               # Component library specification
├── FILE_STRUCTURE.md           # This file
├── DECISIONS.md                # Architecture Decision Records (ADRs)
├── CHANGELOG.md                # Release history (block-based)
├���─ BRAND.md                    # Brand identity specification
├── USER_FLOW.md                # User journey flows
├── MCP.md                      # MCP integration specification
├── BUSINESS_MODEL.md           # Business model & monetization
└── monetization-architecture.md # Legacy detailed monetization doc
```

---

# 20. Testing Structure (Future)

```
tests/
├── unit/                       # Vitest unit tests
│   ├── stores/
│   ├── lib/
│   └── providers/
├── component/                  # Testing Library component tests
│   ├── ui/
│   ├── pdf/
│   ├── chat/
│   └── knowledge/
├── integration/                # Store + Repository + Mocked Edge Functions
│   ├── workspace/
│   ├── chat/
│   └── billing/
├── e2e/                        # Playwright E2E tests
│   ├── auth.spec.ts
│   ├── upload.spec.ts
│   ├── chat.spec.ts
│   ├── billing.spec.ts
│   ├── highlights.spec.ts
│   └── knowledge.spec.ts
├── fixtures/                   # Test data
│   ├── pdfs/
│   ├── seed.sql
│   └── mock-ai-responses.json
└── setup/                      # Test setup
    ├── vitest-setup.ts
    └── playwright-setup.ts
```

---

# 21. Scripts

```
scripts/
├── build.js                    # Custom build steps (future)
├── deploy.js                   # Deploy automation (future)
├── db-seed.js                  # Database seeding (future)
├── db-migrate.js               # Migration helpers (future)
└── typegen.js                  # Supabase type generation (future)
```

**Package.json Scripts**:
```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "lint": "oxlint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui",
  "test:e2e": "playwright test",
  "db:reset": "supabase db reset",
  "db:push": "supabase db push",
  "functions:deploy": "supabase functions deploy",
  "typegen": "supabase gen types typescript --project-id $SUPABASE_PROJECT_REF > src/types/database.ts"
}
```

---

# 22. Naming Conventions

| Category | Convention | Example |
|----------|------------|---------|
| Directories | kebab-case | `src/components/ui` |
| Component Files | PascalCase | `PDFViewer.tsx` |
| Hook Files | camelCase + `use` | `useKeyboardShortcuts.ts` |
| Store Files | camelCase + `Store` | `workspaceStore.ts` |
| Repository Files | camelCase + `Repository` | `documentRepository.ts` |
| Library Files | camelCase | `ProviderRouter.ts` |
| Type Files | PascalCase + `Types` | `pdfTypes.ts` |
| Constant Files | UPPER_SNAKE_CASE | `SHORTCUTS.ts` |
| CSS Variables | kebab-case | `--color-primary` |
| Tailwind Classes | kebab-case | `bg-primary` |
| Database Tables | snake_case | `credit_ledger` |
| Database Columns | snake_case | `workspace_id` |
| Enums (TS) | PascalCase | `PlanType` |
| Enums (DB) | snake_case | `plan_type` |

---

# 23. Import Rules

**Path Aliases** (`tsconfig.json` + `vite.config.ts`):
```json
"@/*": ["src/*"]
```

**Import Order** (enforced by oxlint):
1. External packages (`react`, `zustand`, `@tanstack/react-virtual`)
2. Internal aliases (`@/components`, `@/stores`, `@/lib`)
3. Relative imports (`./`, `../`)

**Barrel Exports**: Use `@/components/ui`, `@/stores`, `@/repositories`, `@/lib/providers`

**No Circular Imports**: Stores → Repositories → Lib (one direction)

---

# 24. Module Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                        Pages                                 │
│  (Compose features, handle routing, no business logic)       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      Features/Components                      │
│  (UI logic, user interactions, call stores)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                        Stores (Zustand)                       │
│  (State, actions, async thunks, selectors)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Repositories (Supabase)                    │
│  (Pure data access, throw errors, no business logic)         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      Lib (Core Logic)                         │
│  (Providers, Processing Engine, Validation, Utils)           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Edge Functions (Deno)                      │
│  (AI Gateway, Processing, Knowledge, Billing, Webhooks)      │
└──────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Database (PostgreSQL)                      │
│  (RLS, Triggers, Functions, Migrations)                      │
└──────────────────────────────────────────────────────────────┘
```

**Rules**:
- Pages → Components/Stores (✓)
- Components → Stores/Lib (✓)
- Stores → Repositories/Lib/Edge Functions (✓)
- Repositories → Supabase Client only (✓)
- Lib → No imports from Stores/Components/Pages (✓)
- Edge Functions → Database/External APIs only (✓)

---

# 25. Generated Files

| File | Generator | Committed |
|------|-----------|-----------|
| `src/types/database.ts` | `supabase gen types` | ✅ (checked in) |
| `dist/` | `vite build` | ❌ |
| `node_modules/` | `pnpm install` | ❌ |
| `.vite/` | Vite cache | ❌ |
| `supabase/.temp/` | Supabase CLI | ❌ |

---

# 26. Build Output

```
dist/                         # Vite production build
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── [assets]-[hash].[ext]
└── pdf.worker.min.mjs        # PDF.js worker
```

**Deployed to**: Vercel (auto on push to main/tags)

---

# 27. Temporary Files

| Pattern | Purpose |
|---------|---------|
| `*.log` | Debug logs |
| `*.tmp` | Temporary files |
| `.DS_Store` | macOS metadata |
| `coverage/` | Vitest coverage output |
| `playwright-report/` | Playwright HTML report |
| `test-results/` | Playwright JSON results |

All in `.gitignore`.

---

# 28. Future Structure

```
├── packages/
│   ├── shared/               # Shared types, schemas, constants
│   ├── ui/                   # Published component library
│   └── api-client/           # Type-safe API client
├── apps/
│   ├── web/                  # Current src/ → apps/web/
│   ├── mobile/               # React Native (Expo)
│   ├── extension/            # Browser Extension (Plasmo)
│   └── desktop/              # Tauri / Electron
├── supabase/                 # Remains (shared backend)
└── turbo.json                # Turborepo config
```

**Migration Trigger**: When mobile/extension/desktop apps need shared code.