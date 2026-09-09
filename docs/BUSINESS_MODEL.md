# Lumena Workspace

Business Model Specification

Version: 1.0

Status: Implemented (Core Monetization Live)

Last Updated: 2026-07-27

---

# Table of Contents

1. Business Philosophy
2. Business Goals
3. Value Proposition
4. Revenue Model
5. Target Customers
6. Customer Segments
7. Pricing Strategy
8. Subscription Plans
9. Credits System
10. Credit Economy
11. Credit Consumption
12. Credit Purchases
13. AI Cost Strategy
14. Provider Cost Optimization
15. OCR Cost Strategy
16. Infrastructure Costs
17. Gross Margin Strategy
18. Customer Lifetime Value
19. Churn Reduction
20. Free Tier Strategy
21. Upsell Strategy
22. Enterprise Strategy
23. Discounts
24. Promotions
25. Referral Program
26. Partnerships
27. Financial Metrics
28. Risks
29. Future Monetization
30. Success Metrics

---

# 1. Business Philosophy

**Sustainable Value, Not Extraction**

Lumena's business model aligns revenue with user value: you pay when AI helps you understand documents better. No seat licenses, no feature gates on core workflow — only on AI scale.

**Principles**:
- **Transparent Pricing**: Credit costs shown before every action
- **No Vendor Lock-in**: Export all data, standard formats
- **Fair Free Tier**: 50 credits/month = meaningful usage, not trial
- **Usage-Based**: Pay for what you consume, not what you might

---

# 2. Business Goals

| Goal | Target | Timeline |
|------|--------|----------|
| **MRR** | $50K | 12 months |
| **Paid Users** | 1,000 | 12 months |
| **Gross Margin** | >80% | Ongoing |
| **Churn (Monthly)** | <5% | Ongoing |
| **LTV:CAC** | >3:1 | 18 months |
| **Free→Paid Conversion** | 8% | 12 months |

---

# 3. Value Proposition

| User Problem | Lumena Solution | Willingness to Pay |
|--------------|-----------------|---------------------|
| "I have 200 PDFs to read" | Chat + summaries + flashcards | High (time savings) |
| "I forget what I read" | Spaced repetition study mode | Medium (retention) |
| "I need to cite sources" | Inline citations + highlights | High (accuracy) |
| "OCR is expensive/complex" | Free local Tesseract.js | Low (included) |
| "Team needs shared knowledge" | Workspaces + future collaboration | High (B2B) |

---

# 4. Revenue Model

**Primary**: Freemium SaaS (Subscription + Credits)
- **Subscriptions**: Monthly/Yearly plans (Free, Pro, Max)
- **Credits**: Prepaid packages for AI usage (one-time)
- **Enterprise**: Custom contracts (future)

**Secondary** (Future):
- **Marketplace**: Community templates, prompts, workflows
- **API**: Programmatic access (per-request pricing)
- **White Label**: Embedded Lumena for platforms

---

# 5. Target Customers

**Primary**: Knowledge Workers who read PDFs professionally
- Researchers, analysts, consultants, lawyers, students
- 50-500 PDFs/year, need extraction + synthesis

**Secondary**: Teams & Organizations
- Shared workspaces, centralized billing, admin controls

---

# 6. Customer Segments

| Segment | Size | Pain Point | Lumena Fit |
|---------|------|------------|-----|
| **Grad Students** | Large | Literature review, citations | High (free tier sufficient) |
| **Researchers** | Medium | Volume reading, synthesis | High (Pro) |
| **Consultants** | Medium | Client reports, extraction | High (Pro/Max) |
| **Legal/Compliance** | Small | Document review, citation | High (Max) |
| **Corporate Teams** | Large | Knowledge sharing, onboarding | Future (Enterprise) |

---

# 7. Pricing Strategy

**Value-Based, Not Cost-Plus**

| Lever | Approach |
|-------|----------|
| **Anchor** | Free tier = 50 credits (shows value) |
| **Upgrade Trigger** | Credit exhaustion + Pro model access |
| **Price Points** | $15/mo (Pro), $45/mo (Max) — accessible |
| **Annual Discount** | 20% off (reduces churn) |
| **Credit Packs** | $5 (100), $20 (500), $50 (1500) — marginal discount |

---

# 8. Subscription Plans

| Feature | Free | Pro ($15/mo) | Max ($45/mo) |
|---------|------|--------------|--------------|
| **Monthly Credits** | 50 | 1,000 | 10,000 |
| **AI Models** | Gemini Flash | Flash + Pro | Flash + Pro + Priority |
| **Credit Rollover** | ❌ | ✅ (3 months) | ✅ (12 months) |
| **Max File Size** | 25MB | 50MB | 100MB |
| **Max Pages/Doc** | 100 | 500 | Unlimited |
| **Concurrent Processing** | 1 | 3 | 10 |
| **Knowledge Tools** | Flashcards, Glossary | + Mind Map, Timeline | + Presentations, Podcast |
| **Study Mode** | ✅ | ✅ | ✅ |
| **Highlights** | ✅ | ✅ | ✅ |
| **Chat History** | 30 days | 1 year | Unlimited |
| **Export** | JSON | JSON + PDF + Anki | All formats |
| **API Access** | ❌ | ❌ | Future |
| **Support** | Community | Email (48h) | Priority (4h) |
| **SSO/SCIM** | ❌ | ❌ | Enterprise only |

---

# 9. Credits System

**Credits = Universal AI Currency**

1 credit ≈ $0.01 USD (internal cost basis)

**Why Credits, Not Seats**:
- Aligns cost with value (heavy users pay more)
- Enables granular feature pricing
- Supports prepaid + subscription hybrid
- Transparent: "This action costs X credits"

---

# 10. Credit Economy

## Monthly Quota (Buckets)

| Plan | Monthly Quota | Rollover | Daily Circuit Breaker |
|------|---------------|----------|----------------------|
| Free | 50 | None | 100 |
| Pro | 1,000 | 3 months | 5,000 |
| Max | 10,000 | 12 months | 20,000 |

**Implementation**: `credit_buckets` table (per workspace, per month)

## Ledger (Immutable Audit Trail)

`credit_ledger` — append-only, never UPDATE/DELETE

| Field | Purpose |
|-------|---------|
| `direction` | +1 (grant) / -1 (consume) |
| `entry_type` | grant, purchase, reserve, consume, release, expire, refund, adjust, bonus, referral, circuit_breaker |
| `idempotency_key` | Prevents double-counting |
| `metadata` | JSON: action, model, pages, workspace, document |

## Reservations (Optimistic Concurrency)

1. **Reserve** → `credit_reservations` (expires 1hr)
2. **Execute** → AI/Processing
3. **Settle** → `reserved → consume` (actual cost) OR `reserved → release` (failed)

**Prevents**: Overdraft, race conditions, stuck credits

---

# 11. Credit Consumption

| Action | Cost (Credits) | Plan Gate |
|--------|----------------|-----------|
| **Chat Message** (Flash) | 1 | Free+ |
| **Chat Message** (Pro) | 5 | Pro+ |
| **Flashcards** (generate) | 10 | Free+ |
| **Glossary** (generate) | 10 | Free+ |
| **Mind Map** (generate) | 15 | Pro+ |
| **Timeline** (generate) | 15 | Pro+ |
| **Presentation** (generate) | 20 | Max |
| **Podcast** (generate) | 25 | Max |
| **OCR Page** (Tesseract) | 2 | Free+ |
| **Layout Analysis** | 1 | Free+ |
| **Vision Analysis** | 5 | Pro+ |
| **Text Extraction** | 0 | Free+ |

**Estimates Shown Before Action**: `CreditEstimate` component in Chat/Knowledge UI

---

# 12. Credit Purchases

**One-Time Packages** (Stripe Checkout):

| Package | Credits | Price | $/Credit | Savings |
|---------|---------|-------|----------|---------|
| Starter | 100 | $5 | $0.050 | — |
| Growth | 500 | $20 | $0.040 | 20% |
| Scale | 1,500 | $50 | $0.033 | 34% |

**Flow**:
1. Click package → `create-checkout-session` Edge Function
2. Stripe Checkout (hosted, PCI compliant)
3. `checkout.session.completed` webhook → `stripe-webhook`
4. Grant credits via ledger (`entry_type: purchase`)
5. Email receipt + in-app toast

**No Auto-Renew** — Pure prepaid, user controls spend

---

# 13. AI Cost Strategy

**Provider**: Google Gemini (Flash / Pro)

| Model | Input $/1M tok | Output $/1M tok | Lumena Credit Cost |
|-------|----------------|-----------------|-------------------|
| Flash | $0.075 | $0.30 | 1-5 |
| Pro | $1.25 | $5.00 | 5-20 |

**Margin Target**: 10x markup on model cost → covers infra, support, R&D

**Cost Controls**:
- Plan-gated model access (Free: Flash only)
- Token limits per request (configurable)
- Daily circuit breaker (10k credits/workspace)
- Caching for repeated prompts (future)

---

# 14. Provider Cost Optimization

**Provider Framework** enables:
- **Routing**: Simple docs → Flash, Complex → Pro
- **Fallback**: Pro fails → Flash (user notified)
- **Local OCR**: Tesseract.js (zero marginal cost)
- **Future**: Local LLMs (Ollama) for privacy tier

**Benchmarking** (Quarterly):
- Compare providers on: quality, latency, cost
- Switch default if >10% better on cost/quality

---

# 15. OCR Cost Strategy

**Current**: Tesseract.js (WASM, browser) — **$0 marginal cost**

**Trade-offs**:
- ✅ Free, private, offline
- ⚠️ Slower (CPU), lower accuracy on tables/handwriting
- 📦 Large WASM (~15MB)

**Future Options**:
| Provider | Cost | Quality | Latency |
|----------|------|---------|---------|
| Surya (local) | $0 | High | Medium |
| Google Vision | $1.50/1K | Very High | Low |
| AWS Textract | $1.50/1K | High | Low |
| Azure Form Recognizer | $1.50/1K | High | Low |

**Decision**: Keep Tesseract free, offer cloud OCR as Pro+ upgrade (credits)

---

# 16. Infrastructure Costs

| Component | Provider | Est. Monthly (1K users) |
|-----------|----------|------------------------|
| **Frontend Hosting** | Vercel Pro | $20 |
| **Database** | Supabase Pro | $25 |
| **Edge Functions** | Supabase (included) | $0 |
| **Storage** | Supabase (100GB) | $10 |
| **Auth** | Supabase (included) | $0 |
| **Realtime** | Supabase (included) | $0 |
| **AI (Gemini)** | Google AI | $500-2000 |
| **Payments** | Stripe (2.9% + 30¢) | Variable |
| **Monitoring** | Sentry/BetterStack | $50 |
| **Total (excl. AI)** | | ~$105 |

**AI is 90%+ of COGS** — focus optimization there

---

# 17. Gross Margin Strategy

**Target**: >80% gross margin at scale

**Leverage Points**:
1. **Credit Markup**: 10x on model cost
2. **Local Processing**: OCR, extraction, layout = $0 marginal
3. **Efficient Models**: Flash for 80% of use cases
4. **Caching**: Repeated prompts → cached responses
5. **Batching**: Async processing → cheaper compute

**Margin by Plan**:
| Plan | Revenue/User/Mo | COGS/User/Mo | Margin |
|------|-----------------|--------------|--------|
| Free | $0 | $0.50 | N/A |
| Pro | $15 | $2.00 | 87% |
| Max | $45 | $8.00 | 82% |

---

# 18. Customer Lifetime Value (LTV)

**Assumptions**:
- Pro: $15/mo, 24-month avg tenure = $360
- Max: $45/mo, 36-month avg tenure = $1,620
- Blended (80% Pro, 20% Max): ~$600 LTV

**With Credits** (20% buy packs): +$120 LTV

**Target LTV**: >$700 by Year 2

---

# 19. Churn Reduction

| Mechanism | Impact |
|-----------|--------|
| **Credit Rollover** (Pro/Max) | Reduces "use it or lose it" pressure |
| **Usage Alerts** | Email at 80% quota, 3 days before expiry |
| **Value Emails** | Weekly "You generated 50 flashcards this week" |
| **Pause Subscription** | Instead of cancel (retains data, no billing) |
| **Downgrade Path** | Pro → Free seamless, no data loss |
| **Annual Discount** | 20% off locks in 12 months |

**Target Churn**: <5% monthly (Pro), <3% (Max)

---

# 20. Free Tier Strategy

**Not a Trial — A Real Product**

| Free Tier Includes | Purpose |
|--------------------|---------|
| 50 credits/month | ~25 chats or 5 flashcard sets |
| All core features (viewer, highlights, chat) | Full workflow experience |
| Flashcards + Glossary | Best knowledge tools |
| Study Mode | Retention hook |
| 1 workspace, 100-page docs | Real use case |

**Conversion Triggers**:
1. Credit exhaustion → "Upgrade for 1,000/mo"
2. Pro model needed → "Unlock Gemini Pro"
3. Mind Map/Timeline → "Pro unlocks advanced tools"
4. Large files → "Pro: 50MB, 500 pages"

---

# 21. Upsell Strategy

**In-Product, Contextual, Non-Intrusive**

| Trigger | Upsell | UI |
|---------|--------|----|
| Credit warning (80%) | "Upgrade for 20x credits" | Banner + Billing link |
| Model select (Pro only) | "Unlock Pro model" | Tooltip + Plan card |
| Generate Mind Map | "Pro unlocks Mind Maps" | Disabled button + tooltip |
| Upload >25MB | "Pro: 50MB limit" | Inline error + link |
| Monthly quota reset | "Welcome back! You have 1,000 credits" | Toast + usage bar |

**Never**: Nagging modals, feature removal, dark patterns

---

# 22. Enterprise Strategy

**Future (Post Product-Market Fit)**

| Feature | Enterprise Value |
|---------|------------------|
| **SSO/SCIM** | Okta, Azure AD, Google Workspace |
| **Audit Logs** | SOC2, compliance |
| **Data Residency** | EU/US region selection |
| **Dedicated Support** | SLA, named CSM |
| **Custom Models** | Fine-tuned on corp docs |
| **Admin Console** | Usage, billing, security |
| **API Access** | Integrate with internal tools |
| **Private Cloud** | VPC peering, Bring Your Own Cloud |

**Pricing**: Custom, starting ~$500/mo + usage

---

# 23. Discounts

| Type | Discount | Conditions |
|------|----------|------------|
| **Annual** | 20% off | Prepay 12 months |
| **Education** | 50% off | .edu email, verified |
| **Nonprofit** | 50% off | 501(c)(3) verified |
| **Volume** | Custom | 10+ seats (Enterprise) |
| **Early Adopter** | Lifetime 30% off | First 100 Pro subscribers |

**No**: Perpetual discounts, coupon codes (complexity)

---

# 24. Promotions

| Campaign | Timing | Mechanism |
|----------|--------|-----------|
| **Launch** | Month 1 | 50% off first 3 months |
| **Black Friday** | November | 30% off annual |
| **Back to School** | August | Education spotlight |
| **Product Hunt** | Launch week | Free 500 credits |

**Tracking**: UTM parameters → attribution in `payment_events.metadata`

---

# 25. Referral Program

**Give 100, Get 100** (credits)

1. User shares referral link (`/invite/:code`)
2. Referee signs up → both get 100 credits
3. Credits: `entry_type: referral`, no expiry
4. Cap: 1,000 credits/user (10 referrals)

**Fraud Prevention**: Credits only usable after referee processes 1 document

---

# 26. Partnerships

| Partner | Integration | Revenue Share |
|---------|-------------|---------------|
| **Supabase** | Default backend | None (vendor) |
| **Vercel** | Default hosting | None (vendor) |
| **Stripe** | Payments | None (vendor) |
| **Google AI** | Gemini models | None (vendor) |
| **Obsidian/Notion** | Export plugins | Future (affiliate) |
| **Universities** | Site licenses | Volume discount |

---

# 27. Financial Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **MRR** | Monthly Recurring Revenue | $50K (12mo) |
| **ARR** | MRR × 12 | $600K (12mo) |
| **ARPU** | MRR / Paid Users | $25 |
| **CAC** | Sales+Marketing / New Paid | <$100 |
| **LTV** | ARPU × Gross Margin × Tenure | >$700 |
| **LTV:CAC** | LTV / CAC | >3:1 |
| **Gross Margin** | (Revenue - COGS) / Revenue | >80% |
| **Net Revenue Retention** | (Expansion - Churn) / Starting MRR | >100% |
| **Payback Period** | CAC / (ARPU × Gross Margin) | <6 months |

---

# 28. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **AI Cost Spike** | Medium | High | Circuit breakers, local fallbacks, provider diversification |
| **Gemini API Changes** | Medium | High | Provider Framework abstraction, multi-provider ready |
| **Stripe Dependency** | Low | High | Abstract payment layer, support Paddle backup |
| **Supabase Vendor Lock-in** | Low | Medium | Standard Postgres, portable migrations |
| **Free Tier Abuse** | Medium | Medium | Rate limits, circuit breaker, CAPTCHA on auth |
| **Credit Card Fraud** | Low | Medium | Stripe Radar, webhook verification, idempotency |
| **Competitor Undercut** | Medium | Medium | Switching costs (data, workflows), brand loyalty |

---

# 29. Future Monetization

| Opportunity | Timeline | Model |
|-------------|----------|-------|
| **Marketplace** | 2027 | 20% commission on templates/prompts |
| **API Access** | 2027 | Per-request ($0.01) + monthly platform fee |
| **White Label** | 2028 | Annual license + usage |
| **Enterprise** | 2027 | Custom contracts |
| **Plugin Ecosystem** | 2028 | Revenue share on paid plugins |
| **Data Insights** | 2028 | Aggregated anonymized benchmarks (opt-in) |

---

# 30. Success Metrics (North Stars)

| Metric | Current | 6mo Target | 12mo Target |
|--------|---------|------------|-------------|
| **Weekly Active Users** | ~50 | 500 | 2,000 |
| **Paid Conversion** | 0% | 5% | 8% |
| **MRR** | $0 | $10K | $50K |
| **Credits Consumed/WAU** | 10 | 25 | 40 |
| **Flashcards Generated/WAU** | 5 | 15 | 30 |
| **NPS** | N/A | 40 | 50 |
| **Support Tickets/Week** | <5 | <20 | <50 |

---

*Last Updated: 2026-07-27 | Version 1.0 | Aligned with implemented codebase*