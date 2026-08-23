# Lumena Workspace

Security Specification

Version: 1.0

Status: Implemented

Last Updated: 2026-07-27

---

# Table of Contents

1. Security Philosophy
2. Security Goals
3. Threat Model
4. Zero Trust Architecture
5. Authentication Security
6. Authorization
7. Session Security
8. Password Policy
9. OAuth Security
10. API Security
11. AI Security
12. Prompt Injection
13. Document Security
14. PDF Security
15. File Upload Validation
16. Malware Protection
17. Storage Security
18. Secrets Management
19. Encryption
20. Credit System Security
21. Payment Security
22. Webhook Security
23. Rate Limiting
24. Abuse Prevention
25. Bot Protection
26. Input Validation
27. Output Sanitization
28. XSS Protection
29. CSRF Protection
30. SSRF Protection
31. SQL Injection Prevention
32. CSP & Security Headers
33. Logging & Audit Trails
34. Monitoring & Alerts
35. Privacy
36. Incident Response
37. Backup Strategy
38. Disaster Recovery
39. Compliance
40. Future Security Improvements

---

# 1. Security Philosophy

Security is a fundamental architectural principle, not an afterthought.

**Core Tenets**:
- **Zero Trust**: Never trust, always verify (every request, every layer)
- **Defense in Depth**: Multiple overlapping security controls
- **Least Privilege**: Minimum permissions required for function
- **Immutable Audit Trail**: Financial operations logged permanently
- **Secrets Never Leave Backend**: API keys only in Edge Function environment

---

# 2. Security Goals

- Protect user data confidentiality and integrity
- Prevent unauthorized access to workspaces and documents
- Ensure billing/credit system cannot be manipulated
- Detect and prevent abuse (prompt injection, rate limit evasion)
- Maintain compliance readiness (GDPR, CCPA)
- Enable rapid incident detection and response

---

# 3. Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Unauthorized workspace access | Medium | High | RLS + workspace membership checks |
| Credit manipulation | Low | Critical | Ledger + service_role only writes |
| Prompt injection | Medium | High | Regex detection in AI Gateway |
| Rate limit evasion | Medium | Medium | Server-side counters + circuit breaker |
| File upload attacks | Medium | High | Type/size validation + storage RLS |
| API key exposure | Low | Critical | Keys only in Deno.env (Edge Functions) |
| XSS via AI output | Low | Medium | Sanitization + React auto-escape |
| Data leakage | Low | High | RLS + signed URLs (1hr TTL) |

---

# 4. Zero Trust Architecture

**Principles Applied**:

1. **Verify Every Request**: All Edge Functions validate `Authorization` header
2. **Never Trust Frontend**: Authorization decisions made in Edge Functions/DB
3. **Micro-segmentation**: Workspace isolation via RLS policies
4. **Continuous Monitoring**: `security_events` table logs anomalies
5. **Encryption Everywhere**: TLS in transit, Supabase encryption at rest

**Network**:
- Frontend (Vercel) → Supabase (HTTPS only)
- Edge Functions → PostgreSQL (internal Supabase network)
- Edge Functions → External APIs (Gemini, Stripe) via HTTPS
- No direct database access from frontend (RLS enforced)

---

# 5. Authentication Security

**Provider**: Supabase Auth (battle-tested, SOC2 compliant)

**Methods**:
- **Email/Password**: bcrypt hashing (handled by Supabase)
- **Google OAuth**: PKCE flow, state parameter
- **GitHub OAuth**: PKCE flow, state parameter
- **Magic Links**: Time-limited, single-use tokens

**Session Management**:
- Access tokens: JWT (1hr expiry)
- Refresh tokens: Rotating, stored securely
- `onAuthStateChange` listener auto-restores session
- `LoadingPage` shown during session verification

**Protected Routes**: `ProtectedRoute` component checks `userStore.user` + `loading` state

---

# 6. Authorization

**Database Level (Primary)**:
- All user tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- Policies use `get_user_workspace_ids()` → returns workspace UUIDs for current user
- Pattern: `USING (workspace_id IN (SELECT get_user_workspace_ids()))`

**Edge Function Level**:
- `ai-gateway`: Verifies workspace membership, plan, credit quota
- `generate-knowledge`: Verifies membership + document access + credits
- `process-document`: Verifies credit reservation + workspace access
- `create-checkout-session`: Verifies membership
- `stripe-webhook`: Runs as `service_role` (bypasses RLS for financial writes)

**Frontend**: NEVER makes authorization decisions. UI shows/hides based on data, but enforcement is server-side.

---

# 7. Session Security

- **JWT Validation**: Supabase verifies signature, expiry, audience
- **Token Storage**: In-memory (Zustand) + localStorage (refresh token)
- **Auto-refresh**: Supabase client handles transparently
- **Logout**: `AuthRepository.signOut()` revokes tokens
- **Concurrent Sessions**: Supported (Supabase default)

---

# 8. Password Policy

**Delegated to Supabase Auth**:
- Minimum 8 characters (configurable)
- bcrypt with cost factor 10+
- Breached password detection (HaveIBeenPwned integration)
- Rate limited login attempts

**Frontend**: No password rules enforced (Supabase returns errors)

---

# 9. OAuth Security

**Google/GitHub OAuth**:
- PKCE (Proof Key for Code Exchange) enforced
- `state` parameter prevents CSRF
- Redirect URLs validated against allowlist (Supabase dashboard)
- Scopes: `openid email profile` (minimal)

---

# 10. API Security

**No Public REST API** — all access via Supabase Client + Edge Functions

**Edge Function Security**:
```typescript
// Every function starts with:
const authHeader = req.headers.get('Authorization')
if (!authHeader) return 401
const token = authHeader.replace('Bearer ', '')
const { data: { user }, error } = await supabase.auth.getUser(token)
if (error || !user) return 401
```

**Database Access**:
- Frontend: `anon` key (RLS enforced)
- Edge Functions: `service_role` key (bypasses RLS for writes)

---

# 11. AI Security

**Provider Abstraction**: All AI calls via `AIGateway` → `ai-gateway` Edge Function

**Keys**: `GEMINI_API_KEY` only in `Deno.env` (Edge Function environment)

**Frontend**: Never sees API keys, never calls providers directly

**Model Access Control**: Enforced in `ai-gateway` (Free: Flash only; Pro: Flash+Pro)

---

# 12. Prompt Injection

**Detection** (in `ai-gateway` Edge Function):
```typescript
const injectionRegex = /(ignore\s+(all\s+)?(previous\s+)?instructions|system\s+prompt|system\s+override|forget\s+(all\s+)?previous)/i;
if (injectionRegex.test(prompt)) {
  // Log to security_events
  await supabase.from('security_events').insert({
    workspace_id, user_id: user.id,
    event_type: 'prompt_injection', severity: 'HIGH',
    signal: prompt.substring(0, 200), metadata: { action_type }
  })
  return 400 // Blocked
}
```

**Logged**: `security_events` table with severity HIGH

**Future**: ML-based detection, allowlist/blocklist

---

# 13. Document Security

**Upload Validation** (`document.repository.ts`):
```typescript
if (file.type !== 'application/pdf') throw 'Invalid file type'
if (file.size > 50 * 1024 * 1024) throw 'File too large'
```

**Storage**: Private bucket `workspace_documents` with RLS policies

**Access**: Signed URLs (1hr TTL) generated on-demand

**Processing**: `process-document` Edge Function runs with `service_role`, validates workspace ownership

**Encryption**: Supabase Storage encrypts at rest (AES-256)

---

# 14. PDF Security

**Rendering**: `react-pdf` (PDF.js) in sandboxed iframe context

**No Execution**: PDF.js does not execute JavaScript/embedded code

**Password-Protected PDFs**: Detected in `InspectionStage` → returns `isEncrypted: true` → UI shows error

**Max Pages**: No hard limit (virtualization handles 300+), but processing has credit cost

---

# 15. File Upload Validation

| Check | Implementation |
|-------|----------------|
| MIME Type | `file.type === 'application/pdf'` |
| Size | `file.size <= 50 * 1024 * 1024` (50MB) |
| Extension | `.pdf` (enforced by accept attribute) |
| Storage RLS | Workspace-scoped policies on bucket |

**Future**: Virus scanning (ClamAV), PDF structure validation

---

# 16. Malware Protection

**Current**: File type + size validation only

**Planned**:
- ClamAV scanning in `process-document` Edge Function
- PDF parser hardening (PDF.js config)
- Content-type sniffing prevention

---

# 17. Storage Security

**Bucket**: `workspace_documents` (private)

**RLS Policies**:
- SELECT: `workspace_id IN (SELECT get_user_workspace_ids())`
- INSERT: Same + file path must start with `workspace_id/`
- DELETE: Same

**Access Pattern**:
1. Frontend requests signed URL via `DocumentRepository.getSignedUrl()`
2. Edge Function verifies workspace membership
3. Returns 1-hour signed URL
4. Frontend uses URL directly with `react-pdf`

**No Public URLs**: All files private by default

---

# 18. Secrets Management

| Secret | Location | Access |
|--------|----------|--------|
| `GEMINI_API_KEY` | Deno.env (Edge Functions) | `ai-gateway`, `generate-knowledge` |
| `STRIPE_SECRET_KEY` | Deno.env | `create-checkout-session`, `stripe-webhook` |
| `SUPABASE_SERVICE_ROLE_KEY` | Deno.env | All Edge Functions |
| `SUPABASE_URL` | Deno.env + Vite env | All |
| `VITE_SUPABASE_ANON_KEY` | Vite env (public) | Frontend only |

**Rotation**: Manual via Supabase Dashboard → Edge Function Settings

**No Secrets in Code**: `.env` only for local development (Vite vars)

---

# 19. Encryption

## At Rest
- **Database**: Supabase Managed PostgreSQL (AES-256, cloud provider managed)
- **Storage**: Supabase Storage (AES-256, S3-compatible)
- **Edge Function Memory**: Ephemeral, cleared after invocation

## In Transit
- **All External**: TLS 1.2+ (HTTPS)
- **Frontend → Supabase**: HTTPS (Vercel → Supabase)
- **Edge Functions → APIs**: HTTPS (Gemini, Stripe)
- **Realtime**: WSS (WebSocket Secure)

## Key Rotation
- **Database**: Managed by Supabase (cloud provider KMS)
- **Storage**: Managed by Supabase
- **Application Secrets**: Manual rotation via Dashboard

---

# 20. Credit System Security

**Ledger Architecture** (Immutable):
- `credit_ledger`: Append-only, never UPDATE/DELETE
- `direction`: +1 (grant) or -1 (consume/reserve/release/expire)
- `entry_type`: Enum with 11 values for audit clarity
- `idempotency_key`: Prevents duplicate processing

**Reservations**:
- `credit_reservations`: `expires_at` prevents stuck reservations
- Settlement: `reserved → consumed` with actual cost
- Release: `reserved → available` on failure/timeout

**Frontend Cannot Consume**:
```typescript
// billing.repository.ts - throws if called
async consumeCredits() {
  throw new Error('Direct credit consumption not allowed. Credits consumed via backend services.')
}
```

**All Consumption in Edge Functions**:
- `ai-gateway`: Reserve → Generate → Settle
- `process-document`: Reserve → Process → Settle
- `generate-knowledge`: Direct consume (fixed cost: 10 credits)

---

# 21. Payment Security

**Stripe Integration**:
- Checkout Session created server-side (`create-checkout-session`)
- `client_reference_id = workspace_id` for reconciliation
- Metadata: workspace_id, user_id, package_id, credits
- Webhook validates Stripe signature (future: implement)

**PCI Compliance**: Stripe Checkout handles card data — Lumena never touches PAN

**Idempotency**: `payment_events.external_event_id` UNIQUE prevents duplicate processing

---

# 22. Webhook Security

**Stripe Webhook** (`stripe-webhook`):
```typescript
// Future: implement signature verification
const signature = req.headers.get('stripe-signature')
// const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
```

**Current**: Parses JSON, logs event type (development mode)

**Production Requirements**:
- `STRIPE_WEBHOOK_SECRET` in Deno.env
- Signature verification before processing
- Idempotency via `payment_events` table

---

# 23. Rate Limiting

**AI Gateway** (per workspace, per hour):
- Fixed window (hour boundary)
- Counter in `rate_limit_counters` table
- Limit: 50 actions/hour
- Returns 429 with `security_events` log (severity MEDIUM)

**Edge Function Invocation**: Supabase built-in limits

**Future**: Distributed rate limiting (Redis), per-user limits

---

# 24. Abuse Prevention

| Mechanism | Implementation |
|-----------|----------------|
| Prompt Injection | Regex detection in `ai-gateway` |
| Rate Limiting | 50 actions/hour/workspace |
| Circuit Breaker | 10,000 credits/day/workspace |
| Credit Quotas | Monthly (Free: 50, Pro: 1000) |
| File Validation | PDF only, ≤50MB |
| RLS | Workspace isolation |
| Service Role | Financial writes only in Edge Functions |

---

# 25. Bot Protection

**Current**: Rate limiting + credit quotas

**Future**:
- Cloudflare Turnstile / hCaptcha on auth pages
- Behavioral analysis (rapid requests, pattern detection)
- IP reputation checks

---

# 26. Input Validation

**Frontend**: TypeScript types + HTML5 validation (`required`, `type="email"`, `maxlength`)

**Edge Functions**: Manual validation
```typescript
if (!prompt || !workspace_id) return 400
if (!allowedModels.includes(model_code)) return 403
```

**Database**: CHECK constraints, NOT NULL, ENUMs, FK

---

# 27. Output Sanitization

**AI Output**: 
- `generate-knowledge`: Parsed as JSON, validated structure before DB insert
- Chat: Rendered as React text (auto-escaped), no `dangerouslySetInnerHTML`

**User Content**:
- Highlights: Stored as plain text, rendered as text
- Document names: Escaped in UI

**No `dangerouslySetInnerHTML`** used in codebase

---

# 28. XSS Protection

**React**: Automatic escaping of `{variable}` in JSX

**CSP** (via Vercel/Supabase headers):
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'` (Vite dev)
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' data: blob:`
- `connect-src 'self' https://*.supabase.co wss://*.supabase.co`

**Future**: Stricter CSP with nonces/hashes for production

---

# 29. CSRF Protection

**Not Applicable**: No cookie-based auth. JWT in Authorization header.

**OAuth**: `state` parameter prevents CSRF on redirect.

**Forms**: All mutations via Supabase Client (Bearer token) or Edge Functions (Bearer token).

---

# 30. SSRF Protection

**Edge Functions**: Only call allowlisted domains:
- `generativelanguage.googleapis.com` (Gemini)
- `api.stripe.com` (Stripe)
- Supabase internal endpoints

**No User-Supplied URLs** fetched by backend.

---

# 31. SQL Injection Prevention

**Supabase Client**: Parameterized queries (PostgREST)
```typescript
supabase.from('table').select().eq('col', userInput) // Safe
```

**Edge Functions**: Same — Supabase JS client uses parameterized queries

**No Raw SQL** executed with user input.

---

# 32. CSP & Security Headers

**Vercel (Frontend)**:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co;
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Supabase (Edge Functions)**: Inherits platform headers

---

# 33. Logging & Audit Trails

| Table | Purpose | Retention |
|-------|---------|-----------|
| `credit_ledger` | Immutable financial audit | Permanent |
| `usage_jobs` | AI metering (tokens, cost, model) | 2 years |
| `security_events` | Abuse detection (injection, rate limit, circuit breaker) | 1 year |
| `processing_logs` | Document processing debug | 90 days |
| `processing_events` | Job state transitions | 90 days |
| `payment_events` | Stripe webhook idempotency | Permanent |

**Log Format** (Edge Functions):
```typescript
console.log(`[Job ${jobId}] Stage: ${stage} - ${message}`)
console.error(`[AI Gateway] ${error.message}`, { workspaceId, userId })
```

---

# 34. Monitoring & Alerts

**Current**: Supabase Dashboard (Logs, Database, API, Realtime, Auth)

**Future Alerts**:
- Credit consumption spike (>50% of quota in 1 hour)
- Rate limit 429 rate > 10% of requests
- `security_events` severity HIGH/CRITICAL
- Edge Function error rate > 5%
- Processing job failure rate > 10%
- Stripe webhook failures

**Tools**: Sentry (errors), Better Stack (logs), Vercel Analytics (frontend)

---

# 35. Privacy

**Data Minimization**:
- Only store required data (no tracking pixels, no analytics scripts)
- User profiles: email, name, avatar (optional)
- Documents: user content only
- No telemetry without consent

**User Rights**:
- **Access**: Export all data (future: GDPR export endpoint)
- **Rectification**: Update profile/settings
- **Erasure**: Delete workspace → cascades all data
- **Portability**: JSON export (future)

**Data Processing Agreement**: Supabase DPA covers subprocessors

---

# 36. Incident Response

**Runbook** (Future):
1. **Detect**: Alert from monitoring
2. **Triage**: Severity (SEV-1: data breach, billing corruption; SEV-2: AI down, upload broken)
3. **Contain**: Disable Edge Function, revoke keys, enable maintenance mode
4. **Investigate**: Logs (Supabase, Vercel, Stripe)
5. **Remediate**: Deploy fix, rotate secrets, notify users
6. **Postmortem**: Write incident report, update runbook

**Contacts**: 
- Primary: Project owner
- Supabase Support: Dashboard → Support
- Stripe Support: Dashboard → Support

---

# 37. Backup Strategy

**Database**: Supabase automated backups (daily, point-in-time recovery 7 days)

**Storage**: Supabase Storage (versioned, cross-region replication)

**Edge Functions**: Version controlled in Git (deployed via CLI)

**Configuration**: `.env` secrets in Supabase Dashboard + Vercel

**Recovery Testing**: Quarterly restore drill (future)

---

# 38. Disaster Recovery

**RPO** (Recovery Point Objective): 24 hours (daily DB backup)

**RTO** (Recovery Time Objective): 2 hours (Supabase restore + Vercel redeploy)

**Procedure**:
1. Restore PostgreSQL from latest backup
2. Redeploy Edge Functions from Git
3. Redeploy Frontend from Git (Vercel)
4. Verify Stripe webhooks
5. Test critical paths (auth, upload, chat, billing)

**Future**: Multi-region failover (Supabase Read Replicas + Vercel Edge)

---

# 39. Compliance

**GDPR** (EU):
- Lawful basis: Contract (service provision)
- Data minimization implemented
- Right to erasure: Workspace deletion
- DPA with Supabase (subprocessor)
- No international transfers outside EU (Supabase EU regions)

**CCPA** (California):
- No sale of personal information
- Right to know/access/delete
- Opt-out not applicable (no tracking)

**SOC2**: Supabase is SOC2 Type II certified

**Future**: HIPAA (BAA with Supabase), ISO 27001

---

# 40. Future Security Improvements

- **Enterprise SSO**: SAML 2.0, OIDC, SCIM provisioning
- **Hardware Keys**: WebAuthn / Passkeys for 2FA
- **Advanced Threat Detection**: ML-based anomaly detection on `security_events`
- **Security Dashboard**: Real-time view of rate limits, injections, credit anomalies
- **Continuous Security Audits**: Automated dependency scanning, SAST in CI/CD
- **Penetration Testing**: Annual third-party assessment
- **Bug Bounty**: HackerOne / Intigriti program
- **Encryption Key Management**: Customer-managed keys (BYOK)
- **Data Loss Prevention**: Content scanning on upload
- **Audit Log Export**: SIEM integration (Splunk, Datadog)