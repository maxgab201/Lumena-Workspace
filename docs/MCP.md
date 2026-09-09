# Lumena Workspace

MCP Integration Specification

Version: 1.0

Status: Implemented (Configuration Complete)

Last Updated: 2026-07-27

---

# Table of Contents

1. MCP Philosophy
2. MCP Goals
3. Supported MCP Servers
4. MCP Discovery
5. MCP Registration
6. MCP Configuration
7. MCP Permissions
8. GitHub MCP
9. Supabase MCP
10. Vercel MCP
11. Playwright MCP
12. OpenAI MCP
13. Future MCP Servers
14. Tool Selection Rules
15. Manual Fallback Rules
16. Security
17. Logging
18. Error Handling
19. Troubleshooting
20. Future Improvements

---

# 1. MCP Philosophy

**Model Context Protocol (MCP)** enables Claude Code to interact with external systems through standardized, secure interfaces. We treat MCP as a first-class capability — not an afterthought.

**Principles**:
- **Prefer MCP over manual**: If an MCP tool can safely perform a task, use it
- **Verify results**: Never assume execution succeeded — check output
- **Least privilege**: Grant minimum permissions needed per server
- **Audit trail**: All MCP actions logged for review

---

# 2. MCP Goals

- Automate repetitive DevOps tasks (deploy, migrate, configure)
- Enable self-service infrastructure management
- Reduce context-switching between CLI and code
- Provide consistent interfaces across providers
- Maintain security through granular permissions

---

# 3. Supported MCP Servers

| Server | Purpose | Status | Config Location |
|--------|---------|--------|-----------------|
| **GitHub** | Repos, PRs, Issues, Actions, Releases | ✅ Active | `.claude/mcp/github.json` |
| **Supabase** | DB, Migrations, Functions, Auth, Storage | ✅ Active | `.claude/mcp/supabase.json` |
| **Vercel** | Deployments, Preview, Domains, Env Vars | ✅ Active | `.claude/mcp/vercel.json` |
| **Playwright** | E2E testing, screenshots, performance | ✅ Active | `.claude/mcp/playwright.json` |
| **OpenAI** | Embeddings, fine-tuning, evaluation | ⏳ Planned | — |

---

# 4. MCP Discovery

**Auto-discovery** (on session start):
1. Read `.claude/mcp/*.json` configs
2. Validate server connectivity
3. Register available tools in agent context
4. Log discovered capabilities

**Manual Discovery**:
```bash
# List configured servers
ls .claude/mcp/

# Test server connection
claude mcp test github
claude mcp test supabase
```

---

# 5. MCP Registration

**Registration Flow** (per server):
```json
// .claude/mcp/github.json
{
  "name": "github",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
  },
  "permissions": ["repos:read", "issues:write", "actions:read"]
}
```

**Requirements**:
- Each server has dedicated config file
- Secrets referenced via `${ENV_VAR}` (resolved at runtime)
- Permissions explicitly declared (audit trail)
- Version pinned in `package.json` devDependencies

---

# 6. MCP Configuration

**Global Config**: `.claude/settings.json`
```json
{
  "mcp": {
    "servers": {
      "github": { "config": ".claude/mcp/github.json" },
      "supabase": { "config": ".claude/mcp/supabase.json" },
      "vercel": { "config": ".claude/mcp/vercel.json" },
      "playwright": { "config": ".claude/mcp/playwright.json" }
    },
    "defaultPermissions": "read",
    "requireApproval": ["write", "delete", "deploy"]
  }
}
```

**Environment Variables** (`.env.mcp`, gitignored):
```bash
GITHUB_TOKEN=ghp_xxx
SUPABASE_ACCESS_TOKEN=sbp_xxx
VERCEL_TOKEN=xxx
PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright
```

---

# 7. MCP Permissions

**Permission Levels**:
| Level | Actions | Approval |
|-------|---------|----------|
| `read` | List, get, search | Auto |
| `write` | Create, update | Prompt |
| `delete` | Remove, destroy | Prompt + confirm |
| `deploy` | Deploy, promote, rollback | Prompt + confirm |
| `admin` | Settings, secrets, users | Never auto |

**Per-Server Defaults**:
- GitHub: `read` (issues/PRs), `write` (comments), `deploy` (never)
- Supabase: `read` (DB, logs), `write` (migrations, functions), `deploy` (functions)
- Vercel: `read` (deployments, logs), `deploy` (preview only)
- Playwright: `read` (screenshots), `write` (test files)

---

# 8. GitHub MCP

**Server**: `@modelcontextprotocol/server-github`

**Capabilities**:
| Category | Tools |
|----------|-------|
| Repositories | `list_repos`, `get_repo`, `create_repo`, `fork_repo` |
| Branches | `list_branches`, `create_branch`, `delete_branch` |
| Commits | `list_commits`, `get_commit`, `create_commit` |
| Pull Requests | `list_prs`, `get_pr`, `create_pr`, `merge_pr`, `review_pr` |
| Issues | `list_issues`, `get_issue`, `create_issue`, `update_issue`, `close_issue` |
| Actions | `list_workflows`, `run_workflow`, `get_run_logs` |
| Releases | `list_releases`, `create_release`, `upload_asset` |

**Common Workflows**:
```bash
# Create PR for documentation updates
claude mcp github create_pr --title "docs: update API spec" --branch docs/api-update

# Trigger CI workflow
claude mcp github run_workflow --workflow ci.yml --ref main

# Get failing test logs
claude mcp github get_run_logs --run_id 12345 --filter failed
```

---

# 9. Supabase MCP

**Server**: `@supabase/mcp-server-supabase` (or custom)

**Capabilities**:
| Category | Tools |
|----------|-------|
| Projects | `list_projects`, `get_project`, `create_project` |
| Database | `run_sql`, `list_tables`, `get_table_schema`, `apply_migration` |
| Migrations | `list_migrations`, `create_migration`, `push_migrations` |
| Edge Functions | `list_functions`, `deploy_function`, `get_function_logs` |
| Auth | `list_users`, `get_user`, `update_user`, `delete_user` |
| Storage | `list_buckets`, `upload_file`, `download_file`, `create_signed_url` |
| Realtime | `list_channels`, `subscribe`, `broadcast` |
| Logs | `get_database_logs`, `get_function_logs`, `get_api_logs` |

**Common Workflows**:
```bash
# Apply migration to staging
claude mcp supabase push_migrations --project-ref nsjetmjtwbhellqasggw --env staging

# Deploy Edge Function
claude mcp supabase deploy_function --name ai-gateway --project-ref nsjetmjtwbhellqasggw

# Run SQL query
claude mcp supabase run_sql --project-ref nsjetmjtwbhellqasggw --sql "SELECT * FROM credit_ledger LIMIT 10"

# Get function logs
claude mcp supabase get_function_logs --name ai-gateway --project-ref nsjetmjtwbhellqasggw --tail 100
```

**Lumena-Specific**:
- Project: `nsjetmjtwbhellqasggw` (dev), separate for staging/prod
- Migrations: 18 files in `supabase/migrations/`
- Edge Functions: 5 functions in `supabase/functions/`
- Secrets: `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

# 10. Vercel MCP

**Server**: `@vercel/mcp-server-vercel`

**Capabilities**:
| Category | Tools |
|----------|-------|
| Projects | `list_projects`, `get_project`, `create_project` |
| Deployments | `list_deployments`, `get_deployment`, `create_deployment` |
| Preview | `promote_to_production`, `rollback_deployment` |
| Domains | `list_domains`, `add_domain`, `verify_domain` |
| Environment Variables | `list_env_vars`, `upsert_env_var`, `delete_env_var` |
| Logs | `get_deployment_logs`, `get_function_logs` |
| Analytics | `get_web_vitals`, `get_page_views` |

**Common Workflows**:
```bash
# Deploy preview
claude mcp vercel create_deployment --project lumena-workspace --branch feature/xyz

# Promote to production
claude mcp vercel promote_to_production --deployment-url https://lumena-git-xyz.vercel.app

# Set environment variable
claude mcp vercel upsert_env_var --project lumena-workspace --key VITE_SUPABASE_URL --value https://xxx.supabase.co --target production

# Get deployment logs
claude mcp vercel get_deployment_logs --deployment-id dpl_xxx
```

**Lumena-Specific**:
- Project: `lumena-workspace` (Vercel)
- Framework: Vite (static SPA)
- Build: `pnpm build` → `dist/`
- Preview: Auto on PR
- Production: On tag `v*`

---

# 11. Playwright MCP

**Server**: `@playwright/mcp-server-playwright`

**Capabilities**:
| Category | Tools |
|----------|-------|
| Navigation | `goto`, `go_back`, `go_forward`, `reload` |
| Interaction | `click`, `fill`, `select`, `hover`, `drag`, `type` |
| Testing | `assert_text`, `assert_visible`, `assert_title` |
| Screenshots | `screenshot`, `screenshot_element` |
| Console | `get_console_logs`, `wait_for_console` |
| Network | `get_network_logs`, `wait_for_request`, `wait_for_response` |
| Performance | `get_metrics`, `trace_start`, `trace_stop` |
| Accessibility | `get_axe_results`, `assert_accessible` |

**Common Workflows**:
```bash
# Run E2E test
claude mcp playwright run_test --test tests/auth.spec.ts --browser chromium

# Capture screenshot
claude mcp playwright screenshot --selector ".pdf-viewer" --path screenshot.png

# Check accessibility
claude mcp playwright get_axe_results --url https://staging.lumena.app

# Get performance metrics
claude mcp playwright get_metrics --url https://lumena.app/viewer/doc-123
```

**Lumena-Specific**:
- Test files: `tests/*.spec.ts` (future)
- Browsers: Chromium (Brave channel)
- Base URL: `http://localhost:5173` (dev), `https://staging.lumena.app`

---

# 12. OpenAI MCP

**Status**: Planned (not yet configured)

**Intended Capabilities**:
| Category | Tools |
|----------|-------|
| Embeddings | `create_embedding`, `batch_embeddings` |
| Fine-tuning | `create_fine_tune`, `list_fine_tunes`, `get_fine_tune` |
| Evaluation | `run_eval`, `get_eval_results` |
| Moderation | `moderate_content` |

**Use Cases**:
- Generate embeddings for RAG (future Knowledge Graph)
- Fine-tune custom models for domain tasks
- Evaluate AI output quality
- Content moderation for uploads

---

# 13. Future MCP Servers

| Server | Purpose | Priority |
|--------|---------|----------|
| **Cloudflare** | DNS, Workers, R2, Pages | Medium |
| **Neon** | Branch DB, instant clones | Medium |
| **Stripe** | Customers, subscriptions, webhooks | High (billing) |
| **Paddle** | Alternative payments | Low |
| **Sentry** | Errors, performance, releases | High (monitoring) |
| **Better Stack** | Logs, uptime, alerts | High (observability) |
| **Redis** | Cache, queues, rate limits | Medium |
| **Browser Automation** | Complex scraping, auth flows | Low |

---

# 14. Tool Selection Rules

1. **Always prefer MCP** over manual CLI/API calls when available
2. **Never request manual action** if MCP can safely perform it
3. **Verify results** — check output, don't assume success
4. **Use read-first** — explore before mutate
5. **Batch operations** — combine multiple reads in one call
6. **Respect rate limits** — MCP servers handle retry/backoff

---

# 15. Manual Fallback Rules

**Use manual (CLI/API) when**:
- MCP server not configured
- MCP tool missing required capability
- MCP server returns error (after 1 retry)
- Operation requires interactive auth (OAuth flow)
- Emergency/incident response (direct access faster)

**Fallback Procedure**:
1. Document why MCP couldn't be used
2. Execute manually with full context
3. File issue to add MCP capability
4. Update this spec

---

# 16. Security

**Secrets Management**:
- Never log tokens, keys, secrets
- Use `${ENV_VAR}` interpolation in configs
- Rotate tokens quarterly (calendar reminder)
- Audit token usage monthly

**Network**:
- MCP servers run locally (stdio transport)
- No external MCP endpoints (security boundary)
- All API calls via HTTPS

**Permissions**:
- Principle of least privilege per server
- Write/delete/deploy always require approval
- Audit log: `.claude/mcp/audit.log` (append-only)

---

# 17. Logging

**MCP Call Log Format**:
```json
{
  "timestamp": "2026-07-27T10:30:00Z",
  "server": "supabase",
  "tool": "push_migrations",
  "args": { "projectRef": "nsjetmjtwbhellqasggw", "env": "staging" },
  "result": "success",
  "durationMs": 45000,
  "requestId": "req_abc123"
}
```

**Location**: `.claude/mcp/audit.log` (auto-rotated weekly)

**Retention**: 90 days

---

# 18. Error Handling

**Common Errors & Remediation**:

| Error | Cause | Fix |
|-------|-------|-----|
| `connection_refused` | Server not running | Check config, restart MCP |
| `permission_denied` | Token scope insufficient | Update token permissions |
| `rate_limited` | API quota exceeded | Wait, retry with backoff |
| `not_found` | Resource ID wrong | Verify ID, list resources first |
| `timeout` | Operation too long | Increase timeout, check logs |

**Retry Policy**: 1 automatic retry with exponential backoff (1s, 2s)

---

# 19. Troubleshooting

**Debug Commands**:
```bash
# Test server connectivity
claude mcp test github
claude mcp test supabase --project nsjetmjtwbhellqasggw

# View server logs
claude mcp logs github --tail 50

# List available tools
claude mcp tools github
claude mcp tools supabase

# Re-register server
claude mcp register github --force
```

**Common Issues**:
- **Supabase MCP**: "apply_migration fails" → Check migration SQL syntax, run locally first
- **Vercel MCP**: "deployment stuck" → Check build logs, verify env vars
- **GitHub MCP**: "403 on private repo" → Token needs `repo` scope
- **Playwright MCP**: "browser not found" → Run `playwright install chromium`

---

# 20. Future Improvements

- **Dynamic Discovery**: Auto-detect MCP servers from `package.json` or config
- **Capability Detection**: Probe server for available tools at runtime
- **Health Monitoring**: Background checks, alert on degraded servers
- **Parallel Execution**: Run independent MCP calls concurrently
- **Custom MCP Servers**: Internal tools (db-seed, typegen, deploy-script)
- **MCP Marketplace**: Shareable server configs across team