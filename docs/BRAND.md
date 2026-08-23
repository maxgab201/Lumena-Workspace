# Lumena Workspace

Brand Identity Specification

Version: 1.0

Status: Implemented (Dark Theme v1)

Last Updated: 2026-07-27

---

# Table of Contents

1. Brand Philosophy
2. Brand Vision
3. Mission
4. Core Values
5. Brand Personality
6. Brand Voice
7. Naming
8. Logo
9. Logo Usage
10. Logo Variations
11. Color Palette
12. Typography
13. Iconography
14. Illustrations
15. Imagery
16. Motion Identity
17. UI Branding
18. Landing Page Branding
19. Marketing Style
20. Copywriting Guidelines
21. Tone of Voice
22. Brand Applications
23. Merchandise
24. Social Media
25. Accessibility
26. Brand Evolution
27. Brand Restrictions
28. Future Identity

---

# 1. Brand Philosophy

**Light in the Dark of Information Overload**

Lumena (from Latin *lumen* — light) exists to illuminate knowledge hidden in documents. Our brand embodies clarity, precision, and the transformative power of AI-assisted understanding.

**Core Metaphor**: A focused beam cutting through darkness — not a floodlight, but a laser. Precision over breadth. Depth over noise.

---

# 2. Brand Vision

A world where every document is a queryable, teachable, connectable knowledge source — not a static file.

---

# 3. Mission

Transform documents into actionable knowledge through AI, enabling professionals, researchers, and students to learn faster, think deeper, and create better.

---

# 4. Core Values

| Value | Manifestation |
|-------|---------------|
| **Innovation** | Provider-agnostic architecture, latest AI models, experimental features |
| **Knowledge** | Flashcards, glossaries, mind maps, timelines — tools for understanding |
| **Trust** | Immutable credit ledger, RLS isolation, zero-trust architecture |
| **Quality** | 60fps virtualization, pixel-perfect overlays, accessible by default |
| **Accessibility** | WCAG 2.1 AA, keyboard-first, reduced motion, screen reader support |
| **Transparency** | Credit costs shown before actions, open architecture, no dark patterns |
| **Long-term Thinking** | Provider Framework, ledger-based billing, semantic versioning |

---

# 5. Brand Personality

| Trait | Expression |
|-------|------------|
| **Professional** | Clean, precise, reliable — not playful or quirky |
| **Modern** | React 19, Tailwind v4, PDF.js 5, cutting-edge but stable |
| **Intelligent** | AI-native, provider routing, semantic overlays |
| **Friendly** | Helpful empty states, clear errors, guided onboarding |
| **Minimalist** | Dark theme, glassmorphism, generous whitespace |
| **Premium** | Framer Motion micro-interactions, thoughtful details |
| **Reliable** | Circuit breakers, fallback providers, immutable audit |
| **Future-Oriented** | Extensible architecture, plugin-ready, API-first mindset |

---

# 6. Brand Voice

**Clear, Simple, Confident, Educational, Helpful — Never Arrogant, Never Overly Technical Without Explanation**

| Context | Voice |
|---------|-------|
| **Onboarding** | "Welcome. Let's get your first document uploaded." |
| **Errors** | "Something went wrong. Here's what happened and how to fix it." |
| **Empty States** | "No documents yet. Drag a PDF to get started." |
| **Billing** | "You've used 42 of 50 credits. Upgrade for 1,000/month." |
| **AI Features** | "Generating flashcards... This uses ~10 credits." |
| **Documentation** | "Here's how it works. Here's why it matters." |

---

# 7. Naming

| Level | Name | Usage |
|-------|------|-------|
| **Primary Brand** | Lumena | Logo, domain, legal |
| **Primary Product** | Lumena Workspace | App name, window title, marketing |
| **AI Features** | Lumena AI | Chat, knowledge generation, gateway |
| **Future Products** | Lumena Mobile, Lumena Teams, Lumena API, Lumena Cloud | Roadmap |

**Tagline Options**:
- "Your documents, illuminated."
- "Where documents become knowledge."
- "Read less. Understand more."

---

# 8. Logo

**Current Status**: Text-based placeholder ("Lumena" in Geist Sans Semibold)

**Design Intent** (for future designer):
- Geometric "L" mark suggesting: light beam, document corner, upward arrow
- Works at 16px (favicon) and 500px (billboard)
- Single color (teal #00D4AA) on dark, white on light
- No gradients in mark (gradients reserved for UI backgrounds)

**Files** (future):
- `public/logo.svg` — primary
- `public/logo-white.svg` — light background
- `public/logo-icon.svg` — mark only
- `public/favicon.svg` — 32x32

---

# 9. Logo Usage

| Rule | Specification |
|------|---------------|
| **Minimum Size** | 24px height (digital), 0.5in (print) |
| **Clear Space** | 1x logo height on all sides |
| **Backgrounds** | Dark preferred; white only on light backgrounds |
| **Forbidden** | Stretching, recoloring, drop shadows, outlines, rotation |

---

# 10. Logo Variations

| Variation | Use Case |
|-----------|----------|
| **Primary** | Dark backgrounds, app header, marketing |
| **White** | Light backgrounds, partner logos |
| **Icon Only** | Favicon, app icon, social avatar |
| **Horizontal** | Wide spaces (navigation bars) |
| **Vertical** | Stacked spaces (mobile, footers) |
| **App Icon** | iOS/Android (rounded square, safe area) |
| **Favicon** | 16x16, 32x32, 48x48, SVG |

---

# 11. Color Palette

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

  /* Data Visualization */
  --color-chart-1: #00D4AA;
  --color-chart-2: #F59E0B;
  --color-chart-3: #A855F7;
  --color-chart-4: #F43F5E;
  --color-chart-5: #06B6D4;
  --color-chart-6: #6366F1;
}
```

**Dark Theme Only (v1)**. Light theme tokens defined but not implemented.

**Usage**: Tailwind utilities map directly: `bg-bg`, `text-fg`, `border-border`, `bg-primary`, `text-primary`, etc.

---

# 12. Typography

**Font Stack**: `Geist Sans` (UI), `Geist Mono` (code), system fallbacks

Loaded via `@fontsource/geist` and `@fontsource/geist-mono` in `src/main.tsx`.

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

# 13. Iconography

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
- Navigation: `ChevronLeft`, `ChevronRight`, `ChevronDown`, `Menu`, `X`

---

# 14. Illustrations

**Style**: Abstract geometric meshes (landing), minimal line art (empty states)

**Landing Hero**: Animated `MeshGradient` component (CSS `@property` + canvas fallback)

**Empty State SVGs** (`src/assets/illustrations/`):
- `empty-workspace.svg` — document upload prompt
- `empty-chat.svg` — chat bubbles
- `empty-knowledge.svg` — brain + cards
- `empty-highlights.svg` — highlighter

**No stock photography**. Custom illustrations only.

---

# 15. Imagery

**Product Screenshots**: Real app captures, dark theme, annotated for features

**No**: Stock photos, generic tech imagery, people photos

**Alt Text**: Descriptive, functional ("PDF viewer with OCR overlay enabled")

---

# 16. Motion Identity

**Library**: `framer-motion` 12.23.12

**Principles**:
- Spring default: `stiffness: 300, damping: 30`
- Duration cap: 300ms for micro-interactions
- Stagger: 50ms per item in lists
- Exit animations: `AnimatePresence` for all conditional renders

**Reduced Motion**: `prefers-reduced-motion` respected globally via `useReducedMotion` hook — springs become instant (`duration: 0.01ms`)

---

# 17. Animation Guidelines

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

---

# 18. Landing Page Branding

**Route**: `/`

**Sections**:
1. **Hero**: Animated mesh gradient, headline, CTA (Sign Up), secondary (Demo)
2. **Trust Bar**: Placeholder logos
3. **Features**: 3-column (PDF Intelligence, AI Knowledge, Smart Highlights)
4. **Viewer Preview**: Static interactive mockup
5. **Knowledge Tools**: Flashcards, Glossary, Mind Map, Timeline cards
6. **Pricing**: Free / Pro / Max with credit comparison
7. **Footer**: Links, social, legal

**Animations**: `whileInView` scroll reveal, continuous hero mesh animation

---

# 19. Marketing Style

**Headlines**: Sentence case, active verbs, benefit-led
- ❌ "AI-Powered Document Analysis"
- ✅ "Turn PDFs into flashcards in seconds"

**Buttons**: Imperative, specific
- ❌ "Submit"
- ✅ "Generate Flashcards" / "Upgrade to Pro"

**Tooltips**: Helpful context, not definitions
- ❌ "This is the zoom slider"
- ✅ "Drag to zoom. Double-click to reset."

**Emails**: Plain text feel, single CTA, unsubscribe link

**Notifications**: Actionable, time-bound
- ❌ "New feature available"
- ✅ "You have 12 credits expiring tomorrow. Use them?"

---

# 20. Copywriting Guidelines

| Element | Rule |
|---------|------|
| **Headlines** | Sentence case, ≤60 chars, verb-led |
| **Body** | Short paragraphs, bullet points, scannable |
| **Buttons** | Verb + noun ("Generate Flashcards"), not generic |
| **Errors** | What happened + what to do, no codes |
| **Empty States** | What + why + action |
| **Tooltips** | Contextual help, not labels |
| **Loading** | "Generating..." not "Loading..." |

---

# 21. Tone of Voice

| Dimension | Position |
|-----------|----------|
| **Formal ↔ Casual** | Professional but approachable |
| **Technical ↔ Accessible** | Explain jargon, show don't tell |
| **Serious ↔ Playful** | Serious with occasional warmth |
| **Concise ↔ Verbose** | Concise, every word earns its place |
| **Authoritative ↔ Collaborative** | Expert guide, not boss |

---

# 22. Brand Applications

| Application | Status |
|-------------|--------|
| Website (lumena.app) | Landing page implemented |
| Dashboard App | Implemented |
| Email Templates | Planned |
| Documentation | Implemented (this doc set) |
| Presentations | Template needed |
| Business Cards | Not yet |
| Merchandise | Not yet |
| Social Media | Not yet |

---

# 23. Merchandise

**Future**: Stickers (logo mark), notebooks (grid + dot), hoodies (dark, minimal logo)

---

# 24. Social Media

**Handles** (to claim): `@lumena`, `@lumenaworkspace`, `@lumena_ai`

**Content Pillars**:
- Product updates (features, releases)
- Education (how to use knowledge tools)
- Behind the scenes (architecture decisions)
- Community (user workflows, templates)

---

# 25. Accessibility

| Aspect | Standard |
|--------|----------|
| **Color Contrast** | ≥4.5:1 text, ≥3:1 UI (WCAG AA) |
| **Typography** | ≥16px base, scalable, readable fonts |
| **Motion** | `prefers-reduced-motion` respected |
| **Screen Readers** | Semantic HTML, ARIA labels, live regions |
| **Keyboard** | All interactive elements reachable, visible focus |

---

# 26. Brand Evolution

**v1 (Current)**: Dark theme, text logo, teal accent, glassmorphism

**v2 (Post-Launch)**:
- Light theme (full token set)
- Refined logo mark
- Density modes (Compact/Comfortable/Spacious)
- Custom themes (user accent color)
- Motion presets (Subtle/Standard/Expressive)

**Enterprise**: Sub-brand with stricter guidelines, co-branding options

---

# 27. Brand Restrictions

| Never | Reason |
|-------|--------|
| Distort the logo | Brand recognition |
| Use unofficial colors | Consistency, accessibility |
| Use inconsistent typography | Professionalism |
| Imitate competitors | Differentiation |
| Compromise accessibility | Inclusion, legal |

---

# 28. Future Identity

| Expansion | Consideration |
|-----------|---------------|
| **Brand Expansion** | Lumena AI, Lumena Teams, Lumena API as sub-brands |
| **Enterprise Identity** | Stricter guidelines, co-branding, white-label options |
| **Educational Identity** | Friendlier tone, brighter accents, campus programs |
| **Mobile Identity** | App icon system, splash screens, platform guidelines |
| **Global Localization** | RTL support, cultural color adaptation, translation |
| **Rebranding Guidelines** | Evolution not revolution, maintain recognition |