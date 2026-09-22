# Lumena Workspace

<!-- LUMENA_AUTO_STATUS_START -->
> [!NOTE]
> **Automated project status — source of truth for current implementation state.**
> Synced from `docs/project-status.json` at commit [`41e2449`](https://github.com/maxgab201/Lumena-Workspace/commit/41e24494541eba13648dacd9b591de5b0fc15e04) on `2026-09-22T15:36:58-03:00` (branch `feat/page-mapping-doc-sync`). If older prose below conflicts with this block, this generated block wins.

- **Lifecycle:** Alpha
- **Current focus:** Core Reading Experience
- **Current checkpoint:** Page Mapping
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
- **In progress:**
  - Logical page labels and PDF-index mapping
  - Reader regression audit and test coverage
- **Next:**
  - Document search and semantic navigation
  - Citation UX using logical page labels
  - Knowledge tools completion after the reader core is stable
- **Product rules:**
  - Core reading remains usable without AI credits
  - AI semantics never invent PDF geometry
  - Provider-specific AI logic stays behind the gateway/service layer
  - Documentation status is synchronized automatically from this file
<!-- LUMENA_AUTO_STATUS_END -->

Component Library Specification

Version: 1.0

Status: Implemented (v1 Components Complete)

Last Updated: 2026-07-27

---

# Table of Contents

1. Component Philosophy
2. Design Principles
3. Component Hierarchy
4. UI Primitives
5. Layout Components
6. Navigation Components
7. Workspace Components
8. PDF Components
9. Overlay Components
10. Highlight Components
11. Chat Components
12. Knowledge Components
13. Billing Components
14. Authentication Components
15. Settings Components
16. Form Components
17. Feedback Components
18. Loading Components
19. Modal Components
20. Context Menu Components
21. Command Palette
22. Animation Components
23. Accessibility Rules
24. Component Communication
25. Props Standards
26. Folder Organization
27. Naming Conventions
28. Reusability Rules
29. Future Components
30. Component Roadmap

---

# 1. Component Philosophy

**Composable, Accessible, Performant**

- **Radix UI Primitives** for complex components (Dialog, Select, Tabs, DropdownMenu, Tooltip, HoverCard, Popover, Sheet) — guaranteed ARIA compliance
- **Custom Styling** via Tailwind v4 + CSS variables — no component library lock-in
- **Zustand Stores** for state — no prop drilling, clear ownership
- **Server Components Ready** — all client components marked `'use client'`
- **Tree-Shakeable** — granular exports from `src/components/ui/index.ts`

---

# 2. Design Principles

1. **Single Responsibility**: One component, one job
2. **Composition Over Configuration**: Slots > props for layout flexibility
3. **Semantic HTML First**: `<button>`, `<dialog>`, `<nav>`, `<main>`
4. **State Colocation**: Local state in component, shared state in store
5. **Zero Runtime Dep**: CSS-in-JS avoided; Tailwind + CSS variables only
6. **Type-Safe Props**: Strict TypeScript interfaces, no `any`

---

# 3. Component Hierarchy

```
Primitive (src/components/ui/)
  Button, Input, Card, Badge, Avatar, Tooltip, Separator, Tabs, Accordion,
  Dialog, Sheet, DropdownMenu, Select, Checkbox, RadioGroup, Switch, Slider,
  Skeleton, Spinner, ScrollArea, HoverCard, Popover, Command, ContextMenu

Layout (src/components/layout/)
  AppLayout, ViewerLayout, Topbar, Sidebar, WorkspaceSidebar, RightSidebar

Navigation (src/components/layout/)
  WorkspaceSwitcher, Breadcrumb, SearchInput, CommandPalette

Feature: Workspace (src/components/workspace/)
  Dashboard, EmptyState, WorkspaceCard, WorkspaceGrid, WorkspaceList,
  DocumentCard, DocumentGrid, DocumentList, UploadZone, ActivityFeed

Feature: PDF (src/components/pdf/)
  PDFViewer, PDFToolbar, PDFPageList, PDFPage, PDFThumbnail

Feature: Overlays (src/components/pdf/overlays/)
  LayoutOverlay, OCROverlay, VisionOverlay, HighlightOverlay, HighlightEditor

Feature: Highlights (src/components/pdf/)
  HighlightSidebar, HighlightBadge

Feature: Chat (src/components/chat/)
  ChatSidebar, ChatMessage, ChatInput, ChatEmpty, ModelSelector, StreamingIndicator

Feature: Knowledge (src/components/knowledge/)
  KnowledgeSidebar, FlashcardsView, GlossaryView, MindMapView, TimelineView,
  StudyModeOverlay, KnowledgeCard, FlashcardFlip, EmptyKnowledge

Feature: Billing (src/components/billing/)
  BillingPage, PlanCard, CreditUsageBar, CreditHistory, PurchaseCredits,
  SubscriptionStatus, UpgradeModal

Feature: Auth (src/components/auth/)
  LoginForm, RegisterForm, OAuthButtons, AuthLayout, ForgotPasswordForm

Feature: Settings (src/components/settings/)
  SettingsPage, SettingsTabs, ProfileForm, AppearanceSettings,
  NotificationSettings, ShortcutsSettings, DataSettings, DangerZone
```

---

# 4. UI Primitives (`src/components/ui/`)

All primitives re-exported from `src/components/ui/index.ts`.

## Button (`Button.tsx`)

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}
```

**Variants**: Primary (teal), Secondary (surface), Ghost (transparent), Destructive (red), Outline (border), Link (underline)
**Sizes**: sm (h-8), md (h-10), lg (h-12), icon (h-10 w-10)

## Input (`Input.tsx`)

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```

## Textarea (`Textarea.tsx`)

Auto-resize variant (`TextareaAutosize`) for chat input.

## Select (`Select.tsx`)

Radix `Select` wrapper with consistent styling.

## Checkbox / RadioGroup / Switch

Radix wrappers with `label` prop support.

## Card (`Card.tsx`)

```tsx
interface CardProps {
  variant?: 'default' | 'glass' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}
```

Variants: `default` (border), `glass` (backdrop-blur), `elevated` (shadow)

## Badge (`Badge.tsx`)

```tsx
variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'outline';
size: 'sm' | 'md';
```

## Avatar (`Avatar.tsx`)

Radix `Avatar` with fallback initials, sizes: sm (32), md (40), lg (48), xl (64)

## Tooltip (`Tooltip.tsx`)

Radix `Tooltip` with side-offset, delay, custom content.

## Separator (`Separator.tsx`)

Horizontal/vertical, decorative or semantic (`role="separator"`).

## Tabs (`Tabs.tsx`)

Radix `Tabs` with animated indicator, keyboard navigation.

## Accordion (`Accordion.tsx`)

Radix `Accordion` with chevron animation, single/multiple open.

## Dialog (`Dialog.tsx`)

Radix `Dialog` + `Modal.tsx` wrapper with sizes (sm/md/lg/xl/full), `Portal`, `AnimatePresence`.

## Sheet (`Sheet.tsx`)

Radix `Sheet` (mobile sidebar, bottom sheets) — side: left/right/bottom.

## DropdownMenu (`DropdownMenu.tsx`)

Radix `DropdownMenu` with submenus, checkbox/radio items, separators, shortcuts.

## HoverCard (`HoverCard.tsx`)

Radix `HoverCard` for preview on hover (document cards, user avatars).

## Popover (`Popover.tsx`)

Radix `Popover` for anchored floating UI (color picker, date picker).

## Command (`Command.tsx`)

`cmk` + Radix `Dialog` for ⌘K palette — fuzzy search, sections, keyboard nav.

## ContextMenu (`ContextMenu.tsx`)

Radix `ContextMenu` for right-click menus (PDF page, highlights, messages).

## ScrollArea (`ScrollArea.tsx`)

Radix `ScrollArea` styled scrollbars (thin, auto-hide).

## Skeleton (`Skeleton.tsx`)

```tsx
<Skeleton className="h-4 w-3/4" />
<SkeletonText lines={3} />
<SkeletonCard />
<SkeletonPage />
```

## Spinner (`Spinner.tsx`)

Sizes: sm (16), md (24), lg (32). Variants: primary, muted.

---

# 5. Layout Components (`src/components/layout/`)

## AppLayout (`AppLayout.tsx`)

Root layout for authenticated app. Provides:
- Topbar (sticky, glass)
- Sidebar (collapsible, workspace switcher, nav)
- Main content area (flex-1)
- Right sidebar (conditional, Chat/Knowledge)
- Mobile: Sidebar → Sheet, Right Sidebar → Bottom Sheet

## ViewerLayout (`ViewerLayout.tsx`)

Full-screen viewer layout. No app sidebar. Topbar with document title, actions. Main = PDFViewer. Right sidebar = Chat/Knowledge.

## Topbar (`Topbar.tsx`)

- Left: Hamburger (mobile), WorkspaceSwitcher, Breadcrumb
- Center: Global Search (⌘K)
- Right: Notifications, User Menu, Theme Toggle (future), Command Palette trigger

## Sidebar (`Sidebar.tsx`)

Collapsible (w-64 → w-16). Sections: Workspace, Navigation, Coming Soon.

## WorkspaceSidebar (`WorkspaceSidebar.tsx`)

Workspace-specific nav: Documents, Chat, Knowledge, Settings + divider + "Coming Soon" disabled items.

## RightSidebar (`RightSidebar.tsx`)

Tabbed: Chat | Knowledge. Controlled by `uiStore.rightSidebarTab`.

---

# 6. Navigation Components

## WorkspaceSwitcher (`WorkspaceSwitcher.tsx`)

DropdownMenu with workspace avatar, name, "Switch Workspace", "Create New", "Manage".

## Breadcrumb (`Breadcrumb.tsx`)

Home > Workspace > Document. Clickable segments.

## SearchInput (`SearchInput.tsx`)

Command palette trigger (⌘K) + inline search for current view.

## CommandPalette (`CommandPalette.tsx`)

Global ⌘K. Sections: Navigation, Actions, Shortcuts, Recent. Fuzzy search via `cmk`.

---

# 7. Workspace Components (`src/components/workspace/`)

## Dashboard (`Dashboard.tsx`)

Authenticated landing. Empty state or workspace grid. Fetches workspaces on mount.

## WorkspaceCard (`WorkspaceCard.tsx`)

Avatar, name, doc count, last opened, credit usage bar, hover actions (open, settings, delete).

## WorkspaceGrid / WorkspaceList

Grid (default) / List toggle. Virtualized for 100+ workspaces (future).

## DocumentCard (`DocumentCard.tsx`)

Thumbnail (PDF first page), title, page count, status badge (Processing/Ready/Error), credit cost, updated at.

## DocumentGrid / DocumentList

View toggle in toolbar. Grid: 3-col responsive. List: compact table.

## UploadZone (`UploadZone.tsx`)

Drag-drop + click. Validates PDF, ≤50MB. Shows progress via `documentStore.uploadProgress`.

## EmptyState (`EmptyState.tsx`)

Illustration + title + description + primary action. Variants: workspace, document, chat, knowledge, highlights.

## ActivityFeed (`ActivityFeed.tsx`)

Mock recent activity (uploaded, processed, highlights, chat). "Coming Soon" badge.

---

# 8. PDF Components (`src/components/pdf/`)

## PDFViewer (`PDFViewer.tsx`)

Root viewer component. Manages:
- Document load (signed URL from `documentStore`)
- PDF.js worker config
- Page registry (`pageRegistryStore`)
- Viewport state (`viewerStore`: scale, rotation, currentPage)
- Keyboard shortcuts
- Overlay layer management
- Sidebar toggle (Chat/Knowledge)

## PDFToolbar (`PDFToolbar.tsx`)

Fixed top bar (z-40). Groups:
- Navigation: First, Prev, Page Input, Next, Last
- Zoom: Out, Level, In, Fit Width, Fit Page
- Rotate: CCW, CW
- Layers: Toggle buttons (OCR, Layout, Vision, Highlights)
- Sidebars: Chat, Knowledge
- More Menu: Download, Print, Shortcuts, Settings

## PDFPageList (`PDFPageList.tsx`)

Virtualized thumbnail strip (right or bottom). `@tanstack/react-virtual` with dynamic height. Click → jump. Hover → preview.

## PDFPage (`PDFPage.tsx`)

Single page renderer. Stack:
```
<div className="relative">
  <Canvas />                    {/* react-pdf Page */}
  <OverlayContainer />          {/* absolute inset-0 */}
    ├── LayoutOverlay
    ├── OCROverlay
    ├── VisionOverlay
    ├── HighlightOverlay
    └── HighlightEditor (conditional)
</div>
```

## PDFThumbnail (`PDFThumbnail.tsx`)

Small page render for thumbnails. Uses same `react-pdf` but lower resolution.

---

# 9. Overlay Components (`src/components/pdf/overlays/`)

All overlays render inside `absolute inset-0` container, using **CSS percentage positioning** for zoom-invariant alignment.

## LayoutOverlay (`LayoutOverlay.tsx`)

Renders `layout_data.blocks` (from `document_ocr` table) as colored rectangles:
- Title: Blue border
- Paragraph: Green border
- Image: Red border
- Table: Yellow border
- List: Purple border

Tooltip on hover: block type, confidence, bbox.

## OCROverlay (`OCROverlay.tsx`)

Renders `ocr_data.blocks` as semi-transparent green highlights over text regions. Debug toggle.

## VisionOverlay (`VisionOverlay.tsx`)

Renders `vision_data.objects` (semantic detections) as violet boxes with labels. Grounded to page coordinates.

## HighlightOverlay (`HighlightOverlay.tsx`)

Renders user highlights from `highlightStore`. Percentage coords → CSS `%`. Color from highlight category.

## HighlightEditor (`HighlightEditor.tsx`)

Floating toolbar appearing at selection center. Color picker (5 presets), Note input, Save/Cancel. Positioned via `framer-motion` animate-in.

---

# 10. Highlight Components (`src/components/pdf/`)

## HighlightSidebar (`HighlightSidebar.tsx`)

Lists all highlights for current document. Grouped by page. Click → scroll to page + flash highlight.

## HighlightBadge (`HighlightBadge.tsx`)

Inline badge in chat citations / knowledge cards showing highlight color + excerpt.

---

# 11. Chat Components (`src/components/chat/`)

## ChatSidebar (`ChatSidebar.tsx`)

Right sidebar panel. Header: Model selector, Clear conversation. Body: Virtualized message list. Footer: ChatInput.

## ChatMessage (`ChatMessage.tsx`)

```tsx
interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  streaming?: boolean;
  model?: string;
}
```

- User: Right-aligned, primary bg, rounded-tr-none
- Assistant: Left-aligned, surface bg, streaming animation
- Citations: Expandable chips linking to page + highlight

## ChatInput (`ChatInput.tsx`)

Textarea (auto-resize), Send button, ModelSelector, CreditEstimate. Enter=send, Shift+Enter=newline.

## ModelSelector (`ModelSelector.tsx`)

DropdownMenu. Options filtered by `billingStore.plan` (Free: Flash only; Pro: Flash+Pro).

## StreamingIndicator (`StreamingIndicator.tsx`)

Pulsing dots + "Thinking..." text. Cancel button (AbortController).

## ChatEmpty (`ChatEmpty.tsx`)

Illustration + "Start a conversation about this document"

---

# 12. Knowledge Components (`src/components/knowledge/`)

## KnowledgeSidebar (`KnowledgeSidebar.tsx`)

Tabbed interface (Flashcards | Glossary | Mind Map | Timeline). Each tab = view component.

## FlashcardsView (`FlashcardsView.tsx`)

Grid of `KnowledgeCard` (flashcard type). "Generate" button → calls `knowledgeStore.generateFlashcards()`. "Study Mode" button → opens `StudyModeOverlay`.

## GlossaryView (`GlossaryView.tsx`)

List of terms. Search/filter. "Generate" button.

## MindMapView (`MindMapView.tsx`)

**Placeholder** — shows "Coming Soon: Interactive Mind Map". Will integrate React Flow / Cytoscape.

## TimelineView (`TimelineView.tsx`)

**Placeholder** — shows "Coming Soon: Interactive Timeline". Will integrate vis-timeline or custom SVG.

## StudyModeOverlay (`StudyModeOverlay.tsx`)

Full-screen immersive flashcard review. 3D flip animation (CSS `perspective` + `rotateY`). Keyboard: Space=flip, ArrowRight=next, ArrowLeft=prev, Esc=close. Progress bar, shuffle, reset.

## KnowledgeCard (`KnowledgeCard.tsx`)

Unified card for flashcard/glossary/mindmap node/timeline event. Variants per type.

## FlashcardFlip (`FlashcardFlip.tsx`)

3D flip component. Front/Back children. `isFlipped` controlled.

## EmptyKnowledge (`EmptyKnowledge.tsx`)

Per-tab empty states with Generate CTA.

---

# 13. Billing Components (`src/components/billing/`)

## BillingPage (`BillingPage.tsx`)

Main billing route. Sections: PlanComparison, CreditUsageBar, CreditHistory, PurchaseCredits, SubscriptionStatus.

## PlanCard (`PlanCard.tsx`)

Feature matrix. Current plan highlighted. "Upgrade" / "Current" button.

## CreditUsageBar (`CreditUsageBar.tsx`)

Visual progress: `used / total`. Color: green <50%, amber 50-80%, red >80%. Tooltip with breakdown.

## CreditHistory (`CreditHistory.tsx`)

Table: Date | Type (Grant/Consume/Reserve/Release/Expire) | Amount | Balance | Description (workspace, action). Paginated.

## PurchaseCredits (`PurchaseCredits.tsx`)

Stripe Checkout buttons for packages. `create-checkout-session` Edge Function. Test mode badge.

## SubscriptionStatus (`SubscriptionStatus.tsx`)

Current tier, renewal date, cancel button (links to Stripe Portal).

## UpgradeModal (`UpgradeModal.tsx`)

Glass modal triggered from PlanCard. Package selection + Stripe redirect.

---

# 14. Authentication Components (`src/components/auth/`)

## AuthLayout (`AuthLayout.tsx`)

Centered card (max-w-md) on branded background. Glass card.

## LoginForm (`LoginForm.tsx`)

Email/password, "Forgot password?", OAuth buttons, "Sign up" link.

## RegisterForm (`RegisterForm.tsx`)

Name, email, password, confirm, OAuth, "Sign in" link.

## OAuthButtons (`OAuthButtons.tsx`)

Google, GitHub. `supabase.auth.signInWithOAuth({ provider })`.

## ForgotPasswordForm / ResetPasswordForm

Email → magic link → new password.

---

# 15. Settings Components (`src/components/settings/`)

## SettingsPage (`SettingsPage.tsx`)

Tabs via `SettingsTabs`. Each tab = form with save handler.

## ProfileForm (`ProfileForm.tsx`)

Avatar upload (Storage), Name, Email (readonly), Password change link.

## AppearanceSettings (`AppearanceSettings.tsx`)

Theme (Dark only v1), Density (Compact/Comfortable), Animations toggle.

## NotificationSettings (`NotificationSettings.tsx`)

Email, In-app, Weekly digest toggles (stored in `profiles.settings` JSONB).

## ShortcutsSettings (`ShortcutsSettings.tsx`)

Read-only list of all keyboard shortcuts (from `useKeyboardShortcuts`).

## DataSettings (`DataSettings.tsx`)

Export data (JSON), Download PDFs, Request deletion.

## DangerZone (`DangerZone.tsx`)

Delete all workspaces (cascade), Revoke all sessions, Delete account.

---

# 16. Form Components

All form primitives in `src/components/ui/` (Input, Textarea, Select, Checkbox, RadioGroup, Switch, Slider).

**Form Pattern** (React Hook Form + Zod):
```tsx
const schema = z.object({ email: z.string().email() });
const form = useForm<Schema>({ resolver: zodResolver(schema) });
<Form {...form}>
  <FormField name="email" render={({ field }) => <Input {...field} />} />
  <FormMessage name="email" />
</Form>
```

---

# 17. Feedback Components

## Toast (`sonner` Toaster)

Global `<Toaster />` in `AppProviders`. `toast.success/error/info/warning/promise/loading`.

## Alert (`Alert.tsx`)

Inline banner: `variant: 'info' | 'success' | 'warning' | 'error'`. Dismissible.

## ConfirmationDialog (`ConfirmationDialog.tsx`)

Modal with title, description, destructive/confirm action. Used for deletions.

---

# 18. Loading Components

## Skeleton Variants (see UI Primitives)

## LoadingOverlay (`LoadingOverlay.tsx`)

Full-screen or container overlay with spinner + optional message.

## PageLoading (`LoadingPage.tsx`)

App-level: "Restoring session..." spinner during auth initialization.

---

# 19. Modal Components

## Modal (`Modal.tsx`)

Wrapper around Radix `Dialog`. Sizes: sm/md/lg/xl/full. `AnimatePresence` exit animation.

## Drawer (`Drawer.tsx`)

Wrapper around Radix `Sheet`. Side: left/right/bottom. Mobile-first.

## UpgradeModal (`UpgradeModal.tsx`)

Billing-specific modal with package selection.

## DeleteConfirmModal (`DeleteConfirmModal.tsx`)

Destructive confirmation with "Type name to confirm" for workspaces.

---

# 20. Context Menu Components

## ContextMenu (`ContextMenu.tsx`)

Radix `ContextMenu` wrapper. Items: `MenuItem`, `MenuCheckboxItem`, `MenuRadioGroup`, `MenuSeparator`, `MenuSubTrigger`.

**Usage**: PDF page (layers, highlight, rotate), Document card (rename, delete, download), Highlight (edit, delete, copy), Chat message (copy, regenerate, cite).

---

# 21. Command Palette

## CommandPalette (`CommandPalette.tsx`)

⌘K global. `cmk` + Radix `Dialog`. Sections: Navigation, Actions, Shortcuts, Recent. Fuzzy search. Keyboard: ↑↓, Enter, Esc.

---

# 22. Animation Components

**No standalone animation components** — animations via `framer-motion` directly in components.

**Patterns**:
- `motion.div` with `variants` for stagger
- `AnimatePresence` for exit animations
- `useReducedMotion` hook for accessibility
- CSS `@keyframes` for simple loops (mesh gradient, pulse)

---

# 23. Accessibility Rules

**Mandatory for Every Component**:
1. Semantic HTML element (`<button>`, not `<div onClick>`)
2. `aria-label` / `aria-labelledby` for icon-only controls
3. `focus-visible` ring: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg`
4. Keyboard support (Tab, Enter, Space, Escape, Arrows)
5. Color contrast ≥ 4.5:1 (text), ≥ 3:1 (UI)
6. `prefers-reduced-motion` respected (disable springs, instant transitions)
7. Screen reader text: `<span className="sr-only">` for icon-only buttons
8. Live regions for dynamic content (toasts, chat streaming): `aria-live="polite"`

**Radix Primitives** handle 1-4, 7-8 automatically.

---

# 24. Component Communication

**State Flow**:
```
User Action → Component → Store Action → Store Update → Component Re-render
                    ↓
              Edge Function (async)
                    ↓
              Store Update (result)
```

**Stores** (single source of truth):
- `userStore` — auth, profile
- `workspaceStore` — workspaces, current
- `documentStore` — documents, upload, processing
- `viewerStore` — PDF viewport, page, overlays
- `pageRegistryStore` — page metadata, processing status
- `chatStore` — messages, streaming
- `knowledgeStore` — flashcards, glossary, mindmap, timeline
- `highlightStore` — highlights, editor state
- `billingStore` — plan, credits, history
- `uiStore` — sidebars, modals, toasts, theme, shortcuts

**No Context for State** — only for providers (Query, Theme, Toast).

---

# 25. Props Standards

**Required**:
- `className?: string` — always merge with `cn()`
- `children?: React.ReactNode` — for composition
- `testId?: string` — for testing (`data-testid`)

**Boolean Props**: Positive naming (`disabled`, not `enabled`)

**Event Handlers**: `onAction` (e.g., `onSave`, `onDelete`) — past tense for completion

**Ref Forwarding**: `forwardRef` for all primitives

**TypeScript**: Strict interfaces, no `any`, discriminated unions for variants

---

# 26. Folder Organization

```
src/components/
├── ui/                    # Primitives (30+ components)
│   ├── index.ts           # Barrel export
│   ├── Button.tsx
│   └── ...
├── layout/                # App/Viewers shells
│   ├── AppLayout.tsx
│   ├── ViewerLayout.tsx
│   ├── Topbar.tsx
│   ├── Sidebar.tsx
│   ├── WorkspaceSidebar.tsx
│   └── RightSidebar.tsx
├── pdf/                   # Viewer + Overlays
│   ├── PDFViewer.tsx
│   ├── PDFToolbar.tsx
│   ├── PDFPageList.tsx
│   ├── PDFPage.tsx
│   ├── PDFThumbnail.tsx
│   └── overlays/
│       ├── LayoutOverlay.tsx
│       ├── OCROverlay.tsx
│       ├── VisionOverlay.tsx
│       ├── HighlightOverlay.tsx
│       └── HighlightEditor.tsx
├── chat/                  # Chat sidebar
│   ├── ChatSidebar.tsx
│   ├── ChatMessage.tsx
│   ├── ChatInput.tsx
│   ├── ChatEmpty.tsx
│   ├── ModelSelector.tsx
│   └── StreamingIndicator.tsx
├── knowledge/             # Knowledge tools
│   ├── KnowledgeSidebar.tsx
│   ├── FlashcardsView.tsx
│   ├── GlossaryView.tsx
│   ├── MindMapView.tsx
│   ├── TimelineView.tsx
│   ├── StudyModeOverlay.tsx
│   ├── KnowledgeCard.tsx
│   ├── FlashcardFlip.tsx
│   └── EmptyKnowledge.tsx
├── workspace/             # Dashboard + Workspace
│   ├── Dashboard.tsx
│   ├── WorkspaceCard.tsx
│   ├── DocumentCard.tsx
│   ├── UploadZone.tsx
│   ├── EmptyState.tsx
│   └── ActivityFeed.tsx
├── billing/               # Billing page
│   ├── BillingPage.tsx
│   ├── PlanCard.tsx
│   ├── CreditUsageBar.tsx
│   ├── CreditHistory.tsx
│   ├── PurchaseCredits.tsx
│   ├── SubscriptionStatus.tsx
│   └── UpgradeModal.tsx
├── auth/                  # Auth pages
│   ├── AuthLayout.tsx
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   ├── OAuthButtons.tsx
│   └── ForgotPasswordForm.tsx
├── settings/              # Settings tabs
│   ├── SettingsPage.tsx
│   ├── SettingsTabs.tsx
│   ├── ProfileForm.tsx
│   ├── AppearanceSettings.tsx
│   ├── NotificationSettings.tsx
│   ├── ShortcutsSettings.tsx
│   ├── DataSettings.tsx
│   └── DangerZone.tsx
└── highlights/            # Highlight sidebar
    ├── HighlightSidebar.tsx
    └── HighlightBadge.tsx
```

---

# 27. Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Component File | PascalCase | `PDFViewer.tsx` |
| Component Export | PascalCase | `export const PDFViewer` |
| Hook File | camelCase + `use` | `useKeyboardShortcuts.ts` |
| Hook Export | camelCase + `use` | `export const useKeyboardShortcuts` |
| Store File | camelCase + `Store` | `workspaceStore.ts` |
| Store Export | camelCase + `Store` | `export const useWorkspaceStore` |
| Type File | PascalCase + `Types` | `pdfTypes.ts` |
| Utility File | camelCase | `formatDate.ts` |
| Constant File | UPPER_SNAKE_CASE | `SHORTCUTS.ts` |
| CSS/Token | kebab-case | `--color-primary` |

---

# 28. Reusability Rules

1. **UI Primitives** — reusable everywhere, no business logic
2. **Layout Components** — app-specific, compose primitives
3. **Feature Components** — domain-specific, use stores directly
4. **Pages** — compose feature components, handle routing
5. **No Cross-Feature Imports** — `chat/` doesn't import `knowledge/`
6. **Shared Types** — `src/types/` or co-located `*.types.ts`
7. **Shared Utils** — `src/lib/utils.ts`, `src/lib/providers/`

---

# 29. Future Components

| Component | Description | Dependency |
|-----------|-------------|------------|
| `MindMapView` | Interactive graph (React Flow) | Phase 23 generate-knowledge |
| `TimelineView` | Interactive timeline (vis-timeline) | Phase 23 generate-knowledge |
| `PresentationsView` | Slide deck viewer (Reveal.js) | Phase 23 + presentations table |
| `PodcastPlayer` | Audio player + transcript sync | TTS provider (ElevenLabs) |
| `KnowledgeGraph` | RAG-powered graph exploration | Vector DB / pgvector |
| `AnnotationTools` | Pen, shape, stamp, text tools | PDF-lib / PDF.js annotations |
| `TableExtractionView` | Structured table viewer | Table provider (Surya/TableTransformer) |
| `CollaborationPanel` | Presence, cursors, comments | Supabase Realtime + Yjs |
| `AdvancedSearch` | Faceted, saved, semantic search | Meilisearch / pgvector |

---

# 30. Component Roadmap

| Quarter | Focus |
|---------|-------|
| Q3 2026 | Mind Map, Timeline, Presentations (Phase 23) |
| Q4 2026 | Podcast Player, Knowledge Graph, Annotations |
| Q1 2027 | Collaboration, Advanced Search, Table Extraction |
| Q2 2027 | Mobile App (React Native), Browser Extension |