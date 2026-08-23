# Lumena Workspace

Testing Specification

Version: 1.0

Status: Implemented (Configuration Complete, Tests In Progress)

Last Updated: 2026-07-27

---

# Table of Contents

1. Testing Philosophy
2. Quality Goals
3. Testing Pyramid
4. Unit Testing
5. Component Testing
6. Integration Testing
7. End-to-End Testing
8. AI Testing
9. OCR Testing
10. PDF Testing
11. Authentication Testing
12. Database Testing
13. API Testing
14. Security Testing
15. Performance Testing
16. Accessibility Testing
17. Cross-Browser Testing
18. Responsive Testing
19. Visual Regression
20. Load Testing
21. Stress Testing
22. Error Recovery
23. CI/CD Testing
24. Manual Testing
25. Bug Reporting
26. Regression Testing
27. Test Data
28. Coverage Requirements
29. Release Checklist
30. Future Testing

---

# 1. Testing Philosophy

- **Test behavior, not implementation**: Tests should survive refactoring
- **Fast feedback**: Unit tests < 1s, Component < 5s, E2E < 60s
- **Deterministic**: No flaky tests — fix or delete
- **Production-like**: Test against real Supabase (dev project), real APIs
- **Shift Left**: Catch bugs at the lowest possible level

---

# 2. Quality Goals

| Metric | Target |
|--------|--------|
| Unit Test Coverage | > 80% (stores, utilities, providers) |
| Component Coverage | > 70% (UI components) |
| E2E Coverage | Critical paths only (auth, upload, chat, billing) |
| TypeScript Errors | 0 |
| Oxlint Errors | 0 |
| Accessibility (axe) | 0 violations (WCAG 2.1 AA) |
| Performance (Lighthouse) | > 90 |
| Bundle Size (gzipped) | < 200KB initial |

---

# 3. Testing Pyramid

```
        ████ E2E (Playwright) — 10 tests, critical paths
      ████████ Integration — 20 tests, store + repository + Edge Function
    ████████████ Component (Testing Library) — 50 tests, UI behavior
  ████████████████ Unit (Vitest) — 100 tests, pure logic, stores, providers
```

**Ratio**: 70% Unit / 20% Component / 10% E2E

---

# 4. Unit Testing

**Tool**: Vitest 4.1.10

**Targets**:
- Zustand stores (`src/stores/*.ts`)
- Provider Framework (`src/lib/providers/**/*.ts`)
- Processing stages (`src/lib/processing/**/*.ts`)
- Utilities (`src/lib/utils.ts`, `src/lib/providers/types.ts`)
- Highlight Engine (`src/lib/processing/HighlightEngine.ts`)

**Patterns**:
```typescript
// Store testing
import { useWorkspaceStore } from '../stores/workspaceStore'
import { act } from 'react'

test('fetchWorkspaces populates store', async () => {
  const { result } = renderHook(() => useWorkspaceStore())
  await act(async () => { await result.current.fetchWorkspaces() })
  expect(result.current.workspaces).toHaveLength(1)
})

// Provider testing
test('TesseractOCRProvider healthCheck returns true after init', async () => {
  const provider = new TesseractOCRProvider()
  await provider.initialize()
  expect(await provider.healthCheck()).toBe(true)
})
```

**Mocking**: 
- Supabase client: `vi.mock('../lib/supabase')`
- External APIs: MSW (Mock Service Worker) for Edge Function tests

---

# 5. Component Testing

**Tool**: @testing-library/react 16.3.2 + Vitest + jsdom

**Targets**:
- UI Primitives (`src/components/ui/*.tsx`)
- PDF Components (`src/components/pdf/*.tsx`)
- Chat Components (`src/components/chat/*.tsx`)
- Knowledge Components (`src/components/knowledge/*.tsx`)
- Layout Components (`src/components/layout/*.tsx`)

**Patterns**:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../components/ui/Button'

test('Button renders children and handles click', () => {
  const handleClick = vi.fn()
  render(<Button onClick={handleClick}>Click me</Button>)
  expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button'))
  expect(handleClick).toHaveBeenCalledTimes(1)
})
```

**Providers**: Wrap with test providers
```tsx
const TestWrapper = ({ children }) => (
  <QueryProvider>
    <ThemeProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  </QueryProvider>
)
```

---

# 6. Integration Testing

**Scope**: Store + Repository + Edge Function (mocked)

**Targets**:
- `workspaceStore` + `workspaceRepository` + Supabase
- `chatStore` + `chatRepository` + `AIGateway` (mocked)
- `knowledgeStore` + `knowledgeRepository` + `generate-knowledge` (mocked)
- `billingStore` + `billingRepository` + Stripe (mocked)
- `highlightStore` + `highlightRepository`

**Patterns**:
```typescript
// Mock Supabase responses
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockData, error: null })
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { text: 'AI response' }, error: null })
    }
  }
}))
```

---

# 7. End-to-End Testing

**Tool**: Playwright 1.61.1

**Browser**: Brave (Chromium-based)

**Config** (`playwright.config.ts`):
```typescript
export default defineConfig({
  timeout: 60000,
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'brave', use: { ...devices['Desktop Chrome'], channel: 'chrome' }}],
})
```

**Critical Paths** (tests in `tests/`):

| Test | Description |
|------|-------------|
| `auth.spec.ts` | Sign up → email confirm → sign in → dashboard |
| `upload.spec.ts` | Drag-drop PDF → processing → ready → viewer |
| `chat.spec.ts` | Open viewer → send message → receive response |
| `billing.spec.ts` | Open billing → view credits → checkout (mocked) |
| `highlights.spec.ts` | Select text → create highlight → verify overlay |
| `knowledge.spec.ts` | Generate flashcards → view → study mode |

**Test Data**: Seeded via Supabase SQL in `tests/fixtures/seed.sql`

---

# 8. AI Testing

**Challenges**: Non-deterministic outputs, cost, latency

**Strategy**:
1. **Mock Provider**: `MockAIProvider` for unit/component tests
2. **Golden Master**: Record real responses, assert structure (not exact text)
3. **Structured Output**: Test JSON schema validation (`generate-knowledge`)
4. **Cost Control**: CI uses mocks; manual tests hit real API

**Tests**:
```typescript
// Unit: MockAIProvider returns valid structure
test('MockAIProvider.generateStream yields chunks', async () => {
  const provider = new MockAIProvider()
  const chunks: string[] = []
  await provider.generateStream('test', undefined, c => chunks.push(c))
  expect(chunks.length).toBeGreaterThan(0)
  expect(chunks.join('')).toContain('simulated')
})

// Integration: generate-knowledge returns valid Flashcard[]
test('generate-knowledge returns flashcards', async () => {
  const { data } = await supabase.functions.invoke('generate-knowledge', {
    body: { document_id: testDocId, workspace_id: testWsId, action_type: 'flashcards' }
  })
  expect(data.items).toBeInstanceOf(Array)
  data.items.forEach(item => {
    expect(item).toHaveProperty('front')
    expect(item).toHaveProperty('back')
  })
})
```

---

# 9. OCR Testing

**Current**: Tesseract.js in browser (WASM)

**Tests**:
- `TesseractOCRProvider.initialize()` loads worker
- `processPage()` returns `OCRData` with text + blocks
- Bounding boxes normalized [0-1]
- Language reinitialization works

**Fixtures**: Sample PDFs in `tests/fixtures/pdfs/`

---

# 10. PDF Testing

**Targets**:
- `PDFViewer` loads document, shows toolbar
- `PDFPageList` virtualizes (only visible pages rendered)
- Zoom/rotation keyboard shortcuts
- Page navigation (next/prev, first/last)
- Text selection → highlight creation

**Fixtures**: Multi-page PDFs (10, 50, 300 pages)

---

# 11. Authentication Testing

**E2E Tests**:
- Sign up with email/password → confirmation email → sign in
- Sign up with Google OAuth → redirect → dashboard
- Sign up with GitHub OAuth → redirect → dashboard
- Sign in with wrong password → error
- Forgot password → reset link → new password
- Session persistence across refresh
- Protected route redirect when unauthenticated
- Public route redirect when authenticated

**Unit**: `AuthRepository` methods (mocked Supabase)

---

# 12. Database Testing

**Approach**: Test against real Supabase dev database

**Tests**:
- RLS policies enforce workspace isolation
- Triggers fire (workspace → credit_account)
- Cascades work (delete workspace → deletes documents, highlights, etc.)
- Enums constrain values
- Unique constraints prevent duplicates
- FK constraints prevent orphans

**Migrations**: `supabase db reset` in CI creates fresh DB

---

# 13. API Testing

**Edge Function Tests** (invoke via Supabase client):
- `ai-gateway`: Plan enforcement, credit quota, rate limit, injection detection
- `generate-knowledge`: All action_types return valid structures
- `process-document`: Credit reservation, processing stages, settlement
- `create-checkout-session`: Returns Stripe URL (mocked in test)
- `stripe-webhook`: Processes `checkout.session.completed` (mocked)

---

# 14. Security Testing

**Automated**:
- `npm audit` / `pnpm audit` in CI
- `oxlint` security rules
- Dependency review (GitHub Dependabot)

**Manual** (Periodic):
- Prompt injection attempts (blocked?)
- Rate limit evasion (blocked?)
- Credit manipulation (blocked by RLS?)
- File upload bypass (blocked?)
- XSS via AI output (escaped?)
- SSRF via Edge Functions (allowlist only?)

**Tools**: OWASP ZAP (future), Burp Suite (manual)

---

# 15. Performance Testing

**Metrics**:
- Initial load (Vercel Analytics + Lighthouse)
- PDF render time (first page < 500ms)
- Virtualization scroll FPS (60fps target)
- Chat response latency (P50 < 2s, P95 < 5s)
- Bundle size (gzipped < 200KB)

**Tools**:
- Lighthouse CI (PR checks)
- Web Vitals (Vercel Analytics)
- Custom marks in code (`performance.mark`)

---

# 16. Accessibility Testing

**Automated**: axe-core in component tests + Playwright
```typescript
import { injectAxe, checkA11y } from '@axe-core/playwright'
test('Page has no a11y violations', async ({ page }) => {
  await injectAxe(page)
  await checkA11y(page)
})
```

**Manual** (Release Checklist):
- Keyboard navigation (Tab, Enter, Escape, Arrows)
- Screen reader (NVDA/VoiceOver) — key flows
- Color contrast (WCAG 2.1 AA)
- Focus indicators visible
- ARIA labels on interactive elements
- Reduced motion respected

**Current**: Radix UI primitives provide baseline accessibility

---

# 17. Cross-Browser Testing

**Primary**: Brave/Chromium (Playwright)

**Secondary** (Manual, Release):
- Firefox (latest)
- Safari (macOS/iOS)
- Edge (latest)

**Mobile**: Chrome DevTools device toolbar + real device (iOS Safari, Android Chrome)

---

# 18. Responsive Testing

**Breakpoints**:
- Mobile: < 768px (single column, collapsible sidebar)
- Tablet: 768px - 1024px (sidebar overlay)
- Desktop: > 1024px (three-panel layout)
- Ultra-wide: > 1440px (max-width containers)

**Test**: Playwright viewport resize + visual checks

---

# 19. Visual Regression

**Tool**: Playwright `toMatchSnapshot()` (future)

**Current**: Manual review of Preview deployments

**Critical Pages**:
- Landing (hero, features, pricing)
- Dashboard (empty, with documents, grid/list)
- Viewer (toolbar, pages, overlays, sidebars)
- Billing (plans, credits, history)
- Settings (all tabs)

---

# 20. Load Testing

**Not Yet Implemented**

**Future**: k6 or Artillery
- 100 concurrent users uploading PDFs
- 50 concurrent chat sessions
- 1000 documents in workspace
- 300-page PDF rendering

**Metrics**: P95 latency, error rate, throughput

---

# 21. Stress Testing

**Scenarios**:
- Maximum file size (50MB PDF)
- Maximum pages (500+)
- Rapid chat messages (burst)
- Concurrent knowledge generation
- Credit exhaustion edge cases

---

# 22. Error Recovery

**Test Scenarios**:
- Network offline → online (Supabase reconnect)
- Edge Function timeout → retry
- AI provider failure → fallback
- Payment failure → credit not granted
- Corrupted PDF → graceful error
- Session expiry → auto-refresh → continue

---

# 23. CI/CD Testing

**Pipeline** (Future GitHub Actions):
```yaml
# On PR
- lint (oxlint)
- typecheck (tsc --noEmit)
- unit tests (vitest --run)
- component tests (vitest --run)
- build (vite build)

# On merge to main
- All above +
- e2e tests (playwright)
- deploy preview
- deploy staging (if main)

# On tag
- All above +
- deploy production
```

---

# 24. Manual Testing

**Release Checklist** (Per `DEPLOYMENT.md`):
- [ ] Sign up / Sign in (all methods)
- [ ] Create workspace
- [ ] Upload PDF (various sizes, page counts)
- [ ] Wait for processing → open viewer
- [ ] Navigate pages (keyboard + toolbar)
- [ ] Zoom / Rotate
- [ ] Create highlights (selection + editor)
- [ ] Open chat → send messages
- [ ] Switch models (Free vs Pro)
- [ ] Generate flashcards / glossary / mindmap / timeline
- [ ] Open study mode → flip cards
- [ ] Open billing → view credits / history
- [ ] Purchase credits (Stripe test mode)
- [ ] Settings: theme, notifications, shortcuts
- [ ] Responsive: mobile, tablet, desktop
- [ ] Accessibility: keyboard, screen reader

---

# 25. Bug Reporting

**Template** (GitHub Issues):
```markdown
## Bug Report

**Environment**: [Local / Preview / Staging / Production]
**Browser**: [Chrome / Firefox / Safari / Brave]
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected**: 
**Actual**: 

**Screenshots/Video**: 
**Console Errors**: 
**Network Logs**: 
```

**Labels**: `bug`, `severity:critical|high|medium|low`, `area:auth|pdf|chat|billing|etc`

---

# 26. Regression Testing

**Strategy**: 
- E2E suite runs on every PR (critical paths)
- Full E2E on merge to main
- Manual regression for release candidates
- Golden master for AI outputs (structure only)

**Flaky Test Policy**: 
- Quarantine immediately (`test.skip`)
- Fix within 48 hours or delete
- Root cause documented

---

# 27. Test Data

**Fixtures** (`tests/fixtures/`):
- `pdfs/` — Sample PDFs (1pg, 10pg, 50pg, 300pg, scanned, digital, mixed)
- `seed.sql` — Supabase seed data (users, workspaces, documents, credits)
- `mock-ai-responses.json` — Recorded AI Gateway responses

**Seeding**:
```bash
# Local
supabase db reset  # Runs migrations + seed.sql

# CI
# GitHub Action runs supabase db reset on dev project
```

---

# 28. Coverage Requirements

| Layer | Minimum Coverage |
|-------|-----------------|
| Stores (Zustand) | 90% |
| Repositories | 80% |
| Providers | 85% |
| Processing Stages | 80% |
| Utilities | 95% |
| UI Components | 70% |
| Pages | 50% (smoke) |

**Enforcement**: `vitest --coverage` in CI (future)

---

# 29. Release Checklist

From `DEPLOYMENT.md` + `ROADMAP.md`:

- [ ] All CI checks pass (lint, typecheck, build, tests)
- [ ] E2E critical paths pass
- [ ] Manual release checklist complete
- [ ] Accessibility audit (axe + manual)
- [ ] Performance budgets met (Lighthouse > 90)
- [ ] Security review (dependencies, secrets, headers)
- [ ] Documentation updated (CHANGELOG, relevant docs)
- [ ] Database migrations applied to staging
- [ ] Edge Functions deployed to staging
- [ ] Stripe webhooks configured for staging
- [ ] Smoke tests on staging
- [ ] Tag release
- [ ] Production deploy
- [ ] Post-deploy verification

---

# 30. Future Testing

- **AI Evaluation**: LLM-as-judge for response quality
- **Model Benchmarks**: Compare providers on latency/cost/quality
- **Chaos Testing**: Kill Edge Functions, DB, Storage mid-operation
- **Continuous Quality Monitoring**: Synthetic transactions every 5min
- **Automatic UI Regression**: Playwright visual diff on PR
- **Contract Testing**: Supabase client ↔ DB schema
- **Property-Based Testing**: fast-check for providers