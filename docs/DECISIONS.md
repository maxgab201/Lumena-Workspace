# Lumena Workspace

<!-- LUMENA_AUTO_STATUS_START -->
> [!NOTE]
> **Automated project status — source of truth for current implementation state.**
> Synced from `docs/project-status.json` at commit [`b500c05`](https://github.com/maxgab201/Lumena-Workspace/commit/b500c0533bcf1c0d6830de21f21d0d56b60478fb) on `2026-09-22T15:51:15-03:00` (branch `feat/page-mapping-doc-sync`). If older prose below conflicts with this block, this generated block wins.

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

Architecture Decision Records (ADR)

Version: 1.0

Status: Living Document

Last Updated: 2026-07-27

---

# Table of Contents

1. Purpose
2. Decision Process
3. Decision Status
4. Decision Template
5. Accepted Decisions
6. Proposed Decisions
7. Rejected Decisions
8. Deferred Decisions
9. Future Reviews
10. Decision History

---

# 1. Purpose

This document records every significant technical, architectural, and business decision made throughout the project. Each decision is captured as an Architecture Decision Record (ADR) with context, options considered, and consequences.

**Every major architectural change must have a corresponding ADR before implementation.**

---

# 2. Decision Process

1. **Identify** a decision needed (architecture, technology, pattern, vendor)
2. **Document** using the ADR template below
3. **Review** with stakeholders (async via PR, or sync for major decisions)
4. **Decide** — update status to `Accepted` or `Rejected`
5. **Implement** — reference ADR in code/PRs
6. **Review** — revisit at `Future Review Date`

---

# 3. Decision Status

| Status | Meaning |
|--------|---------|
| `Proposed` | Under consideration, not yet decided |
| `Accepted` | Approved, implemented or implementing |
| `Rejected` | Explicitly not chosen, documented for posterity |
| `Deprecated` | Was accepted, now superseded |
| `Superseded` | Replaced by a newer ADR |
| `Under Review` | Re-evaluating due to changed context |

---

# 4. Decision Template

```markdown
## ADR-XXXX: Title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Rejected | Deprecated | Superseded
**Category**: Architecture | Technology | Pattern | Vendor | Security | Business
**Decision Makers**: [Names/roles]
**Future Review Date**: YYYY-MM-DD

### Problem
What problem are we solving? Why now?

### Context
Technical, business, or organizational constraints. Current state.

### Options Considered
| Option | Pros | Cons | Effort |
|--------|------|------|--------|
| A | ... | ... | Low/Med/High |
| B | ... | ... | ... |

### Decision
What we chose. Clear, unambiguous statement.

### Reasoning
Why this option over others. Trade-offs accepted.

### Consequences
#### Positive
- ...
#### Negative
- ...
#### Risks
- ...
#### Migration Required
- ...

### References
- Links to PRs, issues, docs, external resources
```

---

# 5. Accepted Decisions

## ADR-0001: Project Documentation Strategy

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Architecture
**Decision Makers**: Project Owner
**Future Review Date**: 2027-01-11

### Problem
Need consistent, maintainable documentation that stays in sync with code.

### Context
Previous documentation was fragmented, outdated, and inconsistent with implementation.

### Options Considered
| Option | Pros | Cons | Effort |
|--------|------|------|--------|
| Single monolithic SPEC.md | Single source | Unwieldy, merge conflicts | Low |
| Multiple spec files (current) | Modular, parallel editing | Cross-reference maintenance | Medium |
| Auto-generated from code | Always current | Limited narrative/explanation | High |

### Decision
Use **multiple specification documents** (PRODUCT, ARCHITECTURE, ROADMAP, STACK, DATABASE, API, SECURITY, DEPLOYMENT, TESTING, DESIGN, COMPONENTS, FILE_STRUCTURE, DECISIONS, CHANGELOG, BRAND, USER_FLOW, MCP, BUSINESS_MODEL) with a central index. Source of truth = code. Documentation updated when code changes.

### Reasoning
Balances maintainability with comprehensiveness. Each doc has clear ownership. Cross-references via relative links.

### Consequences
- **Positive**: Clear separation of concerns, easier to navigate
- **Negative**: Must maintain consistency across docs manually
- **Risk**: Drift between docs and code
- **Mitigation**: "Documentation updated" checklist item in every PR

### References
- `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, etc.

---

## ADR-0002: Incremental Development by Blocks

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Process
**Decision Makers**: Project Owner
**Future Review Date**: 2027-01-11

### Problem
Large features need to be delivered incrementally with user validation.

### Context
Project built in phases (Blocks 1-23+). Each block should be reviewable.

### Decision
**Development by Blocks**: Every block ends with user approval. No block starts until previous is accepted. Blocks are vertical slices (UI + backend + docs).

### Reasoning
Reduces risk of building wrong thing. Enables course correction. Matches how the project has been developed (Phases 1-11 complete, Phase 23 in progress).

### Consequences
- **Positive**: Continuous alignment, early feedback
- **Negative**: Slower raw velocity, more process overhead
- **Risk**: Block boundaries may not match technical boundaries

---

## ADR-0003: AI Provider Independence

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Architecture
**Decision Makers**: Project Owner, Tech Lead
**Future Review Date**: 2027-07-11

### Problem
LLM landscape changes rapidly. Lock-in to one provider is risky.

### Context
Current: Google Gemini (Flash/Pro). Future: OpenAI, Anthropic, local models, specialized providers.

### Decision
**Provider Framework** with abstract interfaces (`AIProvider`, `OCRProvider`, `VisionProvider`, etc.), Registry, Router, and Fallback. All provider-specific code in `src/lib/providers/`. Frontend never calls providers directly — always via `AIGateway` Edge Function.

### Reasoning
Enables swapping providers without touching business logic. Supports routing by document type, cost, quality, offline capability.

### Consequences
- **Positive**: Future-proof, multi-provider routing, fallback resilience
- **Negative**: Initial abstraction overhead
- **Risk**: Interface churn as provider capabilities diverge
- **Mitigation**: Versioned provider interfaces, capability metadata

### References
- `src/lib/providers/types.ts`, `ProviderRouter.ts`, `ProviderRegistry.ts`, `ProviderFallback.ts`
- `supabase/functions/ai-gateway/index.ts`

---

## ADR-0004: Repository Initialization and Frontend Stack

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
Choose frontend framework, build tool, styling, language.

### Context
Greenfield project. Need modern, performant, maintainable stack.

### Options Considered
| Option | Pros | Cons |
|--------|------|------|
| React 19 + TypeScript + Vite + Tailwind v4 | Modern, fast, great DX, ecosystem | New versions (some instability) |
| Next.js + App Router | Full-stack, RSC | Overkill for SPA, Vercel lock-in |
| SvelteKit | Simpler, faster | Smaller ecosystem, team familiarity |
| Vue 3 + Vite | Mature, performant | Team prefers React |

### Decision
**React 19.2.7 + TypeScript 6.0.2 + Vite 8.1.1 + Tailwind CSS 4.3.2**

Backend: **Supabase** (PostgreSQL + Auth + Storage + Edge Functions/Deno)

### Reasoning
Team expertise in React. Vite fastest dev/build. Tailwind v4 zero-config, CSS-first. Supabase provides managed Postgres + Auth + Realtime + Edge Functions — perfect for this architecture.

### Consequences
- **Positive**: Excellent DX, fast iteration, scalable backend
- **Negative**: React 19/Tailwind v4 bleeding edge (occasional breaking changes)
- **Risk**: Supabase vendor lock-in (mitigated: standard Postgres, portable)

---

## ADR-0005: Design System Primitives & Animation Strategy

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead, Designer
**Future Review Date**: 2027-01-11

### Problem
Need accessible, customizable UI primitives with professional motion.

### Context
Building from scratch. Don't want to maintain complex components (dialog, select, tooltip).

### Decision
**Radix UI Primitives** for complex components (Dialog, Select, Tabs, DropdownMenu, Tooltip, HoverCard, Popover, Sheet, Command, ContextMenu, ScrollArea). **Custom styled** primitives for simple ones (Button, Input, Badge, Avatar, Card, Separator, Accordion, Skeleton, Spinner, Label). **Framer Motion 12.23.12** for animations. **`cn()` utility** (`clsx` + `tailwind-merge`) for class composition.

### Reasoning
Radix guarantees ARIA compliance, keyboard navigation, focus management. Framer Motion declarative, spring-based, `AnimatePresence` for exit animations. `cn()` prevents class conflicts.

### Consequences
- **Positive**: Accessible by default, beautiful motion, minimal maintenance
- **Negative**: Bundle size (Radix + Framer Motion ~60KB gzipped)
- **Risk**: Radix API changes between major versions

---

## ADR-0006: Document Viewer Virtualization

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Architecture
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
PDF viewer must handle 300+ page documents smoothly.

### Context
`react-window` considered but too rigid for dynamic page heights, rotation, zoom.

### Decision
**@tanstack/react-virtual** (`useVirtualizer`) for `PDFPageList`. Headless, supports dynamic measurement, overscan, horizontal/vertical, sticky headers.

### Reasoning
`react-virtual` handles dynamic sizes natively via `measureElement`. Active maintenance. TanStack ecosystem consistency.

### Consequences
- **Positive**: Smooth 60fps scrolling for 500+ pages, flexible layout
- **Negative**: Learning curve (headless API)
- **Risk**: Virtualizer measurement layout thrash on rapid zoom

### References
- `src/components/pdf/PDFPageList.tsx`
- `src/stores/viewerStore.ts` (scale, rotation state)

---

## ADR-0007: Provider-Agnostic Processing Engine

**Date**: 2024-07-11
**Status**: Accepted
**Category**: Architecture
**Decision Makers**: Tech Lead
**Future Review Date**: 2025-07-11

### Problem
Document processing (OCR, Layout, Vision, Extraction) needs to support multiple providers, routing, fallbacks.

### Context
Ecosystem evolving: Tesseract, Surya, DocTR, PaddleOCR, GPT-4 Vision, Gemini Vision. Hardcoding providers creates technical debt.

### Decision
**Provider Framework** (see ADR-0003) extended to processing: `OCRProvider`, `LayoutProvider`, `VisionProvider`, `TextExtractionProvider`, `InspectionProvider`. **ProcessingEngine** orchestrates stages via `EventBus`. **ProviderRegistry** bridges Engine ↔ Framework. **ProviderRouter** selects optimal provider per document profile. **ProviderFallback** handles sequential failover.

### Reasoning
Separates *what* to process from *how*. Enables: offline-first (local OCR), quality routing (complex → Vision LLM), cost optimization, A/B testing providers.

### Consequences
- **Positive**: Extensible, testable, multi-provider routing
- **Negative**: Abstraction overhead, more interfaces to maintain
- **Risk**: Provider interface drift as capabilities expand

### References
- `src/lib/providers/`, `src/lib/processing/`, `supabase/functions/process-document/`

---

## ADR-0008: CSS-Percentage Coordinate System for UI Overlays

**Date**: 2024-07-11
**Status**: Accepted
**Category**: Architecture
**Decision Makers**: Tech Lead
**Future Review Date**: 2025-07-11

### Problem
Overlay elements (OCR blocks, highlights, vision boxes) must stay perfectly aligned during zoom/rotation.

### Context
Bounding boxes from providers normalized [0-1]. PDF canvas scales via CSS transform.

### Decision
**Render overlays as absolutely positioned divs inside `inset-0` container using CSS percentages** (`left: 10%`, `width: 25%`, etc.). No JavaScript recalculation on zoom/pan.

### Reasoning
Browser handles percentage layout natively during transform. Zero JS overhead. Perfect alignment at any scale. Works with `react-pdf` canvas renderer.

### Consequences
- **Positive**: Jitter-free, performant, simple
- **Negative**: Requires normalized coords from all providers
- **Risk**: Sub-pixel rounding at extreme zoom (mitigated: `will-change: transform`)

### References
- `src/components/pdf/overlays/*.tsx`
- `src/lib/processing/HighlightEngine.ts`

---

## ADR-0009: On-Demand AI Gateway

**Date**: 2024-07-11
**Status**: Accepted
**Category**: Architecture
**Decision Makers**: Tech Lead
**Future Review Date**: 2025-07-11

### Problem
LLM generation (summaries, flashcards, Q&A) shouldn't run automatically for every page — wastes credits, slow.

### Context
Processing pipeline runs on upload. AI generation should be user-initiated.

### Decision
**AIGateway** as on-demand service called from UI components (`ChatSidebar`, `KnowledgeSidebar`). Not a mandatory stage in `ProcessingEngine`. `AIGateway` handles: provider routing, plan enforcement, credit quotas, rate limiting, prompt injection detection, streaming.

### Reasoning
User controls when AI runs. Credits consumed only for explicit actions. Simpler processing pipeline (no async AI stage).

### Consequences
- **Positive**: Credit predictability, user control, simpler pipeline
- **Negative**: Two entry points for AI (Gateway + ProcessingEngine for vision)
- **Risk**: Inconsistent provider selection between Gateway and Engine

### References
- `src/lib/providers/ai/MockAIProvider.ts`
- `src/stores/chatStore.ts`, `knowledgeStore.ts`
- `supabase/functions/ai-gateway/index.ts`

---

## ADR-0010: Highlights Coordinate System

**Date**: 2024-07-11
**Status**: Accepted
**Category**: Architecture
**Decision Makers**: Tech Lead
**Future Review Date**: 2025-07-11

### Problem
User highlights text in PDF → must persist and render at correct position across zoom/rotation.

### Context
PDF.js provides text layer with DOM positions. Need to map to page-relative coordinates.

### Decision
**HighlightEngine** intersects DOM `Selection` with page container → computes percentage offsets (0.0-1.0) relative to page bbox. Stores normalized coords in DB. `HighlightOverlay` renders as `%`-positioned divs.

### Reasoning
Same percentage system as ADR-0008. No coordinate transformation needed at render time. Selection → percentage is one-way at creation.

### Consequences
- **Positive**: Consistent with overlay system, zoom-independent
- **Negative**: Text selection across page boundaries not supported (single page only)
- **Risk**: PDF.js text layer position drift (mitigated: use `getBoundingClientRect` on page container)

### References
- `src/lib/processing/HighlightEngine.ts`
- `src/components/pdf/overlays/HighlightOverlay.tsx`
- `src/stores/highlightStore.ts`

---

## ADR-0011: Ledger-Based Credit System

**Date**: 2024-07-11
**Status**: Accepted
**Category**: Architecture
**Decision Makers**: Tech Lead, Product Owner
**Future Review Date**: 2025-07-11

### Problem
Credit system must be auditable, prevent manipulation, support reservations, buckets, quotas.

### Context
Naive `credits -= cost` is vulnerable to race conditions, fraud, audit gaps.

### Decision
**Immutable `credit_ledger`** (append-only, never UPDATE/DELETE). `direction: +1/-1`. `entry_type` enum (11 values). `credit_reservations` with `expires_at` for pending operations. Settlement: `reserved → consumed` or `reserved → released`. Monthly quotas via `credit_buckets`. Circuit breaker at 10,000 credits/day/workspace. All consumption in Edge Functions (service_role only).

### Reasoning
Financial-grade audit trail. Reservations prevent overcommit. Buckets enforce monthly quotas. Circuit breaker prevents runaway. Frontend cannot consume directly.

### Consequences
- **Positive**: Auditability, correctness, abuse prevention
- **Negative**: Complexity (ledger + reservations + buckets + quotas)
- **Risk**: Ledger growth (mitigated: partition by month, archive)

### References
- `supabase/migrations/20240707000000_credit_system.sql`
- `supabase/migrations/20240711000006_credit_buckets.sql`
- `supabase/functions/ai-gateway/index.ts`
- `src/repositories/billingRepository.ts`

---

## ADR-0012: Supabase RLS for Authorization

**Date**: 2024-07-11
**Status**: Accepted
**Category**: Security
**Decision Makers**: Tech Lead
**Future Review Date**: 2025-07-11

### Problem
Enforce workspace isolation at database level. No frontend authorization checks.

### Context
Multi-tenant: users belong to workspaces. Documents, highlights, chats, credits scoped to workspace.

### Decision
**Row Level Security on ALL tables**. Policies use `get_user_workspace_ids()` helper (returns workspace UUIDs for current `auth.uid()`). Pattern: `USING (workspace_id IN (SELECT get_user_workspace_ids()))`. Frontend uses `anon` key. Edge Functions use `service_role` for writes (billing, processing).

### Reasoning
Defense in depth. Even if frontend bug leaks data, RLS blocks. Single source of truth for permissions. Supabase manages auth context.

### Consequences
- **Positive**: Zero-trust data layer, simpler frontend, audit-friendly
- **Negative**: RLS policy complexity, debugging harder
- **Risk**: `service_role` bypasses RLS — must be carefully scoped to Edge Functions only

### References
- `supabase/migrations/20240702000000_rls_policies.sql`
- `supabase/functions/*.ts` (all use service_role)

---

## ADR-0013: Stripe Checkout Sessions for Billing

**Date**: 2024-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2025-07-11

### Problem
Integrate payments for credit packages and subscriptions.

### Context
Stripe is industry standard. Need: one-time credit purchases, subscription management, webhook reconciliation.

### Decision
**Stripe Checkout Sessions** (`create-checkout-session` Edge Function). `client_reference_id = workspace_id`. Metadata: `workspace_id`, `user_id`, `package_id`, `credits`. Webhook (`stripe-webhook`) handles `checkout.session.completed` → credits granted via ledger. `payment_events` table for idempotency (`external_event_id` unique).

### Reasoning
Stripe hosts payment UI (PCI compliance). Checkout Session supports both one-time and subscription. Webhook is source of truth for fulfillment.

### Consequences
- **Positive**: No card data touches our servers, Stripe handles tax/VAT, portable
- **Negative**: Async fulfillment (webhook delay), webhook reliability critical
- **Risk**: Webhook signature verification not yet implemented in `stripe-webhook`

### References
- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `src/components/billing/PurchaseCredits.tsx`

---

## ADR-0014: Zustand for Global State

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
Choose state management for React 19 app.

### Context
Options: Redux Toolkit, Context + useReducer, Zustand, Jotai, Recoil, Signals.

### Decision
**Zustand 5.0.6** with `immer` middleware. 9 stores (user, workspace, document, viewer, pageRegistry, chat, knowledge, highlight, billing, ui). No Context for state.

### Reasoning
Minimal boilerplate (no providers). Mutable syntax via Immer. Selectors prevent over-renders. DevTools support. Works with React 19. No "stale closure" issues like Context.

### Consequences
- **Positive**: Simple, performant, TypeScript-friendly, small bundle (~1KB)
- **Negative**: No built-in async middleware (handled manually in actions)
- **Risk**: Store proliferation (mitigated: clear domain boundaries)

### References
- `src/stores/*.ts`

---

## ADR-0015: TanStack React Virtual for PDF Page List

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
Virtualize thumbnail list for 300+ page PDFs.

### Context
See ADR-0006. `@tanstack/react-virtual` chosen over `react-window`.

### Decision
**@tanstack/react-virtual 3.11.2** with `useVirtualizer`. Dynamic item sizing via `measureElement`. Overscan: 5. Horizontal + vertical support.

### Reasoning
Headless, framework-agnostic, active maintenance, dynamic measurement API superior.

### Consequences
- **Positive**: Smooth scrolling, flexible layout
- **Negative**: Manual measurement setup required

### References
- `src/components/pdf/PDFPageList.tsx`

---

## ADR-0016: React-PDF (PDF.js) for Rendering

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
Render PDF pages in React with high fidelity, text selection, zoom.

### Context
Options: `react-pdf` (PDF.js wrapper), `pdfjs-dist` direct, `PDFObject`, iframe.

### Decision
**@react-pdf/renderer 9.2.1** (wrapper around PDF.js 5.3.31). Canvas renderer. Worker via Vite plugin (`vite-plugin-static-copy` or CDN). Text layer enabled for selection.

### Reasoning
React-native API, maintained by Adobe, PDF.js 5.x fast, text selection works out of box.

### Consequences
- **Positive**: High-quality rendering, text selection, React integration
- **Negative**: Bundle size (~2MB worker), memory for large PDFs
- **Risk**: PDF.js worker version mismatch (pinned in `vite.config.ts`)

### References
- `src/components/pdf/PDFPage.tsx`
- `vite.config.ts` (worker copy)

---

## ADR-0017: Framer Motion for Animations

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Designer, Tech Lead
**Future Review Date**: 2027-01-11

### Problem
Declarative, spring-based animations for modals, sidebars, flip cards, page transitions.

### Context
CSS animations limited for dynamic values. `framer-motion` vs `motion-one` vs `react-spring`.

### Decision
**framer-motion 12.23.12**. `AnimatePresence` for exit animations. `layout` prop for FLIP. `whileHover`, `whileTap` for micro-interactions. 3D flip for `StudyModeOverlay`.

### Reasoning
Best API for React. Spring physics feel natural. Exit animations critical for modals/sheets. 3D transform support for flashcards.

### Consequences
- **Positive**: Beautiful animations, easy API, `layout` magic
- **Negative**: Bundle size (~18KB gzipped)
- **Risk**: Version 12 breaking changes from v11

### References
- `src/components/knowledge/StudyModeOverlay.tsx` (3D flip)
- `src/components/ui/Dialog.tsx`, `Sheet.tsx` (exit animations)

---

## ADR-0018: Sonner for Toasts

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
Toast notification system.

### Context
Options: `react-hot-toast`, `sonner`, `react-toastify`, custom.

### Decision
**sonner 2.0.7**. Headless, accessible, promise API, action buttons, swipable, dark mode native.

### Reasoning
Modern API (`toast.promise`), accessible by default, small (~4KB), active maintenance.

### Consequences
- **Positive**: Great UX, promise handling, actions
- **Negative**: Opinionated styling (customizable via CSS vars)

### References
- `src/components/ui/Toaster.tsx`
- `src/stores/uiStore.ts` (toast helpers)

---

## ADR-0019: Oxlint for Linting

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
Fast, reliable linting for TypeScript/React.

### Context
ESLint slow, config complexity. Oxlint (Rust-based) 10-100x faster.

### Decision
**oxlint 0.15.1** via `eslint.config.js` (flat config). Rules: recommended + React + TypeScript + JSX a11y + import/order.

### Reasoning
Speed enables lint-on-save, pre-commit without lag. Compatible with ESLint configs.

### Consequences
- **Positive**: Instant feedback, catches real bugs
- **Negative**: Fewer rule customization options than ESLint

### References
- `eslint.config.js`

---

## ADR-0020: Vitest for Unit/Component Testing

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
Test runner for unit and component tests.

### Context
Jest slow, config heavy. Vitest native Vite integration, same API.

### Decision
**Vitest 4.1.10**. `jsdom` environment. `@testing-library/react` for components. `vi.mock` for Supabase/client mocks.

### Reasoning
Zero-config with Vite. Fast HMR for tests. Jest-compatible API.

### Consequences
- **Positive**: Fast, integrated, familiar API
- **Negative**: `jsdom` not real browser (use Playwright for E2E)

### References
- `vitest.config.ts`
- `docs/TESTING.md`

---

## ADR-0021: Playwright for E2E Testing

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
End-to-end testing in real browser.

### Context
Cypress, Playwright, WebdriverIO.

### Decision
**Playwright 1.61.1**. Brave/Chromium. Trace viewer. Auto-wait. Parallel. `webServer` for dev server.

### Reasoning
Best multi-browser support. Trace debugging. Microsoft backing. Good CI integration.

### Consequences
- **Positive**: Reliable, debuggable, fast parallel
- **Negative**: Heavier than Cypress

### References
- `playwright.config.ts` (future)
- `docs/TESTING.md`

---

## ADR-0022: Semantic Versioning + Conventional Commits

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Process
**Decision Makers**: Project Owner
**Future Review Date**: 2027-01-11

### Problem
Versioning and changelog discipline.

### Decision
**SemVer** (MAJOR.MINOR.PATCH). **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). `pnpm version` for tagging. `CHANGELOG.md` updated per release.

### Reasoning
Automatable release notes. Clear communication of breaking changes. Tooling support (`standard-version`, `release-it`).

### Consequences
- **Positive**: Predictable versions, automated changelog
- **Negative**: Commit message discipline required

### References
- `docs/CHANGELOG.md`
- `docs/DEPLOYMENT.md` (Release Process)

---

## ADR-0023: Feature Flags via Plan Gating (Not Config)

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Architecture
**Decision Makers**: Product Owner, Tech Lead
**Future Review Date**: 2027-01-11

### Problem
Gate features by plan (Free/Pro/Max) without complex feature flag system.

### Context
Features: Pro models, higher quotas, advanced knowledge tools, priority processing.

### Decision
**Plan enforcement in `ai-gateway` Edge Function**. Frontend shows/hides UI based on `billingStore.plan` but enforcement is server-side. No separate feature flag service.

### Reasoning
Simple. Plan = feature set. No drift between UI and enforcement. Easy to audit.

### Consequences
- **Positive**: Single source of truth, no flag sync issues
- **Negative**: Plan changes require Edge Function deploy
- **Risk**: UI/backend mismatch during deploy (mitigated: backward compatible)

### References
- `supabase/functions/ai-gateway/index.ts`
- `src/stores/billingStore.ts`

---

## ADR-0024: No Public REST API (v1)

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Architecture
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-07-11

### Problem
Whether to expose public API.

### Context
Frontend uses Supabase Client (PostgREST) + Edge Functions. No external consumers yet.

### Decision
**No public REST API in v1**. All access via Supabase Client (RLS-enforced) or Edge Functions (authenticated). Public API deferred to post-launch.

### Reasoning
Reduces surface area. RLS + Edge Functions sufficient for frontend. API design can evolve with real use cases.

### Consequences
- **Positive**: Simpler security, faster iteration
- **Negative**: No programmatic access for users
- **Risk**: Future API design constrained by current internal patterns

---

## ADR-0025: Local-First OCR via Tesseract.js (WASM)

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
OCR provider for scanned documents. Must work offline, no API costs.

### Context
Options: Tesseract.js (WASM), PaddleOCR (Python/WASM), cloud APIs (Google Vision, AWS Textract).

### Decision
**Tesseract.js 6.0.1** in browser (WASM). `TesseractOCRProvider` implements `OCRProvider` interface. Runs in Web Worker. Supports 100+ languages. No server cost. Offline-capable.

### Reasoning
Zero marginal cost. Privacy (images never leave browser). Works offline. Good enough for Latin scripts.

### Consequences
- **Positive**: Free, private, offline, no API keys
- **Negative**: Slower than cloud (CPU WASM), lower accuracy on complex layouts, large WASM (~15MB)
- **Risk**: Memory pressure on mobile (mitigated: process page-by-page, release worker)

### References
- `src/lib/providers/ocr/TesseractOCRProvider.ts`
- `src/lib/providers/interfaces/OCRProvider.ts`

---

## ADR-0026: Mock AI Provider for Development

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
Develop/test AI features without API keys, costs, latency.

### Decision
**MockAIProvider** implements `AIProvider` interface. Returns deterministic, structured responses for all action types (chat, flashcards, glossary, mindmap, timeline, presentation). Used in development, tests, preview deployments without Gemini key.

### Reasoning
Enables full-stack dev without credentials. Deterministic for testing. CI runs without secrets.

### Consequences
- **Positive**: Zero-cost dev, fast iteration, testable
- **Negative**: Must maintain mock responses as schemas evolve

### References
- `src/lib/providers/ai/MockAIProvider.ts`
- `src/lib/providers/interfaces/AIProvider.ts`

---

## ADR-0027: Dark Theme Only (v1)

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Design
**Decision Makers**: Designer, Product Owner
**Future Review Date**: 2027-01-11

### Problem
Support light/dark theme?

### Decision
**Dark theme only for v1**. CSS variables defined for dark. Light theme tokens defined but not implemented. `prefers-color-scheme` ignored.

### Reasoning
PDF viewing better in dark. Reduces design/development scope. Consistent brand (Lumena = light in dark).

### Consequences
- **Positive**: Faster launch, consistent look
- **Negative**: Accessibility concern for light-preference users
- **Risk**: Light theme retrofit effort later

### References
- `src/index.css` (`@theme` block)
- `docs/DESIGN.md` (Color System)

---

## ADR-0028: Command Palette (⌘K) via cmdk

**Date**: 2026-07-11
**Status**: Accepted
**Category**: Technology
**Decision Makers**: Tech Lead
**Future Review Date**: 2027-01-11

### Problem
Global command palette for navigation, actions, shortcuts.

### Context
Options: `cmdk`, `react-cmdk`, custom + Radix Command.

### Decision
**cmdk 1.0.4** (Radix-based). Fuzzy search, groups, keyboard nav, async items.

### Reasoning
Radix accessibility. Active maintenance. Flexible item rendering.

### Consequences