# Lumena Workspace

Development Roadmap

Version: 1.0

Status: Active Development

Last Updated: 2026-07-26

---

# Table of Contents

1. Development Philosophy
2. Development Rules
3. Phase Overview
4. Block Structure
5. Definition of Done
6. Roadmap

---

# Development Philosophy

Lumena Workspace is developed incrementally.

The platform must never be built in a single implementation phase.

Every block must leave the project in a functional state.

Every completed block must produce a working preview whenever technically possible.

Each block represents a milestone.

The user must approve each milestone before development continues.

---

# Development Rules

The AI agent must:

- Complete one block at a time.
- Never continue automatically.
- Stop after every block.
- Explain every architectural decision.
- Run tests.
- Verify the build.
- Verify the preview.
- Commit changes.
- Push changes.
- Update CHANGELOG.md.
- Update DECISIONS.md.
- Update PROJECT STATUS.

Only after explicit approval may the next block begin.

---

# Definition of Done

A block is considered complete only if:

✓ Project builds successfully

✓ Tests pass

✓ No TypeScript errors

✓ No ESLint/Oxlint errors

✓ Documentation updated

✓ Preview available

✓ User approval requested

---

# Block Output Format

Every completed block must end with the following report.

```
Completed

Files Modified

Preview URL

Build Status

Test Status

Manual Steps

Known Limitations

Next Block

User Approval Required
```

---

# PHASE 0

Project Planning

Goal

Prepare the project before writing production code.

Blocks

## 0.1 Project Inspection

Read documentation
Read AGENTS.md
Read PRODUCT.md
Read ARCHITECTURE.md
Inspect repository
Inspect dependencies
Inspect GitHub
Inspect MCP servers
Inspect available tools
Generate architecture report

STOP

---

## 0.2 Technology Validation

Research missing technologies
Validate versions
Compare libraries
Generate recommendations

STOP

---

## 0.3 Project Bootstrap Planning

Create folder structure proposal
Define naming conventions
Define package organization

STOP

---

# PHASE 1

Foundation

Goal

Create a stable project foundation.

## 1.1 Repository Initialization

Repository structure
Basic folders
Configuration files
Git conventions

STOP ✅ **COMPLETED** - 2026-07-11

---

## 1.2 Development Environment

Vite
React
TypeScript
Tailwind CSS v4
ESLint (oxlint)
Prettier
Husky
Playwright
Vitest

STOP ✅ **COMPLETED** - 2026-07-11

---

## 1.3 UI Foundation

Theme (Dark default, Light support)
Typography (Outfit headings, Inter body, Mono)
Colors (Semantic tokens: background, foreground, card, muted, accent, destructive, border, ring)
Animations (Framer Motion)
Responsive system (Mobile-first, md/lg/xl breakpoints)
Accessibility baseline (Radix UI primitives)

STOP ✅ **COMPLETED** - 2026-07-11

---

## 1.4 Navigation

Landing
Dashboard
Workspace Layout
Sidebar
Topbar
Routing (React Router v7)

STOP ✅ **COMPLETED** - 2026-07-11

---

# PHASE 2

Authentication

Blocks

## 2.1 Authentication Architecture

Supabase Auth integration
Google OAuth
GitHub OAuth
Session management
Protected routes

STOP ✅ **COMPLETED** - 2026-07-11

---

## 2.2 Login

Email/password
OAuth buttons
Forgot password flow

STOP ✅ **COMPLETED** - 2026-07-11

---

## 2.3 Registration

Email/password signup
Email confirmation
Redirect to dashboard

STOP ✅ **COMPLETED** - 2026-07-11

---

## 2.4 Session Management

Auth state listener (onAuthStateChange)
Profile auto-provisioning via DB trigger
Loading page during session restore

STOP ✅ **COMPLETED** - 2026-07-11

---

## 2.5 Protected Routes

ProtectedRoute component
PublicRoute component (redirects authenticated users)
LoadingPage component

STOP ✅ **COMPLETED** - 2026-07-11

---

# PHASE 3

Workspace System

Blocks

## 3.1 Workspace Database

Tables: workspaces, workspace_members
RLS policies
Trigger: auto-create "My Workspace" on user signup

STOP ✅ **COMPLETED** - 2026-07-11

---

## 3.2 Workspace UI

Three-panel layout (Sidebar | Center | Right Sidebar)
Workspace switcher in Sidebar
Coming Soon sections for future features

STOP ✅ **COMPLETED** - 2026-07-11

---

## 3.3 Create Workspace

Modal form
Optimistic UI update
Supabase insert + workspace_members insert

STOP ✅ **COMPLETED** - 2026-07-11

---

## 3.4 Workspace Dashboard

Two-panel structure: Center (Documents + Upload) | Right (Assistant + Activity)
Drag-and-drop upload zone
Document grid/list view with sorting/filtering
Document cards with thumbnail placeholder, status badge, metadata
Real-time processing status via Supabase Realtime

STOP ✅ **COMPLETED** - 2026-07-11

---

## 3.5 Settings

Profile tab (name, avatar)
Appearance tab (theme: light/dark/system)
Notifications tab (email, desktop, weekly digest)
Shortcuts tab (keyboard reference)
About tab (version, DB status, AI engine, licensing)

STOP ✅ **COMPLETED** - 2026-07-11

---

# PHASE 4

Document System

Blocks

## 4.1 Upload

Drag-and-drop + file picker
PDF validation (type, size ≤ 50MB)
Storage upload to `workspace_documents` bucket
Document record creation (status: uploading → processing)

STOP ✅ **COMPLETED** - 2026-07-11

---

## 4.2 Storage

Supabase Storage bucket: `workspace_documents`
RLS policies (workspace-scoped)
Signed URLs for private access (1hr TTL)

STOP ✅ **COMPLETED** - 2026-07-11

---

## 4.3 Metadata

Document record: id, workspace_id, name, file_path, size_bytes, mime_type, page_count, status, created_at
Page count extracted during processing

STOP ✅ **COMPLETED** - 2026-07-11

---

## 4.4 Viewer

PDF.js via `react-pdf`
Virtualized page list (`@tanstack/react-virtual`)
Zoom controls (fit-width, fit-page, custom 0.25x-5x)
Rotation (0/90/180/270)
Keyboard navigation (arrows, PgUp/PgDn, Home/End, +/-/0)

STOP ✅ **COMPLETED** - 2026-07-11

---

## 4.5 Virtualization

Only render visible pages + overscan
Dynamic page height measurement
Smooth scrolling for 300+ page documents

STOP ✅ **COMPLETED** - 2026-07-11

---

## 4.6 Search

Text layer selection (react-pdf built-in)
Search panel (future)

STOP ⏳ **PLANNED**

---

## 4.7 Page Mapping

Logical page numbers vs PDF internal index
Page labels support (future)

STOP ⏳ **PLANNED**

---

# PHASE 5

OCR

Blocks

## 5.1 Detection

Document inspection stage (InspectionStage)
Sampling pages to detect digital text vs scanned
Output: `InspectionMetadata` (pageCount, hasNativeText, isScanned, isEncrypted)

STOP ✅ **COMPLETED** - 2026-07-11

---

## 5.2 Extraction

ExtractionStage: streams PDF pages → renders to canvas → yields JPEG Blobs
OffscreenCanvas support with fallback
Generator pattern for memory efficiency
Scale 2.0x for OCR quality

STOP ✅ **COMPLETED** - 2026-07-11

---

## 5.3 Bounding Boxes

Provider Framework: `OCRProvider` interface
`OCRData` = { text, blocks: {text, bbox, confidence, type}[] }
Normalized coordinates [0-1]

STOP ✅ **COMPLETED** - 2026-07-11

---

## 5.4 Caching

OCR results stored per-page in `pageRegistryStore`
Status tracking: idle → pending → processing → completed/error
Future: persistent cache in database

STOP ✅ **COMPLETED** - 2026-07-11

---

# PHASE 6

AI Gateway

Blocks

## 6.1 Gateway

`AIGateway` class routes all LLM requests
Single entry point for frontend
Routes to Supabase Edge Function `ai-gateway`

STOP ✅ **COMPLETED** - 2026-07-11

---

## 6.2 Providers

Provider Framework: `AIProvider` interface
Implemented: `MockAIProvider` (local dev)
Edge Function uses: `@google/generative-ai` (Gemini 1.5 Flash/Pro)

STOP ✅ **COMPLETED** - 2026-07-11

---

## 6.3 Model Routing

Plan-aware model selection
Free: gemini-1.5-flash only
Pro: gemini-1.5-flash + gemini-1.5-pro
Frontend model selector respects plan

STOP ✅ **COMPLETED** - 2026-07-11

---

## 6.4 Fallback

`ProviderFallback` chain in Edge Function
Configured sequence with health checks

STOP ✅ **COMPLETED** - 2026-07-11

---

## 6.5 Credits

Credit reservation before generation
Actual cost calculation from token usage
Ledger entry on completion
Monthly quota enforcement (Free: 50, Pro: 1000)
Daily circuit breaker (10,000 credits)

STOP ✅ **COMPLETED** - 2026-07-11

---

# PHASE 7

Highlights

Blocks

## 7.1 Highlight Engine

`HighlightEngine.extractHighlightFromSelection()`
DOM Selection → page container → normalized rects (0-1)
Multiple rects for multi-line highlights

STOP ✅ **COMPLETED** - 2026-07-11

---

## 7.2 Overlay

`HighlightOverlay` component
CSS percentage positioning (scales with zoom)
Category colors
Active highlight ring
Right-click to delete

STOP ✅ **COMPLETED** - 2026-07-11

---

## 7.3 Categories

`highlight_categories` table (workspace-scoped)
Default categories with preset colors
Custom categories (future)

STOP ✅ **COMPLETED** - 2026-07-11

---

## 7.4 Editor

`HighlightEditor` floating popover
Appears on text selection
Color/category picker
Note field (future)

STOP ✅ **COMPLETED** - 2026-07-11

---

# PHASE 8

Chat

Blocks

## 8.1 Conversation

Per-document chat sessions
Auto-create on first message
Session persistence in `chat_sessions` table

STOP ✅ **COMPLETED** - 2026-07-11

---

## 8.2 Context

Workspace + Document + Selection + Page + History + Highlights
Sent to AI Gateway as context

STOP ✅ **COMPLETED** - 2026-07-11

---

## 8.3 References

Future: citations linking back to page/selection

STOP ⏳ **PLANNED**

---

## 8.4 Streaming

`AIGateway.generateStream()` mocks streaming by chunking response
Real streaming via Edge Function (future)

STOP ✅ **COMPLETED** - 2026-07-11

---

# PHASE 9

Billing

Blocks

## 9.1 Credits

Ledger architecture: `credit_ledger` (immutable)
Entry types: grant_plan, grant_purchase, grant_promotion, reserve, release, consume, refund, expire, chargeback_hold, chargeback_reversal, manual_adjustment
Account: `credit_accounts` (available, reserved, consumed, expired)
Buckets: `credit_buckets` (source_type, priority, expires_at)

STOP ✅ **COMPLETED** - 2026-07-11

---

## 9.2 Plans

`plans` table: free, go, pro, max
`plan_prices` table: interval, amount, currency
Free: 50 credits/mo, Flash only
Pro: 1000 credits/mo, Flash + Pro

STOP ✅ **COMPLETED** - 2026-07-11

---

## 9.3 Subscriptions

`subscriptions` table (Stripe integration)
Status: trialing, active, past_due, canceled, unpaid, incomplete, incomplete_expired, paused
Plan linkage via `plan_id`

STOP ✅ **COMPLETED** - 2026-07-11

---

## 9.4 Payments

Stripe Checkout via `create-checkout-session` Edge Function
Webhook: `stripe-webhook` (checkout.session.completed)
Credit packages: `credit_packages` table
Purchases: `purchases` table (pending → completed)

STOP ✅ **COMPLETED** - 2026-07-11

---

# PHASE 10

Knowledge Tools

Blocks

## 10.1 Mind Maps

`mind_map_nodes` table (hierarchical, self-referencing parent_id)
Position x/y for canvas layout
Root node (parent_id = null) + children
`MindMapView`: Root centered, children in 2-col grid

STOP ✅ **COMPLETED** - 2026-07-11

---

## 10.2 Flashcards

`flashcards` table (front, back, page_number)
`FlashcardsView`: List with inline add form
`StudyModeOverlay`: Full-screen 3D flip cards

STOP ✅ **COMPLETED** - 2026-07-11

---

## 10.3 Glossary

`glossary_terms` table (term, definition, page_number)
`GlossaryView`: List with inline add form

STOP ✅ **COMPLETED** - 2026-07-11

---

## 10.4 Study Mode

`StudyModeOverlay`: Immersive full-screen
3D CSS flip animation (perspective-1000, rotate-y-180)
Keyboard: ← → navigate, click/space flip
Progress: "Card X of Y"

STOP ✅ **COMPLETED** - 2026-07-11

---

## 10.5 Timeline

`timeline_events` table (date_str, description, page_number)
`TimelineView`: Currently placeholder (coming soon)

STOP ✅ **BACKEND COMPLETED** - 2026-07-11
STOP ⏳ **FRONTEND PENDING** - Phase 23

---

# PHASE 11

Premium Features

Blocks

## 11.1 Podcast

Audio generation from document content
Player UI with speed control

STOP ⏳ **PLANNED**

---

## 11.2 Infographics

AI-generated visual summaries
Export as image

STOP ⏳ **PLANNED**

---

## 11.3 Presentations

`presentations` table (slides JSONB)
Slide schema: {index, title, bullets[], speaker_note}
`generate-knowledge` Edge Function supports `presentation` action_type
Frontend `PresentationsView` pending

STOP ✅ **BACKEND COMPLETED** - 2026-07-11
STOP ⏳ **FRONTEND PENDING** - Phase 23

---

## 11.4 Knowledge Graph

Entity extraction across documents
Graph visualization (React Flow / D3)

STOP ⏳ **PLANNED**

---

# PHASE 12

Optimization

Blocks

## 12.1 Caching

React Query for server state
Page registry in-memory cache
Persistent OCR/AI cache in DB

STOP ⏳ **PARTIAL** - React Query provider added

---

## 12.2 Performance

Virtualized PDF (done)
Code splitting (React.lazy on pages)
Bundle analysis

STOP ⏳ **PARTIAL** - Lazy routes implemented

---

## 12.3 SEO

Landing page meta tags
Sitemap generation

STOP ⏳ **PLANNED**

---

## 12.4 Analytics

Vercel Analytics
Custom events (document upload, AI generation, etc.)

STOP ⏳ **PLANNED**

---

## 12.5 Monitoring

Sentry (errors)
Better Stack (logs)

STOP ⏳ **PLANNED**

---

## 12.6 Security Review

Penetration testing
Dependency audit

STOP ⏳ **PLANNED**

---

## 12.7 Accessibility Review

axe-core automated
Manual keyboard navigation
Screen reader testing

STOP ⏳ **PLANNED**

---

# PHASE 13

Release

Blocks

## 13.1 Production Audit

Full regression test
Performance benchmarks
Security scan

STOP ⏳ **FUTURE**

---

## 13.2 Documentation Review

All docs current
API reference
User guides

STOP ⏳ **FUTURE** - This task addresses it

---

## 13.3 Final Testing

E2E suite (Playwright)
Cross-browser (Chrome, Firefox, Safari)
Mobile responsiveness

STOP ⏳ **FUTURE**

---

## 13.4 Bug Fixes

Critical/High severity only

STOP ⏳ **FUTURE**

---

## 13.5 Deployment

Vercel production
Supabase production project
Stripe live mode
DNS configuration

STOP ⏳ **FUTURE**

---

## 13.6 Launch

Announce
Monitor
Support

STOP ⏳ **FUTURE**

---

# Future Roadmap

- Native Desktop (Tauri / Electron)
- Mobile App (React Native / Expo)
- Browser Extension
- Public API
- Enterprise Features
- Teams / Organizations
- AI Agents
- Plugin System
- Offline Mode
- Collaboration (real-time editing, comments)