# Lumena Workspace

Design System Specification

Version: 1.0

Status: Implemented (Dark Theme v1)

Last Updated: 2026-07-27

---

# Table of Contents

1. Design Philosophy
2. Brand Identity
3. Visual Language
4. UX Principles
5. UI Principles
6. Color System
7. Typography
8. Spacing System
9. Border Radius
10. Elevation & Shadows
11. Glassmorphism
12. Motion Design
13. Animation Guidelines
14. Icons
15. Illustrations
16. Layout System
17. Responsive Design
18. Accessibility
19. Landing Page
20. Dashboard
21. Workspace
22. PDF Viewer
23. Chat
24. Highlights
25. AI Components
26. Forms
27. Buttons
28. Modals
29. Notifications
30. Loading States
31. Empty States
32. Error States
33. Skeletons
34. Context Menus
35. Command Palette
36. Settings
37. Billing UI
38. Future Components
39. Design Tokens
40. Future Design Evolution

---

# 1. Design Philosophy

**Calm Intelligence** — Lumena's design language prioritizes focus, clarity, and trust. The interface recedes so content and AI insights take center stage.

**Core Principles**:
- **Content First**: UI chrome minimized; document and knowledge are the hero
- **Calm Density**: Information-dense but never cluttered; generous whitespace
- **Intelligent Defaults**: Smart defaults reduce configuration; power features progressive
- **Trust Through Transparency**: Credit usage, AI sources, and processing state always visible
- **Accessible by Default**: WCAG 2.1 AA baseline; keyboard-first navigation

---

# 2. Brand Identity

**Lumena** — from Latin *lumen* (light) + *-a* (feminine suffix). "The light of knowledge."

**Mission**: Transform documents into actionable knowledge through AI.

**Values**: Precision, Empowerment, Privacy, Accessibility

---

# 3. Visual Language

**Dark-First**: Deep charcoal backgrounds (#0A0A0B / #111113) with subtle gradient meshes for depth.

**Glassmorphism**: `backdrop-blur-xl` surfaces with `border-white/10` for layering hierarchy.

**Accent**: Teal-cyan (#00D4AA) for primary actions, AI branding, credit indicators.

**Data Visualization**: Categorical palette (teal, amber, violet, rose, cyan, indigo) for charts/mindmaps.

---

# 4. UX Principles

1. **Progressive Disclosure**: Core actions visible; advanced in menus/command palette
2. **Immediate Feedback**: Every action has <100ms visual response (optimistic UI)
3. **Recoverable Errors**: Toast + inline recovery; never dead ends
4. **Keyboard First**: All features accessible via shortcuts (⌘K command palette)
5. **State Preservation**: Viewer scroll, zoom, sidebar state restored on revisit

---

# 5. UI Principles

- **8px Grid**: All spacing multiples of 8px (0.5rem)
- **Consistent Radius**: `rounded-xl` (12px) cards, `rounded-lg` (8px) inputs, `rounded-full` pills
- **Semantic Colors**: Never hardcode; use CSS variables (`--color-primary`, `--color-surface`)
- **Reduced Motion**: Respect `prefers-reduced-motion` globally

---

# 6. Color System

## CSS Variables (Tailwind v4 `@theme` in `src/index.css`)

```css
:root {
  /* Base */
  --color-bg: #0A0A0B;           /* zinc-950 */
  --color-bg-elevated: #111113;  /* zinc-900 */
  --color-surface: #18181B;      /* zinc-900/80 */
  --color-border: #27272A;       /* zinc-800 */
  --color-border-strong: #3F3F46; /* zinc-700 */

  /* Text */
  --color-fg: #FAFAFA;           /* zinc-50 */
  --color-fg-muted: #A1A1AA;     /* zinc-400 */
  --color-fg-subtle: #71717A;    /* zinc-500 */

  /* Brand */
  --color-primary: #00D4AA;      /* teal-400 */
  --color-primary-hover: #00B894; /* teal-500 */
  --color-primary-muted: #00D4AA26; /* teal-400/15 */

  /* Semantic */
  --color-success: #22C55E;      /* green-500 */
  --color-warning: #F59E0B;      /* amber-500 */
  --color-error: #EF4444;        /* red-500 */
  --color-info: #3B82F6;         /* blue-500 */

  /* Data Viz */
  --color-chart-1: #00D4AA;
  --color-chart-2: #F59E0B;
  --color-chart-3: #A855F7;
  --color-chart-4: #F43F5E;
  --color-chart-5: #06B6D4;
  --color-chart-6: #6366F1;
}
```

**Dark Theme Only** (v1). Light theme planned post-launch.

**Usage**: Tailwind utilities map directly: `bg-bg`, `text-fg`, `border-border`, `bg-primary`, etc.

---

# 7. Typography

**Font Stack**: `Geist Sans` (UI), `Geist Mono` (code), system fallbacks

Loaded via `@fontsource/geist` in `src/main.tsx`.

**Scale** (Tailwind defaults + custom):

| Token | Size | Line Height | Weight | Use |
|-------|------|-------------|--------|-----|
| `display` | 4.5rem / 72px | 1.1 | 700 | Landing hero |
| `h1` | 3rem / 48px | 1.2 | 700 | Page titles |
| `h2` | 2.25rem / 36px | 1.3 | 600 | Section headers |
| `h3` | 1.5rem / 24px | 1.4 | 600 | Card titles |
| `h4` | 1.25rem / 20px | 1.4 | 500 | Subsections |
| `body-lg` | 1.125rem / 18px | 1.6 | 400 | Lead text |
| `body` | 1rem / 16px | 1.6 | 400 | Default |
| `body-sm` | 0.875rem / 14px | 1.5 | 400 | Secondary |
| `caption` | 0.75rem / 12px | 1.5 | 400 | Metadata |
| `mono` | 0.875rem / 14px | 1.6 | 400 | Code, credits |

---

# 8. Spacing System

**Base Unit**: 8px (0.5rem)

| Token | Value | Use |
|-------|-------|-----|
| `space-0` | 0 | Reset |
| `space-1` | 4px | Inline gaps |
| `space-2` | 8px | Compact stacks |
| `space-3` | 12px | Form fields |
| `space-4` | 16px | Standard gap |
| `space-5` | 20px | Card padding |
| `space-6` | 24px | Section gap |
| `space-8` | 32px | Page padding |
| `space-10` | 40px | Large sections |
| `space-12` | 48px | Hero sections |
| `space-16` | 64px | Landing gaps |

---

# 9. Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `rounded-none` | 0 | Images, dividers |
| `rounded-sm` | 4px | Badges, chips |
| `rounded-md` | 6px | Buttons (compact) |
| `rounded-lg` | 8px | Inputs, selects, cards (compact) |
| `rounded-xl` | 12px | **Default card**, modals, dropdowns |
| `rounded-2xl` | 16px | Feature cards, hero |
| `rounded-full` | 9999px | Pills, avatars, progress |

---

# 10. Elevation & Shadows

**Layer System** (via `box-shadow` + `backdrop-blur`):

| Level | Shadow | Blur | Border | Use |
|-------|--------|------|--------|-----|
| 0 (Base) | none | none | `border-border` | Page bg |
| 1 (Surface) | `0 1px 3px -1px rgb(0 0 0 / 0.4)` | `backdrop-blur-sm` | `border-border/50` | Cards, sidebar |
| 2 (Elevated) | `0 10px 40px -10px rgb(0 0 0 / 0.5)` | `backdrop-blur-md` | `border-border/30` | Modals, dropdowns |
| 3 (Overlay) | `0 25px 80px -20px rgb(0 0 0 / 0.6)` | `backdrop-blur-xl` | `border-border/20` | Toasts, popovers |
| 4 (Glass) | `inset 0 1px 0 rgb(255 255 255 / 0.05)` | `backdrop-blur-xl` | `border-white/10` | Premium panels |

---

# 11. Glassmorphism

**Signature Surface**: `bg-surface/80 backdrop-blur-xl border border-white/10`

**Variants**:
- `glass-subtle`: `bg-bg-elevated/60 backdrop-blur-md border-border/50`
- `glass-strong`: `bg-surface/90 backdrop-blur-2xl border-white/15`

**Applied to**: Sidebar, Topbar, Modals, Dropdowns, Toasts, Viewer overlays

---

# 12. Motion Design

**Library**: `framer-motion` 12.23.12

**Principles**:
- **Spring Default**: `type: "spring", stiffness: 300, damping: 30` (natural feel)
- **Duration Cap**: Max 300ms for micro-interactions
- **Stagger**: 50ms delay per item in lists
- **Exit Animations**: `AnimatePresence` for all conditional renders

---

# 13. Animation Guidelines

| Interaction | Animation | Config |
|-------------|-----------|--------|
| Page Transition | Fade + Slide Y (20px) | 200ms spring |
| Sidebar Collapse | Width + Opacity | 250ms spring |
| Modal Open | Scale (0.95→1) + Fade | 200ms spring |
| Dropdown | Scale Y (0→1) + Fade | 150ms spring |
| Toast Slide | X (-100%→0) + Fade | 300ms spring |
| Highlight Appear | Scale (0→1) + Fade | 200ms spring |
| Chat Stream | Letter-by-letter (optional) | 15ms/char |
| Study Mode Flip | 3D rotateY (180deg) | 600ms spring |
| Command Palette | Scale (0.95→1) + Blur bg | 200ms spring |

**Reduced Motion**: All springs → `duration: 0.01ms` via `useReducedMotion` hook.

---

# 14. Icons

**Library**: `lucide-react` 0.544.0 (consistent 24x24, 2px stroke)

**Sizing Tokens**:
- `icon-xs`: 14px (inline, badges)
- `icon-sm`: 16px (buttons, compact)
- `icon-md`: 20px (default UI)
- `icon-lg`: 24px (feature cards, empty states)
- `icon-xl`: 32px (landing, hero)

**Semantic Icons**:
- AI: `Sparkles`, `Brain`, `Bot`
- Docs: `FileText`, `FileSearch`, `Layout`
- Actions: `Plus`, `Search`, `Settings`, `MoreHorizontal`
- Status: `CheckCircle`, `AlertCircle`, `Loader2`, `XCircle`

---

# 15. Illustrations

**Style**: Abstract geometric meshes (landing), minimal line art (empty states)

**Landing Hero**: Animated `MeshGradient` component (CSS `@property` + canvas fallback)

**Empty States**: Custom SVGs in `src/assets/illustrations/`:
- `empty-workspace.svg` — document upload prompt
- `empty-chat.svg` — chat bubbles
- `empty-knowledge.svg` — brain + cards
- `empty-highlights.svg` — highlighter

---

# 16. Layout System

## App Shell (`AppLayout.tsx`)

```
┌─────────────────────────────────────────────────────────────┐
│ Topbar (h-14, glass, sticky)                                │
├──────────┬──────────────────────────────┬────────────────────┤
│          │                              │                    │
│ Sidebar  │       Main Content           │  Right Sidebar     │
│ (w-64,   │    (flex-1, overflow-auto)   │  (w-80, conditional)│
│  glass)  │                              │                    │
│          │                              │                    │
└──────────┴──────────────────────────────┴────────────────────┘
```

**Breakpoints**:
- `< 768px`: Sidebar → Sheet (mobile), Right Sidebar → Bottom Sheet
- `768-1024px`: Sidebar collapsible tobar + icons only, Right Sidebar overlay
- `> 1024px`: Full three-panel

---

# 17. Responsive Design

**Tailwind Breakpoints** (standard):
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

**Component Behavior**:

| Component | Mobile (<md) | Tablet (md-lg) | Desktop (>lg) |
|-----------|--------------|----------------|---------------|
| Sidebar | Sheet (slide) | Collapsible icons | Full |
| Right Sidebar | Bottom Sheet | Overlay panel | Persistent |
| Viewer Toolbar | Scrollable, condensed | Full | Full |
| Chat/KNW Tabs | Segmented control | Tabs | Tabs |
| Command Palette | Full screen | Centered modal | Centered modal |

---

# 18. Accessibility

**Baseline**: WCAG 2.1 AA

**Implemented**:
- Semantic HTML (`<main>`, `<nav>`, `<aside>`, `<section>`)
- ARIA labels on all icon buttons (`aria-label`)
- Focus visible: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg`
- Color contrast: All text ≥ 4.5:1, UI ≥ 3:1
- Keyboard: Tab order logical, Escape closes modals/sheets, Arrow keys in menus
- Screen readers: `sr-only` labels, live regions for toasts/chat streaming
- Reduced motion: `prefers-reduced-motion` respected globally

**Radix UI Primitives** (guarantee ARIA):
- `Dialog`, `Sheet`, `DropdownMenu`, `Select`, `Tabs`, `Tooltip`, `HoverCard`, `Popover`

---

# 19. Landing Page

**Route**: `/`

**Sections**:
1. **Hero**: Animated mesh gradient, headline, CTA (Sign Up), secondary (Demo)
2. **Trust Bar**: Logos (placeholder)
3. **Features**: 3-column grid (PDF Intelligence, AI Knowledge, Smart Highlights)
4. **Viewer Preview**: Interactive PDF viewer mockup (static image)
5. **Knowledge Tools**: Flashcards, Glossary, Mind Map, Timeline cards
6. **Pricing**: Free / Pro / Max tiers with credit comparison
7. **Footer**: Links, social, legal

**Animations**: `framer-motion` scroll reveal (`whileInView`), hero mesh continuous animation.

---

# 20. Dashboard

**Route**: `/dashboard`

**Layout**: Single column, centered max-w-4xl

**States**:
- **Empty**: Illustration + "Upload your first document" CTA
- **With Workspaces**: Grid of workspace cards (name, doc count, last opened, credit usage bar)

**Actions**: Create Workspace (modal), Search (⌘K), Settings link

---

# 21. Workspace

**Route**: `/workspace/:workspaceId`

**Layout**: Three-panel (see Layout System)

**Left Sidebar** (`WorkspaceSidebar.tsx`):
- Workspace switcher (avatar + name)
- Navigation: Documents, Chat, Knowledge, Settings
- "Coming Soon": Mind Maps, Timeline, Presentations (disabled)

**Main**: Document grid/list (toggle)
- Grid: Card with thumbnail, title, pages, status badge, credit cost
- List: Compact rows with metadata

**Right Sidebar**: Contextual
- Document selected → Document info + actions
- Nothing selected → Activity feed (mock) + Quick actions

---

# 22. PDF Viewer

**Route**: `/viewer/:documentId`

**Layout**: Viewer-specific `ViewerLayout.tsx` (full-width, no app sidebar)

**Toolbar** (`PDFToolbar.tsx`):
- Left: Page input, Prev/Next, First/Last
- Center: Zoom out/in, Fit width/Fit page, Rotation
- Right: Layers toggle (OCR, Layout, Vision, Highlights), Sidebar toggle (Chat/Knowledge), More menu

**Page List** (`PDFPageList.tsx`):
- Virtualized via `@tanstack/react-virtual`
- Thumbnails with overlay badges (processing, OCR, highlights)
- Click → jump to page

**Page Rendering** (`PDFPage.tsx`):
- `react-pdf` (PDF.js 5.3.31)
- Canvas renderer, high-DPI aware
- Overlay container: `absolute inset-0` with percentage-positioned children

**Overlays** (all in `src/components/pdf/overlays/`):
- `LayoutOverlay`: Blue rectangles (structure)
- `OCROverlay`: Green text blocks (OCR)
- `VisionOverlay`: Violet semantic boxes (AI)
- `HighlightOverlay`: Yellow user highlights
- `HighlightEditor`: Floating toolbar on text selection

**Keyboard Shortcuts** (global, via `useKeyboardShortcuts`):
- `←/→` / `J/K`: Prev/Next page
- `+/-` / `=/-`: Zoom in/out
- `0`: Fit page, `W`: Fit width
- `R`: Rotate
- `H`: Toggle highlights
- `L`: Toggle layers
- `Esc`: Close sidebars

---

# 23. Chat

**Component**: `ChatSidebar.tsx` (right sidebar in viewer)

**Message Types** (`ChatMessage.tsx`):
- User: Right-aligned, primary bg
- Assistant: Left-aligned, surface bg, streaming animation
- System: Centered, muted, small

**Input** (`ChatInput.tsx`):
- Textarea auto-grows (max 200px)
- Enter = send, Shift+Enter = newline
- Model selector (Free: Flash, Pro: Flash+Pro)
- Token estimate + credit cost preview

**Streaming**: `generateStream` yields chunks → `AnimatePresence` letter-by-letter (optional, configurable)

---

# 24. Highlights

**Creation Flow**:
1. User selects text in PDF page
2. `HighlightEditor` appears at selection center
3. User picks color (5 presets: yellow, green, blue, pink, purple)
4. User adds optional note
5. Save → `highlightStore.addHighlight` → POST to `highlights` table

**Rendering**: `HighlightOverlay` maps percentage coords → CSS `%` → perfect zoom alignment

**Colors** (CSS variables):
```css
--highlight-yellow: #FEF08A;  --highlight-yellow-strong: #EAB308;
--highlight-green: #86EFAC;   --highlight-green-strong: #22C55E;
--highlight-blue: #93C5FD;    --highlight-blue-strong: #3B82F6;
--highlight-pink: #FBCFE8;    --highlight-pink-strong: #EC4899;
--highlight-purple: #D8B4FE;  --highlight-purple-strong: #A855F7;
```

---

# 25. AI Components

**Model Selector** (`ModelSelector.tsx`):
- Dropdown with plan-gated options
- Free: `gemini-1.5-flash` only
- Pro: `gemini-1.5-flash`, `gemini-1.5-pro`

**Credit Cost Badge** (`CreditBadge.tsx`):
- Shows estimated credits before action
- Color: green (affordable), amber (warning), red (insufficient)

**Streaming Indicator** (`StreamingIndicator.tsx`):
- Pulsing dots + "Thinking..." text
- Cancellable via `AbortController`

**Knowledge Card** (`KnowledgeCard.tsx`):
- Flashcard: Front/Back flip
- Glossary: Term + Definition
- Mind Map: Node preview
- Timeline: Event card

---

# 26. Forms

**Primitives** (`src/components/ui/`):
- `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`

**Patterns**:
- Label above, error below (`text-error`, `aria-invalid`)
- Helper text (`text-fg-subtle`)
- Disabled: `opacity-50 cursor-not-allowed`
- Required: `*` in label
- Submit: Primary button, loading spinner state

**Validation**: Client-side (Zod schemas in `src/lib/validation/`) + Server-side (Edge Functions)

---

# 27. Buttons

**Variants** (`Button.tsx`):

| Variant | Styles | Use |
|---------|--------|-----|
| `primary` | `bg-primary text-bg hover:bg-primary-hover` | Main CTAs |
| `secondary` | `bg-surface border-border hover:bg-surface-hover` | Secondary actions |
| `ghost` | `hover:bg-surface-hover` | Toolbar, subtle |
| `destructive` | `bg-error text-white hover:bg-error/90` | Delete, dangerous |
| `outline` | `border-border hover:bg-surface` | Forms, filters |
| `link` | `text-primary underline-offset-2 hover:underline` | Inline actions |

**Sizes**: `sm` (h-8, px-3), `md` (h-10, px-4), `lg` (h-12, px-6), `icon` (h-10, w-10)

**States**: Default, Hover, Active (scale 0.98), Disabled, Loading (spinner)

---

# 28. Modals

**Component**: `Dialog` (Radix) + custom `Modal.tsx` wrapper

**Sizes**: `sm` (max-w-md), `md` (max-w-lg), `lg` (max-w-2xl), `xl` (max-w-4xl), `full` (max-w-screen-2xl)

**Patterns**:
- Header: Title + Close (X)
- Body: Scrollable (max-h-[70vh])
- Footer: Actions (Cancel left, Primary right)
- `Portal` to body, `AnimatePresence` for exit

**Special**: `UpgradeModal` (billing), `CreateWorkspaceModal`, `DeleteConfirmModal`

---

# 29. Notifications

**Library**: `sonner` 2.0.7

**Toaster**: `<Toaster position="bottom-right" theme="dark" />` in `AppProviders`

**Types**:
- `toast.success` — Green, check icon
- `toast.error` — Red, alert icon, action button (retry)
- `toast.info` — Blue, info icon
- `toast.warning` — Amber, warning icon
- `toast.loading` — Spinner, updates to success/error
- `toast.promise` — Auto-resolves promise

**Duration**: 4s default, 8s for errors, persistent for actions

---

# 30. Loading States

**Skeletons** (`Skeleton.tsx`):
- `Skeleton` (basic pulse)
- `SkeletonText` (multi-line)
- `SkeletonCard` (document card)
- `SkeletonPage` (viewer page placeholder)

**Spinners** (`Spinner.tsx`):
- `size`: `sm` (16px), `md` (24px), `lg` (32px)
- `variant`: `primary`, `muted`

**Page Loading**: `LoadingPage.tsx` — Full-screen spinner + "Restoring session..."

---

# 31. Empty States

**Component**: `EmptyState.tsx`

**Props**: `icon`, `title`, `description`, `action` (button)

**Variants**:
- Workspace: Upload illustration + "Drag & drop PDF"
- Chat: Chat bubbles + "Start a conversation"
- Knowledge: Brain + cards + "Generate flashcards"
- Highlights: Highlighter + "Select text to highlight"
- Search: Magnifier + "No results"

---

# 32. Error States

**Inline**: Red text below field, `aria-describedby`

**Toast**: `toast.error("Message", { action: { label: "Retry", onClick } })`

**Boundary**: `ErrorBoundary.tsx` (react-error-boundary) → Fallback UI with "Try again" + "Report bug"

**404**: `NotFound.tsx` — Illustration + "Page not found" + Home link

**500**: `ServerError.tsx` — "Something went wrong" + Refresh button

---

# 33. Skeletons

**Per Component**:
- `DocumentCardSkeleton`: Image placeholder + 3 text lines + badge
- `WorkspaceCardSkeleton`: Avatar + 2 text lines + progress bar
- `ChatMessageSkeleton`: Avatar + 2-3 lines (variable width)
- `KnowledgeItemSkeleton`: Card + 2 lines
- `BillingRowSkeleton`: Icon + label + bar

---

# 34. Context Menus

**Component**: `DropdownMenu` (Radix) + `ContextMenu` wrapper

**Triggers**: Right-click (PDF page, document card, highlight, chat message)

**Items**: `MenuItem`, `MenuCheckboxItem`, `MenuRadioGroup`, `MenuSeparator`, `MenuSub`

**Keyboard**: Arrow keys, Enter, Escape, Type-ahead

---

# 35. Command Palette

**Component**: `CommandPalette.tsx` (⌘K global)

**Source**: `cmk` (cmdk) + Radix `Dialog`

**Sections**:
- Navigation (Go to Workspace, Viewer, Settings, Billing)
- Actions (New Workspace, Upload, Generate Flashcards, Toggle Theme)
- Shortcuts (shows keybindings)
- Recent (last 5 documents/workspaces)

**Search**: Fuzzy match (cmk built-in)

---

# 36. Settings

**Route**: `/settings`

**Tabs** (`SettingsTabs.tsx`):
1. **Profile**: Avatar, name, email, password (Supabase Auth)
2. **Appearance**: Theme (Dark only v1), Density (Compact/Comfortable), Animations
3. **Notifications**: Email, In-app, Digest preferences
4. **Shortcuts**: View/edit keyboard shortcuts (read-only v1)
5. **Data**: Export (JSON), Delete Account
6. **Danger Zone**: Delete all workspaces, Revoke sessions

---

# 37. Billing UI

**Route**: `/billing`

**Components**:
- `PlanComparison`: Free/Pro/Max cards with feature matrix
- `CreditUsageBar`: Visual progress (used/total), color-coded
- `CreditHistory`: Table (Date, Type, Amount, Balance, Description)
- `PurchaseCredits`: Stripe Checkout button (test mode)
- `SubscriptionStatus`: Current plan, renewal date, cancel button

**States**:
- Loading: Skeletons
- Error: Toast + retry
- Empty: "No credit history yet"

---

# 38. Future Components

| Component | Status | Blocked By |
|-----------|--------|------------|
| Mind Map View | Designed | Phase 23 (generate-knowledge action_type) |
| Timeline View | Placeholder (`TimelineView.tsx`) | Phase 23 |
| Presentation View | Missing (`PresentationsView.tsx`) | Phase 23 |
| Podcast Player | Spec only | TTS provider |
| Knowledge Graph | Spec only | Graph DB / RAG |
| Collaboration Panel | Spec only | Realtime + Presence |
| Annotation Tools | Spec only | PDF-lib integration |
| Table Extraction View | Spec only | Table provider |

---

# 39. Design Tokens

**Source**: `src/index.css` (`@theme` block) + `tailwind.config.ts` (legacy compat)

**Export**: `design-tokens.json` (future, for Figma sync)

**Categories**:
- Colors (semantic + brand + data)
- Spacing
- Radius
- Shadows
- Typography (font families, sizes, weights)
- Transitions (duration, easing)
- Z-indices (layered: dropdown=50, modal=100, toast=200, tooltip=300)

---

# 40. Future Design Evolution

- **Light Theme**: Full token set, auto-switch
- **Density Modes**: Compact/Comfortable/Spacious (CSS vars)
- **Custom Themes**: User-defined accent color
- **Motion Presets**: Subtle/Standard/Expressive
- **Design Token Pipeline**: Figma → Tokens Studio → JSON → Tailwind
- **Component Playground**: Storybook (internal)
- **Visual Regression**: Playwright + pixelmatch in CI