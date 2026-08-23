# Lumena Workspace

Deployment Specification

Version: 1.0

Status: Implemented

Last Updated: 2026-07-27

---

# Table of Contents

1. Deployment Philosophy
2. Infrastructure Goals
3. Environments
4. Local Development
5. Development Environment
6. Preview Environment
7. Staging Environment
8. Production Environment
9. Git Workflow
10. GitHub
11. Branch Strategy
12. CI/CD Pipeline
13. Vercel Deployment
14. Environment Variables
15. Secrets Management
16. Database Deployment
17. Storage Deployment
18. Background Workers
19. Scheduled Jobs
20. Monitoring
21. Logging
22. Alerts
23. Rollbacks
24. Backups
25. Release Process
26. Versioning
27. Health Checks
28. Disaster Recovery
29. Scaling Strategy
30. Future Infrastructure

---

# 1. Deployment Philosophy

- **GitOps**: Infrastructure and application state defined in Git
- **Preview Every PR**: Automatic preview deployments for all pull requests
- **Immutable Deployments**: Each deployment is a complete, versioned artifact
- **Zero-Downtime**: Rolling updates, health checks, graceful shutdown
- **Observability First**: Logging, metrics, tracing built-in

---

# 2. Infrastructure Goals

- Sub-100ms global latency (Vercel Edge + Supabase)
- 99.9% uptime SLA target
- Automatic scaling (Vercel + Supabase serverless)
- Cost efficiency (pay-per-use for Edge Functions)
- Developer velocity (fast feedback loops)

---

# 3. Environments

| Environment | Purpose | URL | Auto-Deploy |
|-------------|---------|-----|-------------|
| Local | Development | `http://localhost:5173` | `pnpm dev` |
| Preview | PR Validation | `https://lumena-git-<branch>-<org>.vercel.app` | On PR open/update |
| Staging | Pre-production Testing | `https://staging.lumena.app` | On merge to `main` |
| Production | Live Users | `https://lumena.app` | On tag/release |

---

# 4. Local Development

**Prerequisites**:
- Node.js 20+ (via nvm/fnm)
- pnpm 9+
- Supabase CLI (`supabase` binary)
- Docker (for local Supabase)

**Setup**:
```bash
# Clone
git clone https://github.com/<org>/lumena-workspace.git
cd lumena-workspace

# Install dependencies
pnpm install

# Start local Supabase (optional - uses hosted project by default)
supabase start

# Copy env template
cp .env.example .env.local
# Edit with your Supabase project credentials

# Start dev server
pnpm dev
```

**Environment Variables** (`.env.local`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Local Supabase** (if used):
- API: `http://localhost:54321`
- DB: `postgresql://postgres:postgres@localhost:54322/postgres`
- Studio: `http://localhost:54323`

---

# 5. Development Environment

**Shared Development Project** (Supabase):
- Project: `nsjetmjtwbhellqasggw` (current)
- Used by all developers for integration testing
- Data is ephemeral — reset periodically
- Edge Functions deployed via `supabase functions deploy`

**Vercel Preview Deployments**:
- Automatic on every PR
- Unique URL per PR
- Comments on PR with preview link
- Expires after 30 days of inactivity

---

# 6. Preview Environment

**Trigger**: Pull Request opened/updated

**Process**:
1. GitHub Actions (or Vercel Git Integration) detects PR
2. Installs dependencies (`pnpm install --frozen-lockfile`)
3. Runs type check (`pnpm tsc --noEmit`)
4. Runs lint (`pnpm lint`)
5. Runs tests (`pnpm test` — future)
6. Builds (`pnpm build`)
7. Deploys to Vercel Preview
8. Posts comment on PR with URL

**Preview-Specific Config**:
- Uses development Supabase project
- Stripe test mode
- Mock AI responses (if no API key)

---

# 7. Staging Environment

**Trigger**: Merge to `main` branch

**Purpose**: Pre-production validation with production-like data

**Differences from Preview**:
- Dedicated Supabase project (staging)
- Stripe test mode with test webhooks
- Real AI API keys (Gemini test quota)
- Performance testing baseline

**Deployment**: Automatic on `main` merge via Vercel

---

# 8. Production Environment

**Trigger**: Git tag (`v*`) or manual promotion

**Process**:
1. Create release tag: `git tag v1.0.0 && git push origin v1.0.0`
2. GitHub Actions builds and deploys to Vercel Production
3. Supabase Edge Functions deployed via `supabase functions deploy --project-ref <prod-ref>`
4. Database migrations applied via `supabase db push --project-ref <prod-ref>`
5. Smoke tests run against production URL
6. Rollback capability: `vercel rollback` or previous tag

**Production Supabase Project**: Separate from dev/staging

---

# 9. Git Workflow

**Conventional Commits**:
```
feat: add flashcard generation
fix: resolve highlight offset on zoom
docs: update API specification
refactor: simplify provider registry
test: add chat store unit tests
chore: update dependencies
```

**Commit Message Format**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Hooks** (Husky):
- `pre-commit`: `pnpm lint-staged` (oxlint + prettier)
- `commit-msg`: Validate conventional commit format
- `pre-push`: `pnpm typecheck` (optional)

---

# 10. GitHub

**Repository**: `github.com/<org>/lumena-workspace`

**Branch Protection** (`main`):
- Require PR reviews (1+)
- Require status checks (lint, typecheck, build)
- Require linear history
- No force pushes
- No deletions

**Labels**:
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `refactor` — Code improvement
- `security` — Security related
- `blocked` — Waiting on external

---

# 11. Branch Strategy

```
main ──────────────────────────────────► (production)
  │
  ├─ feature/auth-google
  ├─ feature/pdf-virtualization
  ├─ fix/highlight-z-index
  └─ chore/update-deps
```

**Rules**:
- All work on feature branches from `main`
- PR required for all changes to `main`
- Squash merge (clean history)
- Delete branch after merge
- Hotfixes: `hotfix/<issue>` from `main` → PR to `main`

---

# 12. CI/CD Pipeline

**Current**: Vercel Git Integration (simpler, sufficient for now)

**Future GitHub Actions Workflow** (`.github/workflows/ci.yml`):
```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm tsc --noEmit
  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
  test:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm test --run
      - run: pnpm playwright install --with-deps
      - run: pnpm test:e2e
```

---

# 13. Vercel Deployment

**Project Settings**:
- Framework Preset: Vite
- Build Command: `pnpm build`
- Output Directory: `dist`
- Install Command: `pnpm install`
- Node Version: 20.x

**Environment Variables** (Vercel Dashboard):
| Variable | Preview | Production |
|----------|---------|------------|
| `VITE_SUPABASE_URL` | Dev project | Prod project |
| `VITE_SUPABASE_ANON_KEY` | Dev anon key | Prod anon key |

**Custom Domain**: `lumena.app` → Vercel DNS

**Edge Functions**: Not used (frontend is static SPA)

**Rewrites**: SPA fallback to `index.html` (Vercel default)

---

# 14. Environment Variables

## Frontend (Vite)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes |

## Edge Functions (Deno.env)

| Variable | Description | Functions |
|----------|-------------|-----------|
| `SUPABASE_URL` | Supabase project URL | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypass RLS) | All |
| `GEMINI_API_KEY` | Google AI API key | `ai-gateway`, `generate-knowledge` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `create-checkout-session`, `stripe-webhook` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `stripe-webhook` |

**Set via**:
```bash
supabase secrets set GEMINI_API_KEY=xxx --project-ref <ref>
# Or Dashboard → Edge Functions → Settings
```

---

# 15. Secrets Management

**Local Development**: `.env.local` (gitignored)

**Preview/Staging/Production**:
- **Vercel**: Project Settings → Environment Variables
- **Supabase Edge Functions**: Dashboard → Edge Functions → Settings → Secrets
- **Stripe**: Dashboard → Developers → Webhooks / API Keys

**Rotation**:
- Supabase keys: Dashboard → Settings → API
- Stripe keys: Dashboard → Developers → API Keys (rotate periodically)
- Gemini key: Google AI Studio → API Keys

**Never Commit Secrets**: Verified by `git-secrets` / `truffleHog` in CI (future)

---

# 16. Database Deployment

**Migrations**: SQL files in `supabase/migrations/`

**Local**:
```bash
supabase db reset  # Apply all migrations fresh
supabase migration new <name>  # Create new migration
```

**Preview/Staging/Production**:
```bash
# Push migrations to remote project
supabase db push --project-ref <ref>

# Or use Supabase CLI in CI/CD
# supabase db push --project-ref $SUPABASE_PROJECT_REF
```

**Migration Safety**:
- All migrations are additive (no DROP COLUMN in production)
- Backwards compatible (new columns NULLABLE or with DEFAULT)
- Test on staging before production
- Rollback: Manual SQL (Supabase doesn't auto-rollback)

---

# 17. Storage Deployment

**Bucket**: `workspace_documents` (created via migration `20240711000003_storage.sql`)

**Policies**: Defined in migration (RLS on storage.objects)

**CDN**: Automatic via Supabase Storage

**Configuration**: No separate deployment — bucket exists in Supabase project

---

# 18. Background Workers

**Current**: Supabase Edge Functions (invoked via HTTP)

**Pattern**: 
- `process-document`: Triggered by `processing_jobs` insert (future: pg_cron or client call)
- `generate-knowledge`: Invoked from frontend via `supabase.functions.invoke()`
- `ai-gateway`: Invoked from frontend via `supabase.functions.invoke()`

**Future Dedicated Workers**:
- Separate service (Fly.io, Railway, Cloud Run)
- Queue: Redis + BullMQ or PostgreSQL-based
- Horizontal scaling via replica count

---

# 19. Scheduled Jobs

**Current**: None

**Future** (via `pg_cron` in Supabase or external scheduler):
- Credit expiration (monthly)
- Rate limit counter cleanup (hourly)
- Reservation expiration cleanup (hourly)
- Usage aggregation (daily)
- Subscription status sync (daily)
- Security event retention (weekly)

---

# 20. Monitoring

**Current**:
- Vercel Analytics (page views, Web Vitals)
- Supabase Dashboard (Database, API, Auth, Realtime, Storage, Functions)
- Console logs in Edge Functions (Supabase Logs)

**Future**:
- **Sentry**: Frontend + Edge Function errors
- **Better Stack**: Log aggregation + alerting
- **Vercel Speed Insights**: Real user monitoring
- **Custom Dashboards**: Credits consumption, AI usage, processing latency

---

# 21. Logging

**Frontend**: `console.log/error/warn` → Browser DevTools / Vercel Logs

**Edge Functions**: `console.log/error` → Supabase Function Logs

**Database**: 
- `processing_logs` (per-job debug)
- `security_events` (abuse detection)
- `credit_ledger` (immutable audit)
- `usage_jobs` (AI metering)

**Structured Logging** (Future):
```typescript
console.log(JSON.stringify({
  level: 'info',
  timestamp: new Date().toISOString(),
  jobId,
  stage: 'ocr',
  message: 'Page processed',
  metadata: { pageIndex, durationMs }
}))
```

---

# 22. Alerts

**Current**: None configured

**Planned**:
| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| High Error Rate | Edge Function 5xx > 5% in 5m | Critical | PagerDuty/Slack |
| Credit Anomaly | Workspace consumption > 2x average | Warning | Slack |
| Rate Limit Spike | 429 responses > 10% of requests | Warning | Slack |
| Prompt Injection | `security_events` severity HIGH | Critical | PagerDuty |
| Stripe Webhook Fail | `payment_events` status != processed | Critical | PagerDuty |
| DB Connection Pool | > 80% utilized | Warning | Slack |
| Storage Quota | > 90% used | Warning | Slack |

---

# 23. Rollbacks

**Frontend (Vercel)**:
```bash
# Via CLI
vercel rollback <deployment-url>

# Via Dashboard
# Deployments → ... → Promote to Production (previous)
```

**Edge Functions (Supabase)**:
```bash
# Redeploy previous version from Git
git checkout <previous-tag>
supabase functions deploy --project-ref <ref>
```

**Database**: Manual SQL (no automated rollback)
- Maintain down migration scripts for critical changes
- Test rollback on staging first

---

# 24. Backups

**Database**: Supabase automated (daily, 7-day PITR)

**Storage**: Supabase Storage (versioned, cross-region)

**Code**: Git (GitHub) — full history

**Configuration**: 
- Vercel: Project settings in Git (vercel.json)
- Supabase: Migrations in Git, secrets in Dashboard

**Recovery Drill**: Quarterly (future)

---

# 25. Release Process

1. **Feature Complete**: All PRs merged to `main`
2. **Version Bump**: `pnpm version patch|minor|major` (updates package.json, creates tag)
3. **Changelog**: Update `CHANGELOG.md` with release notes
4. **Tag**: `git push origin v<version>`
5. **Deploy**: 
   - Vercel auto-deploys tag to Production
   - `supabase functions deploy --project-ref <prod>`
   - `supabase db push --project-ref <prod>`
6. **Verify**: Smoke tests on production URL
7. **Announce**: Release notes, Discord/Twitter

---

# 26. Versioning

**Semantic Versioning**: MAJOR.MINOR.PATCH

| Version | When |
|---------|------|
| PATCH | Bug fixes, small improvements, docs |
| MINOR | New features, backwards compatible |
| MAJOR | Breaking changes, architecture redesign |

**Current**: `1.0.0` (Phase 11 Release Candidate)

**Tags**: `v1.0.0`, `v1.0.1`, etc.

---

# 27. Health Checks

**Frontend**: Vercel automatically checks `index.html` loads

**Edge Functions**: 
```bash
curl -X OPTIONS https://<ref>.supabase.co/functions/v1/ai-gateway
# Returns 200 OK
```

**Database**: Supabase health endpoint

**Future**: `/api/health` endpoint returning:
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "storage": "ok",
    "ai_gateway": "ok",
    "stripe": "ok"
  },
  "version": "1.0.0"
}
```

---

# 28. Disaster Recovery

**RPO**: 24 hours (daily DB backup)

**RTO**: 2 hours (restore + redeploy)

**Procedure**:
1. Provision new Supabase project (or restore existing)
2. `supabase db restore --backup-id <id> --project-ref <new-ref>`
3. `supabase functions deploy --project-ref <new-ref>`
4. `vercel --prod --scope <org> --token <token>` (redeploy frontend)
5. Update DNS if project ref changed
6. Verify Stripe webhooks point to new URL
7. Test critical flows

**Future**: Multi-region (Supabase Read Replicas + Vercel Edge)

---

# 29. Scaling Strategy

| Component | Scaling Mechanism |
|-----------|-------------------|
| Frontend (Vercel) | Automatic (static + ISR) |
| Edge Functions | Automatic (Supabase/Edge Runtime) |
| Database (PostgreSQL) | Vertical (Supabase plan) → Read Replicas |
| Storage | Automatic (S3-compatible) |
| Realtime | Horizontal (Supabase manages) |
| AI Providers | Provider-side (Gemini quotas) |

**Bottlenecks to Watch**:
- Database connections (PgBouncer pool size)
- Edge Function cold starts (mitigated by steady traffic)
- AI provider rate limits (Gemini: 60 RPM Flash, 30 RPM Pro)

---

# 30. Future Infrastructure

- **Multi-region**: Supabase Read Replicas + Vercel Edge Middleware
- **CDN Optimization**: Custom Cache-Control for PDF assets
- **Enterprise Deployments**: Dedicated Supabase cluster, VPC peering
- **Dedicated Workers**: Fly.io / Cloud Run for heavy processing (OCR, podcast)
- **Global Scaling**: Edge Function deployment to multiple regions
- **Hybrid**: On-premises data residency option