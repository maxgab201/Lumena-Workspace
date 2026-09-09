# Lumena Workspace

Database Specification

Version: 1.0

Status: Implemented (Migrations 000000-000018)

Last Updated: 2026-07-26

---

# Table of Contents

1. Database Philosophy
2. Database Goals
3. Design Principles
4. Database Engine
5. Core Entities
6. Entity Relationships
7. User Model
8. Workspace Model
9. Documents
10. Pages
11. OCR Data
12. Highlights
13. Chats
14. AI Messages
15. Credits Ledger
16. Subscriptions
17. Payments
18. Settings
19. Notifications
20. Audit Logs
21. Permissions
22. Storage References
23. Indexing Strategy
24. Constraints
25. Data Retention
26. Soft Deletes
27. Migrations
28. Performance
29. Security
30. Future Entities

---

# 1. Database Philosophy

The database is the system of record for all structured data. It must be:

- **ACID compliant**: Financial data (credits, billing) requires strong consistency
- **Secure by default**: Row Level Security (RLS) on all user-facing tables
- **Auditable**: Immutable ledger for credits, audit logs for sensitive operations
- **Scalable**: PostgreSQL with proper indexing, partitioning strategy for future growth

---

# 2. Database Goals

- Store only structured information (no blobs, no provider secrets)
- Enforce authorization at the database layer (RLS)
- Support multi-tenancy via workspaces
- Enable real-time subscriptions for UI updates
- Provide immutable audit trail for financial operations

---

# 3. Design Principles

- **Normalize for integrity, denormalize for reads**: Use views/materialized views for complex queries
- **UUID primary keys**: All entities use `gen_random_uuid()`
- **Timestamps**: `created_at`, `updated_at` on all mutable tables
- **Enums over strings**: Status, type, role fields use PostgreSQL enums
- **Foreign keys**: Enforce referential integrity with `ON DELETE CASCADE` where appropriate
- **JSONB for flexible data**: Overlays, provider metadata, slides use JSONB

---

# 4. Database Engine

**Primary**: PostgreSQL 15+ (via Supabase)

**Provider**: Supabase (Managed PostgreSQL)

**Extensions used**:
- `uuid-ossp` / `pgcrypto` for `gen_random_uuid()`
- `pg_trgm` for future text search
- `btree_gin` for composite indexes

---

# 5. Core Entities

| Entity | Table | Description |
|--------|-------|-------------|
| Users | `profiles` | Extended user info (name, avatar) |
| Workspaces | `workspaces` | Top-level knowledge containers |
| Memberships | `workspace_members` | User-Workspace-Role mapping |
| Documents | `documents` | PDF files with metadata |
| Processing Jobs | `processing_jobs` | Async document processing |
| Pages | *(in-memory)* | Page-level processing state |
| Highlights | `highlights`, `highlight_categories` | User/AI text highlights |
| Chat | `chat_sessions`, `chat_messages` | Per-document conversations |
| Knowledge | `flashcards`, `glossary_terms`, `mind_map_nodes`, `timeline_events`, `presentations` | AI-generated study tools |
| Credits | `credit_accounts`, `credit_buckets`, `credit_ledger`, `credit_reservations` | Ledger-based credit system |
| Billing | `plans`, `plan_prices`, `subscriptions`, `billing_customers`, `credit_packages`, `purchases`, `payment_events` | Subscription & purchase tracking |
| AI Providers | `providers`, `provider_models`, `provider_pricing`, `usage_jobs` | Provider abstraction & metering |
| Security | `rate_limit_counters`, `security_events` | Abuse prevention |
| Settings | `user_settings` | Per-user preferences |

---

# 6. Entity Relationships

```
users (auth.users)
  │
  ├─► profiles (1:1)
  │
  ├─► workspace_members (1:N)
  │       │
  │       └─► workspaces (N:1)
  │                 │
  │                 ├─► documents (1:N)
  │                 │       │
  │                 │       ├─► processing_jobs (1:N)
  │                 │       ├─► highlights (1:N)
  │                 │       ├─► flashcards (1:N)
  │                 │       ├─► glossary_terms (1:N)
  │                 │       ├─► mind_map_nodes (1:N, self-ref)
  │                 │       ├─► timeline_events (1:N)
  │                 │       ├─► presentations (1:N)
  │                 │       └─► chat_sessions (1:N)
  │                 │                      │
  │                 │                      └─► chat_messages (1:N)
  │                 │
  │                 ├─► credit_accounts (1:1)
  │                 │       │
  │                 │       ├─► credit_buckets (1:N)
  │                 │       ├─► credit_ledger (1:N)
  │                 │       └─► credit_reservations (1:N)
  │                 │
  │                 ├─► subscriptions (1:N)
  │                 ├─► billing_customers (1:1)
  │                 ├─► purchases (1:N)
  │                 └─► highlight_categories (1:N)
  │
  └─► user_settings (1:1)
```

---

# 7. User Model

## `profiles`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, FK → auth.users(id) |
| `email` | TEXT | NOT NULL |
| `name` | TEXT | NULLABLE |
| `avatar_url` | TEXT | NULLABLE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Trigger**: `on_auth_user_created` → inserts profile + creates default workspace

---

# 8. Workspace Model

## `workspaces`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() |
| `name` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

## `workspace_members`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → workspaces(id) CASCADE |
| `user_id` | UUID | FK → auth.users(id) |
| `role` | workspace_role | NOT NULL DEFAULT 'member' |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Unique**: `(workspace_id, user_id)`

**Enum `workspace_role`**: `owner` | `member` | `viewer`

---

# 9. Documents

## `documents`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → workspaces(id) CASCADE |
| `name` | TEXT | NOT NULL |
| `file_path` | TEXT | NOT NULL (Storage path) |
| `size_bytes` | BIGINT | NOT NULL |
| `mime_type` | TEXT | NULLABLE |
| `page_count` | INTEGER | NULLABLE |
| `status` | document_status | DEFAULT 'uploading' |
| `file_hash` | TEXT | NULLABLE (for dedup) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Enum `document_status`**: `uploading` | `processing` | `ready` | `error`

**Indexes**: `(workspace_id)`, `(workspace_id, created_at DESC)`

---

# 10. Pages

Pages are **not stored as rows** in the current implementation. Page-level state lives in the **in-memory `pageRegistryStore`** (Zustand) for performance.

**Future table**: `page_registry`

| Column | Type |
|--------|------|
| `id` | UUID PK |
| `document_id` | UUID FK |
| `page_index` | INTEGER (0-based) |
| `printed_page_number` | TEXT |
| `layout_status` | ENUM |
| `layout_data` | JSONB |
| `ocr_status` | ENUM |
| `ocr_data` | JSONB |
| `ai_status` | ENUM |
| `vision_data` | JSONB |
| `highlight_status` | ENUM |
| `annotation_status` | ENUM |

---

# 11. OCR Data

OCR results are stored in the in-memory page registry during processing. For persistence, a future `ocr_results` table would store:

| Column | Type |
|--------|------|
| `id` | UUID PK |
| `document_id` | UUID FK |
| `page_index` | INTEGER |
| `text` | TEXT |
| `blocks` | JSONB (OCRBlock[]) |
| `confidence` | REAL |
| `provider_id` | TEXT |
| `created_at` | TIMESTAMPTZ |

---

# 12. Highlights

## `highlight_categories`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → workspaces(id) CASCADE |
| `name` | TEXT | NOT NULL |
| `color` | TEXT | NOT NULL (hex) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

## `highlights`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `document_id` | UUID | FK → documents(id) CASCADE |
| `workspace_id` | UUID | FK → workspaces(id) CASCADE |
| `page_index` | INTEGER | NOT NULL |
| `rects` | JSONB | NOT NULL (NormalizedRect[]) |
| `text` | TEXT | NOT NULL |
| `color` | TEXT | NOT NULL |
| `category_id` | UUID | FK → highlight_categories(id) NULL |
| `note` | TEXT | NULLABLE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Indexes**: `(document_id)`, `(document_id, page_index)`, `(workspace_id)`

**RLS**: Workspace-scoped via `get_user_workspace_ids()`

---

# 13. Chats

## `chat_sessions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `document_id` | UUID | FK → documents(id) CASCADE |
| `workspace_id` | UUID | FK → workspaces(id) CASCADE |
| `user_id` | UUID | FK → auth.users(id) |
| `title` | TEXT | NULLABLE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Unique**: `(document_id, user_id)` — one session per user per document

## `chat_messages`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `session_id` | UUID | FK → chat_sessions(id) CASCADE |
| `role` | chat_role | NOT NULL |
| `content` | TEXT | NOT NULL |
| `message_references` | JSONB | NULLABLE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Enum `chat_role`**: `user` | `assistant` | `system`

**Indexes**: `(session_id, created_at)`

---

# 14. AI Messages

See `chat_messages` above. Future: `ai_analysis` table for document-level analysis (summaries, extractions).

---

# 15. Credits Ledger

## `credit_accounts`

| Column | Type | Constraints |
|--------|------|-------------|
| `workspace_id` | UUID | PK, FK → workspaces(id) CASCADE |
| `available` | INTEGER | DEFAULT 0 |
| `reserved` | INTEGER | DEFAULT 0 |
| `consumed` | INTEGER | DEFAULT 0 |
| `expired` | INTEGER | DEFAULT 0 |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Trigger**: `on_workspace_created_create_account` AFTER INSERT on `workspaces`

## `credit_buckets`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → workspaces(id) CASCADE |
| `source_type` | TEXT | NOT NULL ('subscription', 'purchase') |
| `original_amount` | INTEGER | NOT NULL |
| `remaining_amount` | INTEGER | NOT NULL |
| `expires_at` | TIMESTAMPTZ | NULLABLE |
| `priority` | INTEGER | DEFAULT 100 (lower = higher priority) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

## `credit_ledger` (Immutable)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → workspaces(id) CASCADE |
| `bucket_id` | UUID | FK → credit_buckets(id) SET NULL |
| `entry_type` | ledger_entry_type | NOT NULL |
| `amount` | INTEGER | NOT NULL |
| `direction` | INTEGER | CHECK (direction IN (1, -1)) |
| `reservation_id` | UUID | FK → credit_reservations(id) SET NULL |
| `job_id` | UUID | FK → processing_jobs(id) SET NULL |
| `idempotency_key` | TEXT | UNIQUE NULLABLE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Enum `ledger_entry_type`**:
`grant_plan` | `grant_purchase` | `grant_promotion` | `reserve` | `release` | `consume` | `refund` | `expire` | `chargeback_hold` | `chargeback_reversal` | `manual_adjustment`

**RLS**: Only `service_role` can INSERT/UPDATE/DELETE. Users can SELECT via workspace membership.

## `credit_reservations`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → workspaces(id) CASCADE |
| `job_id` | UUID | FK → processing_jobs(id) SET NULL |
| `requested_amount` | INTEGER | NOT NULL |
| `reserved_amount` | INTEGER | NOT NULL |
| `settled_amount` | INTEGER | DEFAULT 0 |
| `status` | reservation_status | DEFAULT 'pending' |
| `expires_at` | TIMESTAMPTZ | NOT NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Enum `reservation_status`**:
`pending` | `confirmed` | `partially_settled` | `released` | `expired` | `cancelled` | `failed`

---

# 16. Subscriptions

## `plans`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `code` | TEXT | UNIQUE NOT NULL ('free', 'go', 'pro', 'max') |
| `display_name` | TEXT | NOT NULL |
| `is_public` | BOOLEAN | DEFAULT true |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

## `plan_prices`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `plan_id` | UUID | FK → plans(id) CASCADE |
| `external_price_id` | TEXT | NULLABLE (Stripe Price ID) |
| `billing_interval` | TEXT | CHECK ('month', 'year', 'one_time') |
| `currency` | TEXT | DEFAULT 'usd' |
| `amount` | INTEGER | NOT NULL (cents) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

## `subscriptions`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → workspaces(id) CASCADE |
| `provider` | TEXT | DEFAULT 'stripe' |
| `external_subscription_id` | TEXT | UNIQUE NOT NULL |
| `plan_id` | UUID | FK → plans(id) SET NULL |
| `status` | subscription_status | DEFAULT 'incomplete' |
| `current_period_start` | TIMESTAMPTZ | NULLABLE |
| `current_period_end` | TIMESTAMPTZ | NULLABLE |
| `cancel_at_period_end` | BOOLEAN | DEFAULT FALSE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

**Enum `subscription_status`**:
`trialing` | `active` | `past_due` | `canceled` | `unpaid` | `incomplete` | `incomplete_expired` | `paused`

## `billing_customers`

| Column | Type | Constraints |
|--------|------|-------------|
| `workspace_id` | UUID | PK, FK → workspaces(id) CASCADE |
| `provider` | TEXT | DEFAULT 'stripe' |
| `external_customer_id` | TEXT | UNIQUE NOT NULL |
| `billing_email` | TEXT | NULLABLE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

---

# 17. Payments

## `credit_packages`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | NULLABLE |
| `credits` | INTEGER | NOT NULL |
| `price_usd` | NUMERIC | NOT NULL (dollars) |
| `stripe_price_id` | TEXT | NULLABLE |
| `is_active` | BOOLEAN | DEFAULT true |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

## `purchases`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → workspaces(id) CASCADE |
| `user_id` | UUID | FK → auth.users(id) NULLABLE |
| `package_id` | UUID | FK → credit_packages(id) NULLABLE |
| `stripe_session_id` | TEXT | NULLABLE |
| `amount_usd` | NUMERIC | NOT NULL |
| `credits_granted` | INTEGER | NOT NULL |
| `status` | TEXT | DEFAULT 'pending' |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `completed_at` | TIMESTAMPTZ | NULLABLE |

## `payment_events`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `provider` | TEXT | DEFAULT 'stripe' |
| `external_event_id` | TEXT | UNIQUE NOT NULL |
| `event_type` | TEXT | NOT NULL |
| `processed_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `status` | TEXT | DEFAULT 'processed' |

---

# 18. Settings

## `user_settings`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, FK → auth.users(id) |
| `theme` | TEXT | DEFAULT 'system' ('light', 'dark', 'system') |
| `view_mode` | TEXT | DEFAULT 'grid' |
| `sort_by` | TEXT | DEFAULT 'date' |
| `sort_order` | TEXT | DEFAULT 'desc' |
| `sidebar_collapsed` | BOOLEAN | DEFAULT FALSE |
| `dashboard_view_mode` | TEXT | DEFAULT 'grid' (legacy) |
| `dashboard_sort_by` | TEXT | DEFAULT 'date' (legacy) |
| `dashboard_sort_order` | TEXT | DEFAULT 'desc' (legacy) |
| `lang` | TEXT | DEFAULT 'en' |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

---

# 19. Notifications

**Not yet implemented.** Future table:

| Column | Type |
|--------|------|
| `id` | UUID PK |
| `user_id` | UUID FK |
| `workspace_id` | UUID FK |
| `type` | TEXT (info, success, warning, error) |
| `title` | TEXT |
| `message` | TEXT |
| `read` | BOOLEAN DEFAULT FALSE |
| `action_url` | TEXT |
| `created_at` | TIMESTAMPTZ |

---

# 20. Audit Logs

## `security_events`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → workspaces(id) NULLABLE |
| `user_id` | UUID | FK → auth.users(id) NULLABLE |
| `event_type` | TEXT | NOT NULL ('prompt_injection', 'rate_limit', 'circuit_breaker', 'unauthorized_access') |
| `severity` | TEXT | NOT NULL ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') |
| `signal` | TEXT | NULLABLE (snippet for audit) |
| `metadata` | JSONB | NULLABLE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

## `processing_logs`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `job_id` | UUID | FK → processing_jobs(id) CASCADE |
| `log_level` | TEXT | NOT NULL ('info', 'warn', 'error') |
| `message` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

## `processing_events`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK |
| `job_id` | UUID | FK → processing_jobs(id) CASCADE |
| `event_type` | TEXT | NOT NULL |
| `event_data` | JSONB | NULLABLE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

---

# 21. Permissions

All user-facing tables have RLS enabled with workspace-scoped policies.

**Helper Function**: `get_user_workspace_ids()` returns UUID[] of workspaces where user is a member.

**Policy Pattern**:
```sql
CREATE POLICY "Users can view X in their workspaces"
  ON public.X FOR SELECT
  USING (workspace_id IN (SELECT get_user_workspace_ids()));
```

**Exceptions**:
- `plans`, `plan_prices`, `providers`, `provider_models`: Public read (no RLS or `USING (true)`)
- `provider_pricing`: No user read access (internal only)
- Financial tables (`credit_accounts`, `credit_ledger`, etc.): Only `service_role` can write; users can read own workspace data

---

# 22. Storage References

Files stored in Supabase Storage bucket: `workspace_documents`

**Path pattern**: `{workspace_id}/{timestamp}_{random}.pdf`

**Document record**: `file_path` column stores this path.

**Signed URLs**: Generated on-demand via `DocumentRepository.getSignedUrl()` (1hr TTL).

**RLS on Storage**: Policies enforce workspace membership for SELECT/INSERT/DELETE.

---

# 23. Indexing Strategy

| Table | Indexes |
|-------|---------|
| `documents` | `(workspace_id, created_at DESC)`, `(workspace_id, status)` |
| `highlights` | `(document_id)`, `(document_id, page_index)`, `(workspace_id)` |
| `chat_sessions` | `(document_id, user_id)` UNIQUE, `(workspace_id)` |
| `chat_messages` | `(session_id, created_at)` |
| `flashcards` | `(document_id)` |
| `glossary_terms` | `(document_id)` |
| `mind_map_nodes` | `(document_id)`, `(parent_id)` |
| `timeline_events` | `(document_id)` |
| `presentations` | `(document_id)` |
| `credit_ledger` | `(workspace_id, created_at DESC)`, `(job_id)`, `(reservation_id)`, `(bucket_id)` |
| `credit_reservations` | `(workspace_id, expires_at)`, `(job_id)` |
| `usage_jobs` | `(workspace_id, started_at DESC)`, `(document_id)`, `(model_id)` |
| `processing_jobs` | `(workspace_id, created_at DESC)`, `(document_id)`, `(status)` |
| `processing_logs` | `(job_id, created_at)` |
| `security_events` | `(workspace_id, created_at DESC)`, `(user_id)` |
| `rate_limit_counters` | `(scope_type, scope_id, metric, window_start)` UNIQUE |

---

# 24. Constraints

- **PK**: All tables have UUID PK
- **FK**: All relationships enforced with `ON DELETE CASCADE` or `SET NULL`
- **UNIQUE**: 
  - `workspace_members(workspace_id, user_id)`
  - `chat_sessions(document_id, user_id)`
  - `credit_ledger(idempotency_key)` (when provided)
  - `rate_limit_counters(scope_type, scope_id, metric, window_start)`
  - `billing_customers(external_customer_id)`
  - `subscriptions(external_subscription_id)`
  - `payment_events(external_event_id)`
- **CHECK**:
  - `credit_ledger.direction IN (1, -1)`
  - `subscription_status` enum
  - `document_status` enum
  - `job_status` enum
  - `ledger_entry_type` enum
  - `reservation_status` enum
  - `workspace_role` enum
  - `chat_role` enum
  - `plan_type` enum
  - `transaction_type` enum

---

# 25. Data Retention

| Data Type | Retention |
|-----------|-----------|
| User profiles | Until account deletion |
| Workspaces | Until workspace deletion (cascades) |
| Documents | Until document deletion (cascades to highlights, knowledge, chat) |
| Credit ledger | Permanent (immutable audit trail) |
| Security events | 1 year (future: partition by month) |
| Processing logs | 90 days |
| Rate limit counters | Auto-expire (window_start + 1 hour) |
| Usage jobs | 2 years (for billing audit) |

---

# 26. Soft Deletes

**Not used.** Hard deletes with CASCADE are preferred for simplicity and GDPR compliance.

Workspace deletion → cascades to all child tables via FK.

Document deletion → cascades to highlights, knowledge, chat, processing_jobs.

---

# 27. Migrations

Located in: `supabase/migrations/`

Naming: `{YYYYMMDD}{sequence}_{description}.sql`

| Migration | Description |
|-----------|-------------|
| 20240711000000 | Initial schema (profiles, workspaces, workspace_members, documents, storage) |
| 20240711000001 | Workspace RLS policies |
| 20240711000002 | Documents table |
| 20240711000003 | Storage bucket policies |
| 20240711000004 | Processing jobs |
| 20240711000005 | User settings |
| 20240711000006 | Billing foundation |
| 20240711000007 | RLS fixes |
| 20240718000001 | Chat sessions & messages |
| 20240718000002 | Highlights & categories |
| 20240718000003 | Knowledge tables (flashcards, glossary, mind_maps, timeline) |
| 20240718000004 | Schema fixes |
| 20240718000005 | Processing pipeline tables |
| 20240719000001 | Monetization foundation (plans, credit_accounts, ledger, subscriptions) |
| 20240720000001 | Metering & providers (providers, models, pricing, usage_jobs) |
| 20240720000002 | Security tables (rate_limit_counters, security_events) |
| 20240720000003 | Billing & packages (credit_packages, purchases) |
| 20240721000001 | Presentations table |

---

# 28. Performance

- **Connection pooling**: Supabase PgBouncer (transaction mode)
- **Prepared statements**: All Supabase client queries use prepared statements
- **Read replicas**: Future (Supabase Read Replicas)
- **Partitioning**: Future for `credit_ledger`, `security_events`, `processing_logs` (by month)
- **Caching**: In-memory stores (`pageRegistryStore`, `knowledgeStore`) for hot data

---

# 29. Security

- **RLS on all user tables**: Enforced at PostgreSQL level
- **No secrets in DB**: API keys only in Edge Function environment (`Deno.env`)
- **Service role only for writes**: Financial tables only modifiable by Edge Functions
- **Input validation**: Edge Functions validate all inputs
- **Rate limiting**: Per-workspace, per-hour (50 actions)
- **Circuit breaker**: Daily credit cap (10,000)
- **Prompt injection detection**: Regex-based in AI Gateway
- **File upload validation**: Type (PDF), Size (≤50MB), Storage RLS

---

# 30. Future Entities

| Entity | Purpose |
|--------|---------|
| `organizations` | Multi-workspace billing & admin |
| `teams` | Group collaboration within workspace |
| `shared_workspaces` | Workspace-to-workspace sharing |
| `api_keys` | Public API access |
| `knowledge_graph_nodes` | Entity-relationship graph |
| `knowledge_graph_edges` | Graph connections |
| `embeddings` | Vector embeddings for RAG |
| `plugins` | Extension system |
| `agents` | Autonomous AI agents |
| `public_shares` | Read-only document sharing |
| `collaborative_editing` | Yjs/CRDT document state |