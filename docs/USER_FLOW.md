# Lumena Workspace

User Flow Specification

Version: 1.0

Status: Implemented (Core Flows Complete)

Last Updated: 2026-07-27

---

# Table of Contents

1. User Experience Philosophy
2. Primary User Journey
3. Landing Experience
4. Registration Flow
5. Login Flow
6. Onboarding
7. Dashboard
8. Workspace Creation
9. Document Upload
10. Document Processing
11. PDF Viewer Experience
12. Highlight Workflow
13. Chat Workflow
14. Knowledge Tools Workflow
15. Credits & Billing Flow
16. Subscription Flow
17. Settings Flow
18. Error Flows
19. Offline & Recovery
20. Notifications
21. Mobile Experience
22. Accessibility Journey
23. Future Flows

---

# 1. User Experience Philosophy

**Progressive Disclosure** — Core value first, advanced features on demand.
**Immediate Feedback** — Every action <100ms visual response (optimistic UI).
**Recoverable Errors** — Toast + inline recovery, never dead ends.
**Keyboard First** — All features accessible via shortcuts (⌘K command palette).
**State Preservation** — Viewer scroll, zoom, sidebar state restored on revisit.

---

# 2. Primary User Journey

```
Landing
  ↓
Register (Email/OAuth)
  ↓
Auto-onboarding (Profile + "My Workspace" created)
  ↓
Dashboard (Empty → "Upload PDF")
  ↓
Upload Document (Drag-drop, ≤50MB)
  ↓
Processing (Inspection → OCR → Layout → Extraction → Vision)
  ↓
Viewer (PDF + Overlays + Chat + Knowledge)
  ↓
Interact (Highlight, Chat, Generate Knowledge)
  ↓
Continue Learning (Study Mode, Review)
```

---

# 3. Landing Experience

**Route**: `/`

**Flow**:
1. Hero: Animated mesh gradient → "Lumena" → Tagline → CTA "Get Started Free"
2. Scroll: Features (PDF Intelligence, AI Knowledge, Smart Highlights)
3. Viewer Preview: Static mockup showing overlays + chat
4. Knowledge Tools: 4 cards with "Coming Soon" for Mind Map/Timeline
5. Pricing: Free (50/mo) / Pro (1,000/mo) / Max (10,000/mo)
6. Footer: Links, legal, social

**CTAs**: All point to `/auth` with `?redirect=/dashboard`

---

# 4. Registration Flow

**Route**: `/auth?tab=register`

**Steps**:
1. **Form**: Name (required), Email (required, valid), Password (8+ chars), Confirm
2. **OAuth Options**: "Continue with Google", "Continue with GitHub"
3. **Submit**: `authRepository.signUp()` → Supabase Auth
4. **Email Confirmation**: Supabase sends magic link (if email/password)
5. **Auto-Provision**: On `auth.users` insert → trigger creates `profile` + `workspace` ("My Workspace") + `workspace_member` (owner)
6. **Redirect**: `/dashboard` with session restored

**Validation**: Client (HTML5) + Server (Supabase)

**Errors**: Inline (field) + Toast (network/server)

---

# 5. Login Flow

**Route**: `/auth?tab=login`

**Steps**:
1. **Form**: Email, Password, "Remember me" (extends refresh token)
2. **OAuth**: Google / GitHub buttons
3. **Forgot Password**: Link → `/auth?tab=forgot` → email → reset link
4. **Submit**: `authRepository.signIn()` → session in localStorage + Zustand
5. **Redirect**: `/dashboard` (or `?redirect=` target)

**Session Restore**: `LoadingPage` shown while `onAuthStateChange` resolves

---

# 6. Onboarding

**Auto-Onboarding** (Zero friction):
- Triggered by `auth.users` insert trigger (database-level)
- Creates: `profiles` row, `workspaces` row ("My Workspace"), `workspace_members` (owner)
- No modal, no tour, no forced steps
- User lands on Dashboard with 1 workspace ready

**Optional Guided Tour** (Future):
- `driver.js` or `react-joyride` for first-time users
- Highlight: Upload, Viewer, Chat, Knowledge, Billing

---

# 7. Dashboard

**Route**: `/dashboard`

**States**:

| State | UI | Actions |
|-------|-----|---------|
| **Empty** | Illustration + "Upload your first document" | UploadZone (drag-drop) |
| **With Workspaces** | Grid of WorkspaceCards | Click → `/workspace/:id` |

**WorkspaceCard**: Avatar, Name, Doc Count, Last Opened, Credit Usage Bar, Menu (Rename, Delete, Settings)

**Global Actions** (Topbar):
- ⌘K → Command Palette
- Create Workspace → Modal
- Search → Filters workspaces/docs

---

# 8. Workspace Creation

**Trigger**: Dashboard "Create Workspace" or WorkspaceSwitcher "New Workspace"

**Modal**: `CreateWorkspaceModal`
- Name (required, unique per user)
- Description (optional)
- Submit → `workspaceRepository.create()` → optimistic UI update

**Post-Create**: Auto-switch to new workspace → `/workspace/:newId`

---

# 9. Document Upload

**Route**: `/workspace/:workspaceId` → UploadZone

**Flow**:
1. **Drag-drop** or click → file picker
2. **Validation**: `file.type === 'application/pdf'`, `file.size ≤ 50MB`
3. **Upload**: `documentRepository.upload()` → Supabase Storage (`workspace_documents/{workspaceId}/{docId}.pdf`)
4. **Metadata**: `documentRepository.create()` → `documents` row (status: `uploading`)
5. **Progress**: `documentStore.uploadProgress` → Toast updates
6. **Processing Trigger**: Auto-call `process-document` Edge Function (or manual "Process" button)
7. **Status**: `processing` → `ocr` → `layout` → `extraction` → `vision` → `ready` / `error`

**Error Handling**: Toast with retry, document stays in workspace with error status

---

# 10. Document Processing

**Edge Function**: `process-document`

**Stages** (via `EventBus` + `ProcessingEngine`):

| Stage | Provider | Output | Credits |
|-------|----------|--------|---------|
| Inspection | `InspectionProvider` (PDF.js) | Page count, encryption, metadata | 0 |
| OCR | `OCRProvider` (Tesseract.js) | Text + blocks per page | 2/page |
| Layout | `LayoutProvider` | Structural elements per page | 0 |
| Extraction | `TextExtractionProvider` | Full text content | 0 |
| Vision | `VisionProvider` (future) | Semantic objects, summaries | 5/page |

**State Updates**: `processing_events` + `pageRegistryStore` (per-page status badges)

**Completion**: `documents.status = 'ready'` → Toast "Document ready" → Auto-open viewer (optional)

---

# 11. PDF Viewer Experience

**Route**: `/viewer/:documentId`

**Layout**: `ViewerLayout` (full-width, no app sidebar)

**Components**:
- **Toolbar**: Navigation, Zoom, Rotation, Layers, Sidebars
- **Page List**: Virtualized thumbnails (right), click to jump
- **Page View**: Canvas + OverlayContainer (Layout, OCR, Vision, Highlights)
- **Right Sidebar**: Chat | Knowledge (tabs)

**Keyboard Shortcuts**:
| Key | Action |
|-----|--------|
| ← / J | Previous page |
| → / K | Next page |
| + / = | Zoom in |
| - / _ | Zoom out |
| 0 | Fit page |
| W | Fit width |
| R | Rotate 90° |
| H | Toggle Highlights |
| L | Toggle Layers (OCR/Layout/Vision) |
| C | Toggle Chat sidebar |
| N | Toggle Knowledge sidebar |
| Esc | Close sidebars/modals |

**Layers Toggle** (Toolbar):
- Layout (blue) — structural elements
- OCR (green) — text blocks
- Vision (violet) — AI semantic boxes
- Highlights (5 colors) — user highlights

---

# 12. Highlight Workflow

**Trigger**: Text selection in PDF page (mouse drag or double-click word)

**Flow**:
1. **Selection** → `HighlightEngine` computes % coords (0.0-1.0) relative to page bbox
2. **Editor Appears** — Floating toolbar at selection center (framer-motion animate-in)
3. **Choose Color**: 5 presets (Yellow, Green, Blue, Pink, Purple)
4. **Add Note** (optional): Textarea in editor
5. **Save** → `highlightStore.addHighlight()` → `highlightRepository.create()`
6. **Render** — `HighlightOverlay` adds % positioned div (instant, no reflow)
7. **Sidebar** — `HighlightSidebar` updates, grouped by page

**Edit/Delete**: Click highlight in sidebar → editor opens → modify color/note or delete

---

# 13. Chat Workflow

**Entry**: Viewer right sidebar → Chat tab

**Flow**:
1. **History Load**: `chatStore.fetchMessages(documentId)` → renders messages
2. **Input**: Type message (Shift+Enter = newline, Enter = send)
3. **Model Select**: Dropdown (Free: Flash only; Pro: Flash + Pro)
4. **Credit Estimate**: Shows before send (~1 Flash, ~5 Pro)
5. **Send** → `chatStore.sendMessage()`:
   - Reserve credits via `AIGateway` (ledger reservation)
   - Stream response via `AIGateway.generateStream()`
   - Render chunks in real-time (letter-by-letter optional)
   - On complete: Settle reservation → actual cost
   - Save message + citations to `chat_messages` table
6. **Citations**: Click → scroll to page + flash highlight

**Error**: Toast with retry, credits released if failed

---

# 14. Knowledge Tools Workflow

**Entry**: Viewer right sidebar → Knowledge tab

**Tabs**: Flashcards | Glossary | Mind Map | Timeline

**Common Pattern** (Flashcards/Glossary):
1. **View List**: Existing items from `knowledgeStore`
2. **Generate**: Click "Generate" → `knowledgeStore.generateFlashcards()` / `generateGlossary()`
   - Calls `generate-knowledge` Edge Function (10 credits)
   - Polls for result → adds to store
3. **Add Manual**: "Add" button → inline form → save
4. **Edit/Delete**: Inline actions per item

**Study Mode** (Flashcards only):
1. Click "Study Mode" → `StudyModeOverlay` (full-screen)
2. 3D flip animation (Space = flip, ←/→ = navigate, Esc = exit)
3. Progress bar, shuffle, reset controls

**Mind Map / Timeline** (Phase 23):
- Placeholder UI: "Coming Soon — Interactive [Mind Map/Timeline]"
- Will integrate React Flow / vis-timeline

---

# 15. Credits & Billing Flow

**Entry**: `/billing` or Topbar credit indicator

**Billing Page Sections**:
1. **Plan Comparison**: Free / Pro / Max feature matrix
2. **Credit Usage Bar**: Visual progress (green/amber/red)
3. **Credit History**: Table (Date, Type, Amount, Balance, Description)
4. **Purchase Credits**: Stripe Checkout buttons (packages)
5. **Subscription Status**: Current plan, renewal, cancel link

**Credit Types** (Ledger `entry_type`):
- `grant` — Monthly quota, referrals, promotions
- `purchase` — Stripe checkout completed
- `reserve` — Pending AI/processing action
- `consume` — Settled reservation (actual cost)
- `release` — Failed/cancelled reservation
- `expire` — Monthly bucket reset
- `refund` — Support-issued

**Monthly Quotas**: Reset 1st of month via `credit_buckets` (Free: 50, Pro: 1000, Max: 10000)

---

# 16. Subscription Flow

**Upgrade** (Free → Pro/Max):
1. Click "Upgrade" on PlanCard → `UpgradeModal`
2. Select plan (monthly/yearly) → Stripe Checkout Session
3. Redirect to Stripe → Pay → Redirect to `/billing?success=true`
4. Webhook (`stripe-webhook`) → `checkout.session.completed`
5. Grant credits via ledger (`entry_type: purchase`)
6. Update `subscriptions` table, `credit_buckets` quota

**Cancel**: Stripe Portal link → manage/cancel subscription

**Downgrade**: At period end, quota adjusts, prorated credits

---

# 17. Settings Flow

**Route**: `/settings`

**Tabs**:
| Tab | Content |
|-----|---------|
| **Profile** | Avatar upload, Name, Email (readonly), Change Password |
| **Appearance** | Theme (Dark only v1), Density (Compact/Comfortable), Animations toggle |
| **Notifications** | Email, In-app, Weekly digest (JSONB in `profiles.settings`) |
| **Shortcuts** | Read-only list of all keyboard shortcuts |
| **Data** | Export JSON (all user data), Download PDFs, Delete Account |
| **Danger Zone** | Delete all workspaces (cascade), Revoke all sessions |

**Save**: Per-tab, toast confirmation, optimistic UI

---

# 18. Error Flows

| Error Type | Detection | User Feedback | Recovery |
|------------|-----------|---------------|----------|
| **Upload Failed** | Client validation / Storage error | Toast + inline error | Retry button, re-select file |
| **Processing Failed** | Edge Function error / Provider fail | Document status = `error`, Toast | "Retry Processing" button |
| **AI Generation Failed** | `ai-gateway` error / Rate limit / Quota | Toast with specific reason | Retry (credits released), upgrade plan |
| **Network Offline** | `navigator.onLine` / fetch fail | Banner "Offline — changes saved locally" | Auto-retry on reconnect |
| **Auth Expired** | 401 from Supabase | `LoadingPage` → redirect `/auth` | Auto-refresh token, else re-login |
| **Payment Failed** | Stripe webhook `payment_failed` | Email + Toast | Retry payment, contact support |
| **PDF Corrupted** | InspectionStage `isEncrypted` / parse error | Viewer shows "Cannot render" | Re-upload valid PDF |

---

# 19. Offline & Recovery

**Current**: Online-only (Supabase Realtime, Edge Functions require network)

**Planned** (PWA):
- Service Worker caches: Shell, PDF (first page), recent messages
- Optimistic writes → IndexedDB → Sync on reconnect
- Conflict resolution: Server wins (last-write-wins for credits)

---

# 20. Notifications

**In-App**: `sonner` toasts (bottom-right)
- Success: Green, auto-dismiss 4s
- Error: Red, 8s, action button (Retry)
- Info: Blue, 4s
- Warning: Amber, 6s
- Loading: Spinner, updates to success/error

**Email** (Future):
- Welcome sequence
- Credit low (<20% quota)
- Credit expiring (3 days)
- Processing complete
- Weekly digest (opt-in)

**Push** (Future): Browser notifications for long-running jobs

---

# 21. Mobile Experience

**Breakpoints**: <768px = Mobile

**Adaptations**:
- **Sidebar** → `Sheet` (slide from left, hamburger in Topbar)
- **Right Sidebar** → `Sheet` (slide from bottom, tab bar in Viewer)
- **Toolbar** → Condensed (scrollable, icons only)
- **Page List** → Bottom sheet (tap thumbnail to jump)
- **Chat/Knowledge** → Full-screen modal (swipe down to dismiss)
- **Upload** → Tap to select (drag-drop not reliable)
- **Highlight Editor** → Bottom sheet (larger touch targets)

**Touch Targets**: ≥44x44px (Radix defaults)

---

# 22. Accessibility Journey

**Screen Reader** (NVDA/VoiceOver):
- Landmarks: `<main>`, `<nav>`, `<aside>`, `<section>`
- Live regions: Toasts (`aria-live="polite"`), Chat streaming (`aria-live="polite"`)
- Labels: All icon buttons have `aria-label`
- Headings: Logical hierarchy (h1→h2→h3)

**Keyboard** (Tab, Enter, Space, Escape, Arrows):
- Focus order: Topbar → Sidebar → Main → Right Sidebar
- Skip link: "Skip to main content" (first tab)
- Escape: Closes modals, sheets, dropdowns, command palette
- Arrows: Navigate menus, tabs, virtualized lists

**Reduced Motion**:
- `prefers-reduced-motion: reduce` → all springs instant
- Disabled: Mesh gradient animation, 3D flip, stagger

**High Contrast**: CSS variables support forced colors mode

---

# 23. Future Flows

| Flow | Description | Phase |
|------|-------------|-------|
| **Collaboration** | Invite members, real-time cursors, comments | 24+ |
| **Organizations** | Team billing, SSO, admin console | 25+ |
| **Public API** | REST + Webhooks for integrations | 26+ |
| **Browser Extension** | Save to Lumena, quick capture | 27+ |
| **Desktop App** | Tauri wrapper, native menus, file associations | 28+ |
| **Mobile App** | React Native / Expo, offline-first | 29+ |
| **Enterprise** | SAML/SCIM, audit logs, data residency | 30+ |
| **Podcast Generation** | TTS + transcript + chapters | 23+ |
| **Knowledge Graph** | RAG-powered document connections | 24+ |
| **Template Gallery** | Pre-built workspaces for use cases | 25+ |