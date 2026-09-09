# Lumena Workspace

Technology Stack

Version: 1.0

Status: Implemented

Last Updated: 2026-07-26

---

# Table of Contents

1. Philosophy
2. Stack Selection Rules
3. Frontend
4. Backend
5. Database
6. Authentication
7. Storage
8. AI
9. OCR
10. Payments
11. UI Components
12. State Management
13. Animations
14. Charts & Visualization
15. PDF Engine
16. Development Tools
17. Testing
18. Deployment
19. Monitoring
20. Future Technologies

---

# 1. Philosophy

The technology stack is selected based on long-term maintainability rather than popularity.

Every technology must satisfy at least the following criteria:

- Actively maintained
- Well documented
- Stable
- Production ready
- Scalable
- Strong community adoption
- Compatible with TypeScript

Technologies should never be selected simply because they are trending.

---

# 2. Stack Selection Rules

Before introducing any dependency the AI agent must:

- Research alternatives
- Compare maintenance
- Compare bundle size
- Compare accessibility
- Compare performance
- Compare documentation
- Compare licensing
- Compare community adoption

Explain why the chosen solution is preferred.

---

# 3. Frontend

| Aspect | Technology | Version |
|--------|------------|---------|
| Framework | React | 19.2.7 |
| Language | TypeScript | 6.0.2 |
| Bundler | Vite | 8.1.1 |
| Routing | React Router | 7.18.1 |
| Styling | Tailwind CSS | 4.3.2 |
| Icons | Lucide React | 1.24.0 |
| Fonts | Geist (via CSS), Inter, Outfit | - |

---

# 4. Backend

| Aspect | Technology |
|--------|------------|
| Runtime | Deno (Supabase Edge Functions) |
| Platform | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions) |
| Functions | Deno 1.92 (std/http) |

**Note:** The backend is fully implemented as Supabase Edge Functions. No separate Node.js server is required.

---

# 5. Database

| Aspect | Technology |
|--------|------------|
| Primary | PostgreSQL 15+ |
| Provider | Supabase (Managed) |
| Migrations | Supabase CLI (SQL files in `supabase/migrations/`) |
| ORM/Client | `@supabase/supabase-js` v2 (TypeScript types generated from DB) |
| Realtime | Supabase Realtime (PostgreSQL Changes) |

---

# 6. Authentication

| Aspect | Technology |
|--------|------------|
| Provider | Supabase Auth |
| Methods | Google OAuth, GitHub OAuth, Email/Password, Magic Links |
| Session | JWT (access + refresh tokens) |
| RLS | Row Level Security on all tables |

---

# 7. Storage

| Aspect | Technology |
|--------|------------|
| Object Storage | Supabase Storage |
| Bucket | `workspace_documents` (private, workspace-scoped via RLS) |
| Signed URLs | 1-hour TTL for PDF access |
| CDN | Supabase CDN (automatic) |

---

# 8. AI

| Aspect | Technology |
|--------|------------|
| Provider Framework | Custom (TypeScript interfaces + registry + router + fallback) |
| Primary Provider | Google Gemini (via `@google/generative-ai`) |
| Models | `gemini-1.5-flash`, `gemini-1.5-pro` |
| Provider Abstraction | `AIProvider` interface, `ProviderRegistry`, `ProviderRouter`, `ProviderFallback` |
| Cost Metering | `provider_pricing` table (input/output per 1K tokens, credit conversion rate) |
| Usage Logging | `usage_jobs` table |

**Future Providers:** OpenAI, Anthropic, Groq, Together, Fireworks, DeepInfra, NVIDIA, OpenRouter

---

# 9. OCR

| Aspect | Technology |
|--------|------------|
| Primary Engine | Tesseract.js 7.0.0 (WebAssembly, runs in browser) |
| Provider Interface | `OCRProvider` (Provider Framework) |
| Languages | en, es, fr, de, pt (configurable per document) |
| Fallback Chain | surya-ocr → paddle-ocr → mistral-ocr → tesseract-ocr |
| Output Format | `OCRData` = { text, blocks: {text, bbox[4], confidence, type}[] } |

---

# 10. Payments

| Aspect | Technology |
|--------|------------|
| Provider | Stripe |
| Integration | Supabase Edge Functions (`create-checkout-session`, `stripe-webhook`) |
| SDK | `stripe` v14 (Deno compatible via esm.sh) |
| Mode | Checkout Session (one-time credit packages) |
| Webhook Events | `checkout.session.completed` |

---

# 11. UI Components

| Category | Technology |
|----------|------------|
| Primitives | Radix UI (`@radix-ui/react-*`: Dialog, DropdownMenu, Tooltip, Select, Avatar, Slot, Tooltip) |
| Custom Components | 15+ components in `src/components/ui/` |
| Styling | Tailwind CSS v4 + custom utilities (`cn()`, `glass-*` classes) |
| Animations | Framer Motion 12.42.2 |
| Notifications | Sonner 2.0.7 |
| Virtualization | @tanstack/react-virtual 3.14.5 |

---

# 12. State Management

| Aspect | Technology |
|--------|------------|
| Global Client State | Zustand 5.0.14 (9 stores) |
| Server State | TanStack Query 5.101.2 (`QueryProvider`) |
| Forms | Native HTML + custom Input/Textarea/Select |
| No Redux | Zustand + React Context sufficient |

---

# 13. Animations

| Aspect | Technology |
|--------|------------|
| Library | Framer Motion 12.42.2 |
| Page Transitions | `AnimatePresence` + `motion.div` (opacity, y, blur) |
| Micro-interactions | Hover scales, tap scales, spring transitions |
| 3D Effects | CSS `perspective-1000`, `transform-style-3d`, `rotate-y-180` (StudyModeOverlay) |

---

# 14. Charts & Visualization

| Aspect | Technology |
|--------|------------|
| Current | CSS-based progress bars, animated bars (Framer Motion) |
| Future | Recharts / D3 / React Flow for Mind Maps & Knowledge Graph |

---

# 15. PDF Engine

| Aspect | Technology |
|--------|------------|
| Rendering | PDF.js via `react-pdf` 10.4.1 |
| Worker | `pdfjs-dist` 5.4.296 (Vite asset import) |
| Virtualization | @tanstack/react-virtual 3.14.5 |
| Text Layer | react-pdf built-in |
| Selection | PDF.js TextLayer + DOM Selection API |
| Overlays | CSS percentage positioning (absolute inset-0 containers) |

---

# 16. Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Package Manager | pnpm (workspace) | Fast, disk-efficient |
| Linting | oxlint 1.71.0 | Fast Rust-based linter |
| Formatting | Prettier 3.9.5 | Code formatting |
| Git Hooks | Husky 9.1.7 | Pre-commit, commit-msg |
| Commit Convention | Conventional Commits | Structured git history |
| Type Checking | TypeScript 6.0.2 (strict) | Compile-time safety |
| Node | 24.13.2 | Runtime for tooling |

---

# 17. Testing

| Type | Tool | Version |
|------|------|---------|
| Unit | Vitest | 4.1.10 |
| Component | @testing-library/react | 16.3.2 |
| E2E | Playwright | 1.61.1 |
| Environment | jsdom | 29.1.1 |
| Browser | Brave (Chromium) | Playwright channel |

---

# 18. Deployment

| Layer | Target |
|-------|--------|
| Frontend | Vercel (Preview + Production) |
| Backend | Supabase Edge Functions (auto-deploy via CLI) |
| Database | Supabase PostgreSQL (Managed) |
| Storage | Supabase Storage |
| CI/CD | GitHub Actions (future) |
| Preview Environments | Vercel Preview Deployments (mandatory) |

---

# 19. Monitoring

| Aspect | Technology |
|--------|------------|
| Errors | Console + `security_events` table (future: Sentry) |
| Logs | Supabase Logs + `processing_logs` table |
| Metrics | `usage_jobs`, `credit_ledger`, `rate_limit_counters` |
| Future | Sentry, Better Stack, OpenTelemetry, Vercel Analytics |

---

# 20. Future Technologies

The stack should remain flexible enough to support:

- Desktop Applications (Tauri)
- Mobile Applications (React Native / Expo)
- Browser Extensions (Manifest V3)
- Public API (tRPC / REST)
- Enterprise Features (SSO, SCIM, Audit Logs)
- Offline Support (Service Workers, IndexedDB)
- AI Agents (LangGraph / custom)
- Plugin System (dynamic imports)
- Collaborative Editing (Yjs / Automerge)
- Multi-region deployment