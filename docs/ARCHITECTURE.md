# Lumena Workspace

Architecture Specification

Version: 1.0

Status: Implemented (Phases 1-11 Complete)

Last Updated: 2026-07-26

---

# Table of Contents

1. Architecture Goals
2. High-Level Overview
3. Core Principles
4. Frontend Architecture
5. Backend Architecture
6. AI Gateway
7. OCR Pipeline
8. PDF Engine
9. Workspace Engine
10. Storage Architecture
11. Database
12. Authentication
13. Credits System
14. AI Providers
15. AI Models
16. Processing Pipeline
17. Cache Strategy
18. Background Jobs
19. Security Architecture
20. Observability
21. Deployment
22. Scalability
23. Future Extensions
24. Provider Framework
25. UI Overlay Architecture
26. AI Gateway (Phase 6)
27. Highlights System (Phase 7)
28. Chat System (Phase 8)
29. Billing System (Phase 9)
30. Knowledge Tools System (Phase 10)

---

# 1. Architecture Goals

Lumena Workspace is designed as a modular AI platform.

The architecture must remain maintainable, scalable, and provider-independent.

Every subsystem must be replaceable without requiring a complete rewrite.

No component should directly depend on a specific AI provider.

The architecture should allow the platform to evolve over multiple years.

---

# 2. High-Level Overview

The platform consists of several independent layers:

```
User
  ↓
Frontend (React 19 + TypeScript + Vite)
  ↓
Backend API Layer (Supabase: PostgreSQL + Auth + Storage + Edge Functions)
  ├─────────────────┬─────────────────┬─────────────────┐
  ↓                 ↓                 ↓                 ↓
AI Gateway       Workspace Engine  Authentication    Storage
  ↓                 ↓                 ↓
AI Providers    PostgreSQL         OAuth Providers   Object Storage
  ↓
OCR → Analysis → Highlights → Cache
```

Each layer has a single responsibility.

---

# 3. Core Principles

## Separation of Concerns

- Every module has one responsibility
- UI never contains business logic
- Business logic never contains provider-specific implementations
- Providers never interact directly with the frontend

---

## Replaceable Components

Every subsystem must be replaceable:

| Subsystem | Replacement Strategy |
|-----------|---------------------|
| OCR Engine | Provider Framework (OCRProvider interface) |
| PDF Engine | react-pdf + custom virtualization |
| Authentication | Supabase Auth (swappable via AuthRepository) |
| Payments | Stripe via Edge Functions |
| Storage | Supabase Storage (S3-compatible abstraction) |
| AI Providers | AI Gateway with Provider Framework |
| Vector Database | Future: dedicated module |

---

## Progressive Processing

Large documents are never fully processed by default.

Pipeline:
```
Upload
  ↓
Inspect (detect digital vs scanned)
  ↓
Extract (native text or render to images)
  ↓
Select (user chooses pages)
  ↓
Analyze (OCR, Layout, Vision, AI)
  ↓
Cache (ledger + page registry)
  ↓
Reuse (instant subsequent access)
```

---

## Provider Independence

No provider-specific logic should leak outside the AI Gateway.

Switching providers requires configuration rather than architectural changes.

---

# 4. Frontend Architecture

The frontend is responsible **only** for user interaction.

**Responsibilities:**
- Workspace management
- Document viewer (PDF rendering, virtualization, zoom, navigation)
- Chat interface (streaming, sessions, model selector)
- Highlight rendering (CSS-percentage overlays)
- Authentication UI (OAuth, email/password, reset)
- Billing UI (plans, credits, transactions, Stripe checkout)
- Settings (profile, appearance, notifications, shortcuts)
- Search (global + document)
- Notes (future)
- Mind Maps / Flashcards / Timeline / Presentations (Phase 10)

**No AI secrets are stored in the frontend.**

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 |
| Language | TypeScript (strict) |
| Bundler | Vite 8 |
| Routing | React Router 7 |
| Styling | Tailwind CSS v4 (CSS-first, @tailwindcss/vite) |
| State Management | Zustand (9 stores) |
| Server State | TanStack Query v5 |
| PDF Rendering | react-pdf (PDF.js) + @tanstack/react-virtual |
| Animations | Framer Motion |
| Icons | Lucide React |
| UI Primitives | Radix UI (Dialog, DropdownMenu, Tooltip, Select, Avatar, Slot) |
| Toasts | Sonner |
| Forms | Native inputs + custom components |
| Internationalization | Custom i18n (en/es) |
| Code Quality | oxlint + TypeScript strict mode |

---

## State Management (Zustand Stores)

| Store | Responsibility |
|-------|----------------|
| `userStore` | Auth user, profile, session persistence |
| `workspaceStore` | Workspaces, documents, realtime processing subscriptions |
| `viewerStore` | PDF viewer state (page, zoom, rotation, fit mode) |
| `pageRegistryStore` | Per-page processing status (OCR, Layout, Vision, AI, Highlights) |
| `chatStore` | Chat sessions, messages, streaming |
| `knowledgeStore` | Flashcards, Glossary, Mind Maps, Timelines, Presentations |
| `highlightStore` | Highlights, categories, per-page queries |
| `billingStore` | Subscription, credit account, ledger, packages |
| `uiStore` | Theme, language, view mode, sort, sidebar, command palette, right panel |

---

## Component Architecture

```
src/components/
├── ui/              # Primitive components (Button, Input, Card, etc.)
├── layout/          # AppLayout, Sidebar, Topbar
├── pdf/             # PDFViewer, PDFPage, PDFPageList, PDFToolbar, HighlightEditor
├── pdf/overlays/    # LayoutOverlay, OCROverlay, VisionOverlay, HighlightOverlay
├── chat/            # ChatSidebar, ChatMessage, ChatInput
├── knowledge/       # KnowledgeSidebar, FlashcardsView, GlossaryView, MindMapView, TimelineView, StudyModeOverlay
├── billing/         # UpgradeModal
├── error/           # ErrorBoundary, GenericError, NotFound, LoadingPage
└── processing/      # ProcessingCenter
```

---

# 5. Backend Architecture

The backend is implemented as **Supabase Edge Functions (Deno)**.

**Responsibilities:**
- Authentication (Supabase Auth)
- Authorization (RLS policies)
- Credits (ledger, reservations, settlement)
- Billing (Stripe Checkout, Webhooks)
- OCR orchestration (Provider Framework)
- AI orchestration (AI Gateway)
- Caching (page registry, credit accounts)
- Rate limiting (per-workspace, per-hour)
- Document processing (storage, metadata, jobs)
- Logging (processing_logs, security_events)
- Audit events

---

## Edge Functions

| Function | Path | Responsibility |
|----------|------|----------------|
| `ai-gateway` | `/functions/v1/ai-gateway` | Central AI router: plan enforcement, credit quotas, rate limiting, circuit breaker, prompt injection detection, provider fallback, streaming |
| `generate-knowledge` | `/functions/v1/generate-knowledge` | Generates Flashcards, Glossary, Mind Maps, Timelines, Presentations from document text via Gemini |
| `process-document` | `/functions/v1/process-document` | Document processing pipeline with credit reservation/settlement |
| `create-checkout-session` | `/functions/v1/create-checkout-session` | Stripe Checkout for credit packages |
| `stripe-webhook` | `/functions/v1/stripe-webhook` | Handles `checkout.session.completed` → grants credits |

---

# 6. AI Gateway

The AI Gateway is the heart of the platform (`supabase/functions/ai-gateway/index.ts`).

**Responsibilities:**
- Provider routing (Gemini Flash/Pro)
- Model routing (plan-aware)
- Fallback handling
- Streaming (via mocked chunks from sync call)
- Structured Outputs (JSON for knowledge tools)
- Retries & Timeouts
- Cost estimation
- Credits calculation (reserve → consume → settle)
- Usage logging (usage_jobs table)
- Health monitoring
- Circuit breakers

**Security Layers:**
1. **Prompt Injection Check**: Regex-based detection (blocks `ignore instructions`, `system prompt`, etc.)
2. **Rate Limiting**: 50 actions/hour per workspace (fixed window, stored in `rate_limit_counters`)
3. **Circuit Breaker**: Daily credit cap of 10,000 credits per workspace
4. **Plan Enforcement**: Model access by subscription (Free: Flash only; Pro: Flash + Pro)
5. **Monthly Quota**: Free: 50 credits/month; Pro: 1000 credits/month

**Credit Flow:**
```
1. Estimate input/output tokens → estimate USD cost → convert to credits (credit_conversion_rate)
2. Reserve credits (deduct from available, add to reserved)
3. Create usage_job (status: pending)
4. Call provider (Gemini)
5. Calculate actual cost from returned token counts
6. Settle reservation (release reserved, update available/consumed)
7. Write credit_ledger entry (entry_type: consume)
8. Return result + usage metadata
```

---

# 7. OCR Pipeline

The OCR pipeline is provider-independent via the **Provider Framework**.

**Stages:**
```
Detect page type
  ↓
Digital text  ──► Extract directly
OR
Scanned page  ──► OCR
  ↓
Bounding Boxes
  ↓
Normalization
  ↓
Store
  ↓
Ready for AI
```

OCR should only execute when necessary.

**Implemented Provider:** Tesseract.js (`TesseractOCRProvider`)
- Runs locally in browser via WebAssembly
- Supports: en, es, fr, de, pt
- Offline-capable
- Quality score: 60/100 (basic)
- Priority: 10 (ultimate fallback)

**Configured Fallback Chain:** `surya-ocr` → `paddle-ocr` → `mistral-ocr` → `tesseract-ocr`

---

# 8. PDF Engine

**Responsibilities:**
- Rendering (react-pdf / PDF.js)
- Virtualization (@tanstack/react-virtual)
- Zoom (0.25x - 5.0x, step 0.25)
- Selection (DOM → normalized coordinates)
- Annotations (future)
- Highlight overlays (CSS-percentage based)
- Logical page mapping
- Search (PDF.js text layer)
- Navigation (keyboard + toolbar)
- Export (future)

**Architecture Decision:** The original PDF must never be modified. Highlights exist as overlay layers.

---

## Document Virtualization Layer

The PDF rendering engine uses `react-pdf` (PDF.js) for canvas and text rendering, and `@tanstack/react-virtual` for document virtualization. This architecture guarantees smooth scrolling performance for documents exceeding 300 pages by only rendering the currently visible pages plus a small overscan buffer.

---

## PDFPage Component - Layered Z-Index Architecture

```
Layer 1: PDF Canvas (react-pdf)
Layer 2: Text Layer (react-pdf)
Layer 3: Annotation Layer (future)
Layer 4: Highlight Layer (HighlightOverlay)
Layer 5: OCR Layer (OCROverlay)
Layer 6: Selection Layer (future)
Layer 7: AI Overlay Layer (VisionOverlay)
```

---

# 9. Workspace Engine

The Workspace represents the central object.

A Workspace contains:
- Documents
- Chat History
- Highlights
- Notes
- Future AI artifacts
- Credits usage
- Settings
- Permissions

The Workspace becomes the shared context for every AI interaction.

---

# 10. Storage Architecture

Different data types stored separately:

| Data Type | Storage |
|-----------|---------|
| Raw Files (PDFs) | Supabase Storage (`workspace_documents` bucket) |
| Metadata | PostgreSQL (`documents`, `workspaces`, etc.) |
| OCR Results | Page Registry (in-memory) + future cache table |
| Highlights | PostgreSQL (`highlights` with JSONB rects) |
| Temporary Processing | Edge Function memory + `processing_jobs` table |

---

# 11. Database

PostgreSQL via Supabase. Stores only structured information.

**Key Tables:**

| Domain | Tables |
|--------|--------|
| Users | `profiles` |
| Workspaces | `workspaces`, `workspace_members` |
| Documents | `documents`, `processing_jobs`, `processing_events`, `processing_logs` |
| Pages | `page_registry` (in-memory store, future DB table) |
| Highlights | `highlights`, `highlight_categories` |
| Chat | `chat_sessions`, `chat_messages` |
| Knowledge | `flashcards`, `glossary_terms`, `mind_map_nodes`, `timeline_events`, `presentations` |
| Credits | `credit_accounts`, `credit_buckets`, `credit_ledger`, `credit_reservations` |
| Billing | `plans`, `plan_prices`, `subscriptions`, `billing_customers`, `credit_packages`, `purchases`, `payment_events` |
| AI Providers | `providers`, `provider_models`, `provider_pricing`, `usage_jobs` |
| Security | `rate_limit_counters`, `security_events` |
| Settings | `user_settings` |

**Enums:**
- `chat_role`: user | assistant | system
- `document_status`: uploading | processing | ready | error
- `job_status`: queued | inspecting | extracting | ocr | layout | completed | failed | retrying | cancelled | paused | processing
- `ledger_entry_type`: grant_plan | grant_purchase | grant_promotion | reserve | release | consume | refund | expire | chargeback_hold | chargeback_reversal | manual_adjustment
- `plan_type`: free | pro | team | enterprise
- `reservation_status`: pending | confirmed | partially_settled | released | expired | cancelled | failed
- `subscription_status`: trialing | active | past_due | canceled | unpaid | incomplete | incomplete_expired | paused
- `transaction_type`: grant | purchase | usage
- `workspace_role`: owner | member | viewer

**RLS Helper:** `get_user_workspace_ids()` returns workspace IDs for current user.

**Triggers:** `on_workspace_created_create_account` auto-creates `credit_accounts` row.

---

# 12. Authentication

Handled independently via Supabase Auth.

**Providers:**
- Google OAuth
- GitHub OAuth
- Magic Links (email)
- Email/Password

**Future Enterprise SSO:** SAML, OIDC

**Authorization:** Always validated server-side (RLS policies + Edge Function checks).

---

# 13. Credits System

Credits are an internal currency. System uses a **ledger architecture**.

**Operations:**
- Reserve (deduct available, add reserved)
- Consume (move from reserved to consumed, write ledger)
- Refund (add to available, write ledger)
- Expire (move from available to expired)
- Purchase (add to available via credit_buckets)
- Monthly Allocation (grant_plan entry)

**No operation directly modifies balances.** Balances are calculated from ledger entries.

**Tables:**
- `credit_accounts`: workspace_id (PK), available, reserved, consumed, expired
- `credit_buckets`: source_type, original_amount, remaining_amount, expires_at, priority
- `credit_ledger`: entry_type, amount, direction (±1), reservation_id, job_id, idempotency_key
- `credit_reservations`: requested_amount, reserved_amount, settled_amount, status, expires_at

**Edge Function Integration:** `process-document` and `ai-gateway` handle all credit operations. Frontend cannot directly consume credits.

---

# 14. AI Providers

Supported providers abstracted via Provider Framework.

| Provider | Code | Status |
|----------|------|--------|
| Google | `google` | Active (Gemini 1.5 Flash/Pro) |
| OpenAI | `openai` | Configured |
| Future | - | Pluggable |

Providers can be added without frontend changes.

---

# 15. AI Models

Model layer is independent.

**Available Models:**
| Code | Name | Provider | Max Input | Max Output | Plan |
|------|------|----------|-----------|------------|------|
| `gemini-1.5-flash` | Gemini 1.5 Flash | Google | 1M | 8K | Free |
| `gemini-1.5-pro` | Gemini 1.5 Pro | Google | 2M | 8K | Pro |

**Pricing (stored in `provider_pricing`):**
- Flash: $0.0001/1K input, $0.0003/1K output, 100 credits/$
- Pro: $0.0035/1K input, $0.0105/1K output, 100 credits/$

Users may choose: Automatic or Manual. Platform exposes only curated models.

---

# 16. Processing Pipeline

```
Upload
  ↓
Validation (file type, size ≤ 50MB)
  ↓
Virus Scan (future)
  ↓
Storage (Supabase Storage)
  ↓
Metadata Extraction (page count, file hash)
  ↓
Page Detection
  ↓
OCR Decision (InspectionStage: hasNativeText?)
  ↓
Extraction (ExtractionStage: stream pages as image Blobs)
  ↓
AI Analysis (on-demand via AI Gateway)
  ↓
Highlights (user-created or AI-suggested)
  ↓
Cache (pageRegistryStore + future persistent cache)
  ↓
Ready
```

---

# 17. Cache Strategy

Cache exists at multiple levels:

| Level | Implementation |
|-------|----------------|
| Document Hash | Future: content-addressable storage |
| Page Hash | Future: per-page cache keys |
| OCR | In-memory pageRegistryStore (ocrStatus, ocrData) |
| Highlights | In-memory highlightStore + DB |
| AI Responses | In-memory chatStore/knowledgeStore + DB |
| Embeddings | Future: vector database |
| Knowledge Graph | Future: dedicated graph store |

Cache should minimize repeated AI calls.

---

# 18. Background Jobs

Long-running tasks never block the UI.

**Examples:**
- OCR (via `process-document` Edge Function)
- AI Analysis (via `ai-gateway`)
- Embedding generation (future)
- Podcast generation (future)
- Mind Maps (via `generate-knowledge`)
- Infographics (future)
- Presentation generation (via `generate-knowledge`)
- Email notifications (future)

---

# 19. Security Architecture

The platform follows Zero Trust principles.

- All uploads are untrusted (validated in `process-document`)
- All requests are authenticated (Supabase JWT)
- All permissions are verified (RLS + Edge Function checks)
- Secrets remain server-side (Deno.env in Edge Functions)
- Rate limiting applies globally (50 actions/hour/workspace)
- Least privilege enforced (RLS policies, service_role for writes)
- Audit logs for sensitive operations (`security_events`)

---

# 20. Observability

Every subsystem generates logs.

| Subsystem | Logs |
|-----------|------|
| Errors | `console.error` + `security_events` |
| Warnings | `console.warn` |
| Credits | `credit_ledger` entries |
| AI Usage | `usage_jobs` table |
| Latency | Provider metadata (executionTime) |
| Provider Health | `healthCheck()` in Provider Framework |
| Fallbacks | `ProviderFallback` logs |
| Uploads | `processing_jobs` + `processing_logs` |
| Failures | Error boundaries + Sentry (future) |
| Retries | `retry_count` in `processing_jobs` |

Metrics support debugging without exposing user data.

---

# 21. Deployment

| Layer | Target |
|-------|--------|
| Frontend | Vercel (Preview + Production) |
| Backend | Supabase Edge Functions (Deno) |
| Storage | Supabase Storage (S3-compatible) |
| Database | Supabase PostgreSQL (Managed) |
| Background Workers | Supabase Edge Functions (cron) / Future: dedicated service |

Every deployment must support Preview Environments.

---

# 22. Scalability

The architecture should support:
- Millions of documents
- Multiple AI providers
- Horizontal scaling (Edge Functions auto-scale)
- Worker pools (future: dedicated processing service)
- Future mobile applications
- Future desktop applications
- Future APIs
- Future enterprise customers

No architectural decision should prevent future scaling.

---

# 23. Future Extensions

The architecture supports future modules without redesign:

- Mind Maps
- Flashcards
- Podcasts
- Infographics
- Knowledge Graph
- Presentation Generator
- Study Assistant
- Public API
- Browser Extension
- Desktop Application
- Mobile Application
- Collaborative Editing
- Enterprise Features

Everything integrates through the Workspace rather than creating isolated systems.

---

# 24. Provider Framework

The Provider Framework abstracts concrete implementations of OCR, Layout, Vision, and AI processing from core business logic.

## Goal

Lumena must never depend on a single processing engine. Adding a new OCR, Layout, Vision, or AI provider requires only creating a new provider class and registering it.

## Abstraction Layers

The framework defines generic interfaces for each capability:
- `OCRProvider`
- `LayoutProvider`
- `VisionProvider`
- `TextExtractor`
- `DocumentInspector`
- `AIProvider`

Every provider must implement a common lifecycle: `initialize()`, `dispose()`, `healthCheck()`, and `getMetadata()`.

## Provider Metadata & Results

Each provider exposes rich metadata:
- Hardware requirements (GPU/CPU/Offline)
- Language support
- Average latency
- Estimated cost
- Quality/confidence scores
- Priority

This metadata drives the Routing Engine.

Outputs are wrapped in a standardized `ProviderResult` wrapper containing:
- `data`: typed result
- `confidence`: 0-1
- `executionTime`: ms
- `providerId`: string
- `metadata`: additional context

## Registry and Routing

- `ProviderRegistry`: Central repository for all active providers. Supports runtime registration, enablement, and capability lookups.
- `ProviderRouter`: Dynamic selection engine. Given a `DocumentProfile` (has images, tables, math, handwriting, multi-column, language), evaluates and scores all compatible providers, selecting the optimal one. No provider is hardcoded in the pipeline.

## Fallback Mechanism

`ProviderFallback` guarantees high availability. Takes a configured sequence of providers (e.g., `surya → paddleocr → mistral-ocr → tesseract`) and sequentially falls back upon failure.

---

# 25. UI Overlay Architecture

The PDF Viewer implements a **CSS-percentage based overlay system** for Layout, OCR, and Vision visualization.

Pipelines yield normalized bounding boxes `[x0, y0, x1, y1]` which are applied as CSS percentages (`left: x0 * 100%`, `width: (x1 - x0) * 100%`) within `absolute inset-0` containers. This ensures bounding boxes scale natively with PDF zoom without requiring JavaScript recalculations on resize.

---

# 26. AI Gateway (Phase 6)

The `AIGateway` acts as the central router for text-generation LLMs. Instead of hardcoding API keys and model names across the application, all requests go through `AIGateway.generate(prompt, context)`.

The gateway uses the existing `ProviderFallback.execute('ai')` logic to automatically select the optimal model (e.g., OpenAI, Anthropic, or Mock) based on the current configuration and availability.

**Frontend Implementation** (`src/lib/providers/AIGateway.ts`):
- Routes securely through Supabase Edge Function `ai-gateway`
- Ensures accurate cost metering, credit reservation, and consumption
- `generateStream()` mocks streaming by chunking the synchronous response

---

# 27. Highlights System (Phase 7)

The Highlight Engine extracts DOM text selections and converts them into normalized PDF coordinates (0.0 to 1.0). Highlights are persisted per-document in the `highlightStore`. The `HighlightOverlay` renders absolute positioned CSS rectangles based on these normalized bounds, ensuring perfect alignment across all zoom levels without expensive canvas operations. The `HighlightEditor` floats above active selections to assign categories.

---

# 28. Chat System (Phase 8)

The Chat System integrates a conversational sidebar into the PDF Viewer. The UI is connected to the `AIGateway.generateStream` facade, allowing text streams from LLM providers (currently MockAIProvider) to progressively render in real time. The state is centrally managed via `chatStore` to decouple message history from the Viewer components.

**Features:**
- Per-document sessions (auto-created on first message)
- Streaming responses with optimistic UI updates
- Model selector (plan-aware: Free sees Flash only, Pro sees Flash+Pro)
- Message persistence (chat_sessions, chat_messages tables)
- Clear session action

---

# 29. Billing System (Phase 9)

The Billing System handles Subscription Plans (Free vs Pro) and Credit tracking. The `billingStore` manages the state and transactions. The `AIGateway` integrates with the `billingStore` to consume credits (1 credit per generation estimated, actual calculated from token usage) and throws errors if the user has exhausted their monthly balance. Upgrade operations simulate network latency and update the local state optimistically.

**Components:**
- `Billing` page: Plan comparison, credit usage bar, transaction history, credit packages
- `UpgradeModal`: Glassmorphic modal for plan upgrade / credit purchase
- Stripe Checkout integration via `create-checkout-session` Edge Function
- Webhook handling via `stripe-webhook` Edge Function

---

# 30. Knowledge Tools System (Phase 10)

The Knowledge Tools System converts the PDF Viewer into a learning workspace. It includes Flashcards, Glossary, Mind Maps, Timelines, and Presentations, managed by the `knowledgeStore`. The UI is housed in a unified `KnowledgeSidebar` that can be toggled via the `uiStore`'s `activeRightPanel` state. A `StudyModeOverlay` provides an immersive, full-screen review experience for flashcards using 3D CSS transforms for card flipping.

**Implemented Tools:**

| Tool | Component | Store Key | AI Generation |
|------|-----------|-----------|---------------|
| Flashcards | `FlashcardsView` | `flashcards` | ✅ `generate-knowledge` |
| Glossary | `GlossaryView` | `glossary` | ✅ `generate-knowledge` |
| Mind Maps | `MindMapView` | `mindMapNodes` | ✅ `generate-knowledge` |
| Timeline | `TimelineView` | `timelineEvents` | ✅ `generate-knowledge` |
| Presentations | *(Pending UI)* | *(Pending)* | ✅ `generate-knowledge` |

**Study Mode:**
- Full-screen overlay (`StudyModeOverlay`)
- 3D CSS flip animation for cards
- Keyboard navigation (← → to navigate, click/space to flip)
- Progress indicator (card X of Y)

---

# Database Virtualization Layer (Additional)

The PDF rendering engine uses a combination of `react-pdf` (PDF.js) for canvas and text rendering, and `@tanstack/react-virtual` for document virtualization. This architecture guarantees smooth scrolling performance for documents exceeding 300 pages by only rendering the currently visible pages plus a small overscan buffer.

The `PDFPage` component employs a strict Z-index layered design to accommodate the base PDF canvas alongside future interactive overlays:

- Layer 1: PDF Canvas (react-pdf)
- Layer 2: Text Layer (react-pdf)
- Layer 3: Annotation Layer (future)
- Layer 4: Highlight Layer (future)
- Layer 5: OCR Layer (future)
- Layer 6: Selection Layer (future)
- Layer 7: AI Overlay Layer (future)

---

# Provider Framework (Additional)

The Provider Framework manages document processing capabilities through a pluggable architecture.

## `src/lib/providers/`
Contains the core interfaces, metadata schemas, and routing logic for the framework.

- **`types.ts`**: Defines the `ProviderMetadata`, `DocumentProfile`, and `ProviderResult` schemas.
- **`interfaces/`**: Houses the `BaseProvider` interface along with specialized capability interfaces (`OCRProvider`, `VisionProvider`, etc.).
- **`ProviderRegistry.ts`**: A static registry that stores all enabled and available processing providers. Allows registering and querying providers by capability.
- **`ProviderRouter.ts`**: The intelligent routing engine. It evaluates available providers against a `DocumentProfile` (incorporating quality, offline capability, cost, and latency) and dynamically selects the optimal provider for the task.
- **`ProviderFallback.ts`**: A resilience wrapper that orchestrates sequential fallbacks across multiple providers should the primary provider fail.
- **`provider.config.ts`**: Static configuration file defining active fallback sequences and manual capability overrides.

---

# UI Overlays (Additional)

- **LayoutOverlay**: Visualizes structural elements detected on the page (Titles, Paragraphs, Images) using color-coded CSS borders.
- **OCROverlay**: Highlights detected text blocks for debugging.
- **VisionOverlay**: Displays semantic page summaries and grounded visual objects via VLM integration.

---

# AI Gateway System (Additional)

- **AIGateway**: The primary service class for on-demand text generation and LLM calls. Routes to registered AI providers.
- **MockAIProvider**: Simulates an LLM for local development and testing, returning predictable mock responses.

---

# Highlights System (Additional)

- **HighlightOverlay**: Renders the highlights via percentage-based positioning.
- **HighlightEditor**: Contextual pop-up to apply categories/colors to selected text.
- **HighlightEngine**: Converts DOM selection ranges into normalized PDF coordinates.

---

# Chat System (Additional)

- **ChatSidebar**: Main layout container for the chat interface, located on the right side of the viewer.
- **ChatMessage**: UI for a single conversational bubble, differentiating between user and assistant.
- **ChatInput**: Textarea and send button logic.

---

# Billing System (Additional)

- **Billing (Page)**: Redesigned to show Plan comparisons, Credit usage bars, and Transaction History.
- **UpgradeModal**: A glassmorphic modal triggered to upgrade plans or buy credits, simulating a payment gateway.

---

# Knowledge Tools (Additional)

- **KnowledgeSidebar**: Unifies the knowledge tools under tabs for Flashcards, Glossary, Mind Maps, and Timeline.
- **FlashcardsView**: UI to view and add flashcards.
- **GlossaryView**: UI to view and add glossary terms.
- **StudyModeOverlay**: Immersive full-screen overlay to practice flashcards using 3D CSS flip animations.
- **MindMapView & TimelineView**: Placeholders for future graphical integrations.