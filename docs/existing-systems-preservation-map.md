# Existing Systems Preservation Map — The Corporate Desk

**Date:** March 23, 2026  
**Method:** Full codebase inspection — every file read, every route counted, every DB table confirmed  
**Rule:** Inspect first. Preserve by default. Only replace when clearly necessary and documented.

---

## Classification Key

| Label | Meaning |
|-------|---------|
| **KEEP AS-IS** | Working, stable, do not touch without explicit user instruction |
| **UPGRADE IN PLACE** | Working but has gaps or polish debt — improve without rebuilding |
| **REFACTOR CAREFULLY** | Core functionality exists but needs structural improvement — do in isolation |
| **REPLACE ONLY IF NECESSARY** | Weak or duplicated — rebuild only if a specific bug or user request demands it |

---

## 1. Database Schema (`shared/schema.ts` — 2,273 lines)

### 1a. Core Business Tables — KEEP AS-IS

| Table | Purpose | DB Status |
|-------|---------|-----------|
| `leads` | All customer enquiry leads | ✅ Confirmed in DB |
| `planning_requests` | Free layout plan requests | ✅ Confirmed |
| `strategy_bookings` | Strategy call bookings | ✅ Confirmed |
| `supplier_quotes` | RFQ/supplier quote requests | ✅ Confirmed |
| `quotes` | Internal quote records + line items | ✅ Confirmed |
| `product_reviews` | Product review submissions | ✅ Confirmed |
| `catalog_products` | Catalog product records | ✅ Confirmed |
| `catalog_staging_items` | Import staging pipeline | ✅ Confirmed |
| `product_drafts` | Admin product drafts | ✅ Confirmed |

**Rule:** Do NOT add/remove columns from these tables without checking all routes in `server/routes.ts` first.

### 1b. Partner System Tables — KEEP AS-IS (Fully Built, Confirmed in DB)

| Table | Purpose | DB Status |
|-------|---------|-----------|
| `partners` | Partner company profiles + status | ✅ Confirmed in DB |
| `partner_referrals` | Deal referrals with AI scoring fields | ✅ Confirmed |
| `partner_referral_events` | Audit trail (submitted→scored→won→paid) | ✅ Confirmed |
| `partner_commissions` | Commission records, payment tracking | ✅ Confirmed |
| `partner_opportunities` | Opportunities routed TO partners from radar | ✅ Confirmed |
| `partner_documents` | Agreement/document tracking | ✅ Confirmed |
| `partner_settings` | Global commission rate + payout rules | ✅ Confirmed |

**Critical:** All 6 partner tables exist and are production-live. The `referralRate` default is `0.075` (7.5%). Do NOT rebuild this — upgrade in place only.

### 1c. Intelligence & AI Tables — KEEP AS-IS

| Table | Purpose |
|-------|---------|
| `intelligence_signals` | Market/news/relocation signals |
| `intelligence_reports` | Scheduled AI intelligence reports |
| `intelligence_graph_edges` | Company relationship graph |
| `building_signals` | Building-level signals |
| `buildings` | Building database |
| `tenants` | Tenant database |
| `lease_records` | Lease tracking |
| `office_move_radar` | Move probability signals |
| `deal_hunter_signals` | Deal hunter output |
| `relocation_signals` | Relocation intelligence |
| `company_intelligence` | Per-company AI intelligence |
| `nexora_runs` | Nexora AI execution log |
| `alex_actions` | Alex AI action history |
| `outreach_messages` / `outreach_sequences` / `outreach_threads` | Outreach engine |
| `follow_up_sequences` | Email follow-up automation |
| `prospected_leads` / `ingested_leads` | Lead pipeline |

**Rule:** These tables have complex interdependencies with 20+ AI services. Do NOT modify columns without auditing all usages in `server/services/`.

### 1d. Financial Tables — KEEP AS-IS

| Table | Purpose |
|-------|---------|
| `commissions` | Legacy commission records (separate from `partner_commissions`) |
| `revenue_events` | Revenue tracking |
| `revenue_share_records` | Revenue share (finance partners — Stratton/QPF/Vestone) |
| `invoices_log` | Invoice tracking |
| `payment_customers` / `payment_intents_log` / `payment_links` | Stripe payment data |
| `profit_records` | Profit engine output |
| `spending_trends` | Spending analysis |

**Warning:** `commissions` (legacy) and `partner_commissions` (partner network) are separate tables serving different purposes. Do NOT merge them.

---

## 2. Backend API Routes (`server/routes.ts` — 9,470 lines, 403 routes)

### 2a. Public-Facing Routes — KEEP AS-IS

| Route | Purpose | Status |
|-------|---------|--------|
| `POST /api/leads` | Customer lead capture (layout plan, quote, strategy) | ✅ Working — use for all structured lead types |
| `POST /api/enquiries` | Simple product/catalog enquiries | ✅ Working — use for CatalogProductDetail |
| `POST /api/planning-requests` | Free layout plan form | ✅ Working |
| `POST /api/supplier-quotes` | RFQ submission | ✅ Working |
| `POST /api/product-reviews` | Review submission | ✅ Working |
| `POST /api/partners/apply` | Partner application (→ `partners` table) | ✅ Working |
| `POST /api/partners/referrals` | Referral submission (→ `partner_referrals` + AI scoring) | ✅ Working |
| `GET /api/partner-dashboard/:email` | Partner dashboard data (referrals + opportunities + commissions) | ✅ Working |
| `PATCH /api/partner-opportunities/:id/respond` | Partner accepts/declines an opportunity | ✅ Working |
| `GET /api/catalog-products` | Product catalog query | ✅ Working |
| `GET /api/catalog-products/:sku` | Single product lookup | ✅ Working |

**Critical path:** Do NOT touch `POST /api/leads` validation — the `type` field must be one of the allowed values (`layout_plan | quote_request | strategy_call | contact_form`). Unknown types return 500. Use `/api/enquiries` for catalog product enquiries.

### 2b. Admin API Routes — KEEP AS-IS

All `/api/admin/*` routes exist and are wired to their respective admin pages. 40+ admin endpoints confirmed. Key groups:

- `/api/admin/partners/*` — partner management (approve, suspend, settings)
- `/api/admin/referrals/*` — referral CRUD + status management
- `/api/admin/partner-opportunities/*` — opportunity routing management
- `/api/referrals/:id/score|assign|status|mark-won|mark-lost|mark-paid|commission/calc|commission/pay` — full referral lifecycle
- `/api/admin/leads` — lead intelligence
- `/api/admin/nexora` — Nexora AI command centre
- `/api/admin/deal-hunter` — deal hunter signals
- `/api/admin/relocation-signals` — relocation intelligence
- `/api/admin/buildings` — building database
- `/api/admin/intelligence-hub` — intelligence reports

**Rule:** Route ordering matters. Specific sub-paths (e.g. `/api/admin/partners/stats`) must be defined BEFORE wildcard paths (e.g. `/api/admin/partners/:id`). This is already correct — do not reorder.

### 2c. Finance Routes — KEEP AS-IS

| Route | Purpose |
|-------|---------|
| `POST /api/leads` with `type: finance` | Finance lead routing to Stratton/QPF/Vestone |
| `POST /api/commissions` | Legacy commission creation |
| `GET /api/commissions/stats` | Commission statistics |
| `POST /api/referrals/:id/commission/pay` | Granular commission payment with reference |

---

## 3. Frontend Pages

### 3a. Do Not Touch — KEEP AS-IS

| Page | Route | Lines | Reason |
|------|-------|-------|--------|
| `QuoteBuilder.tsx` | `/quote-builder` + `/embed/quote-builder` | — | Explicitly protected — WordPress embed |
| `UploadFloorPlan.tsx` | `/upload-your-floor-plan` | — | Explicitly protected |
| `ProductDetail.tsx` | `/products/:sku` (redirects to `/catalog`) | — | Legacy — leave the redirect, do not delete the file |
| `ThankYou.tsx` | `/thank-you-*` | — | Working thank-you pages |
| `not-found.tsx` | 404 catch-all | — | Working |

### 3b. Core Public Pages — KEEP AS-IS

| Page | Route | Lines | Assessment |
|------|-------|-------|------------|
| `Home.tsx` | `/` | 603 | Premium, fully branded, no issues |
| `Start.tsx` | `/start` | — | Entry point — stable |
| `FreeLayoutPlan.tsx` | `/free-layout-plan` | 468 | Wired to backend, working |
| `WorkplaceStrategy.tsx` | `/workplace-strategy` | 434 | Wired to backend, working |
| `SendQuote.tsx` | `/request-a-quote` | — | Wired to backend, working |
| `TradeProcurement.tsx` | `/trade-project-procurement` | — | Working |
| `Contact.tsx` | `/contact` | 149 | Working |
| `Blog.tsx` / `BlogPost.tsx` | `/blog` | — | Working |
| `CaseStudies.tsx` | `/case-studies` | — | Working |
| `Testimonials.tsx` | `/testimonials` | — | Working |
| `FinanceWorkspace.tsx` | `/finance-your-workspace` | — | WordPress embed |
| `OfficeWalkthrough.tsx` | `/3d-office-walkthrough` | — | Stable |
| `MarketMap.tsx` | `/market-map` | — | Stable |
| `Capability.tsx` | `/capability` | — | Stable |

### 3c. New Catalog System — UPGRADE IN PLACE (Current Focus)

| Page | Route | Lines | Status |
|------|-------|-------|--------|
| `Catalog.tsx` | `/catalog` + `/catalog/:category` | — | Rebuilt — pagination working, image rendering fixed |
| `CatalogProductDetail.tsx` | `/catalog/product/:sku` | — | Built — hero, specs, enquiry modal, related products |

**Current outstanding items:**
- Mobile layout performance audit
- Image display consistency across all 168 product cards
- CatalogProductDetail enquiry modal uses `/api/enquiries` ✅ (confirmed working)

### 3d. Partner System Pages — UPGRADE IN PLACE (Fully Wired, Minor Polish)

| Page | Route | Lines | Status |
|------|-------|-------|--------|
| `Partners.tsx` | `/partners` | 371 | ✅ Real form → `/api/partners/apply` → DB insert |
| `SubmitDeal.tsx` | `/submit-deal` | 256 | ✅ Real form → `/api/partners/referrals` → DB + AI score |
| `PartnerDashboard.tsx` | `/partner-dashboard` | 414 | ✅ Email-lookup → real data (referrals/opportunities/commissions) |
| `PartnerOnboarding.tsx` | `/partner-onboarding` | 307 | ✅ Onboarding flow |

**Known open issues (from `docs/open-issues.md`):**
- P3: No email notification to admin on referral submission
- P3: Agreement/document system schema exists, routes not built
- P2: Partner dashboard uses email-only auth (by design for MVP)

**Upgrade priority:**
1. Add email notification on referral submission (SMTP route already in `server/email.ts`)
2. Do NOT rebuild auth until explicitly requested
3. Do NOT restructure the dashboard layout — it's brand-aligned and working

### 3e. Admin System Pages — KEEP AS-IS (Most), UPGRADE IN PLACE (Specific Gaps)

| Page | Route | Lines | Classification |
|------|-------|-------|----------------|
| `AdminDashboard.tsx` | `/admin/dashboard` | 1,164 | KEEP AS-IS — comprehensive dashboard |
| `AdminLeads.tsx` | `/admin/leads` | 1,055 | KEEP AS-IS — full lead intelligence |
| `AdminPartners.tsx` | `/admin/partners` | 422 | KEEP AS-IS — partner + referral + commission tabs |
| `AdminPartnerNetwork.tsx` | `/admin/partner-network` | 520 | KEEP AS-IS — partner opportunity routing |
| `AdminNexoraCommandCentre.tsx` | `/admin/nexora` | 470 | KEEP AS-IS |
| `AdminDealPipeline.tsx` | `/admin/deal-pipeline` | 448 | KEEP AS-IS |
| `AdminIntelligenceHub.tsx` | `/admin/intelligence-hub` | — | KEEP AS-IS |
| `AdminCommandCentre.tsx` | `/admin/command-centre` | 4 | REPLACE ONLY IF NECESSARY — stub (4 lines) |
| `AdminQuotes.tsx` | `/admin/quotes` | — | KEEP AS-IS |
| `AdminDealHunter.tsx` | `/admin/deal-hunter` | — | KEEP AS-IS |
| `AdminOfficeMovRadar.tsx` | `/admin/office-move-radar` | — | KEEP AS-IS |
| `AdminRelocationIntelligence.tsx` | `/admin/relocation-intelligence` | — | KEEP AS-IS |
| `AdminMarketIntelligence.tsx` | `/admin/market-intelligence` | — | KEEP AS-IS |
| `AdminCompanyVisitors.tsx` | `/admin/company-visitors` | — | KEEP AS-IS |
| `AdminCatalogStaging.tsx` | `/admin/catalog-staging` | — | KEEP AS-IS |
| `AdminProductCommandCentre.tsx` | `/admin/products` | — | KEEP AS-IS |
| `AdminAlexDashboard.tsx` | `/admin/alex` | — | KEEP AS-IS |
| `AdminLeadEngine.tsx` | `/admin/lead-engine` | — | KEEP AS-IS |
| `ProposalEngine.tsx` | `/admin/proposal-engine` | — | KEEP AS-IS |
| `BuildingDatabase.tsx` | `/admin/building-database` | — | KEEP AS-IS |

**Admin auth pattern:** `sessionStorage.tcd_admin_auth === "true"` OR login page. Do NOT change this pattern — all admin pages rely on it.

### 3f. Other Public Pages — UPGRADE IN PLACE (Low Priority)

| Page | Route | Lines | Notes |
|------|-------|-------|-------|
| `About.tsx` | `/about` | 192 | Small — may benefit from brand refresh |
| `TradeCustomersPortal.tsx` | `/trade-customers-portal` | 261 | Well-structured, commercially aligned |
| `WorkplaceSolutions.tsx` | `/workplace-solutions` | — | Stable |
| `WorkspaceDesignEngine.tsx` | `/ai-workspace-design` | — | Stable |

---

## 4. AI & Intelligence Services (`server/services/` — 10,610 lines)

### 4a. Nexora AI Engine — KEEP AS-IS

| File | Lines | Classification |
|------|-------|----------------|
| `nexoraEngine.ts` | — | KEEP AS-IS — Nexora master AI (GPT-4o) |
| `nexoraLoop.ts` | — | KEEP AS-IS — 30-min autonomous loop via pg-boss |
| `intelligenceScheduler.ts` | 1,022 | KEEP AS-IS — 36-queue job orchestration |

**Nexora is the sole executive intelligence authority** — do not add competing AI system branding to any public page.

### 4b. Partner AI Services — KEEP AS-IS

| File | Lines | Classification |
|------|-------|----------------|
| `partnerReferralAI.ts` | 122 | KEEP AS-IS — GPT-4o-mini scores every referral on submission |
| `partnerNetwork.ts` | 339 | KEEP AS-IS — opportunity routing to partner network |
| `partnerNetwork/commissionService.ts` | 90 | KEEP AS-IS — commission calculation |

**Integration:** `scorePartnerReferral()` is called automatically on every `POST /api/partners/referrals`. It writes AI scores back to the `partner_referrals` row and inserts a `partner_referral_events` audit record.

### 4c. Intelligence Services — KEEP AS-IS

| File | Lines | Classification |
|------|-------|----------------|
| `dealHunter.ts` | 470 | KEEP AS-IS |
| `dealIntelligence.ts` | 887 | KEEP AS-IS |
| `officeMovRadarService.ts` | 452 | KEEP AS-IS |
| `relocationIntelligence.ts` | 333 | KEEP AS-IS |
| `companyIntelligenceService.ts` | 398 | KEEP AS-IS |
| `leaseSignalScanner.ts` | 322 | KEEP AS-IS |
| `opportunityScoring.ts` | 298 | KEEP AS-IS |
| `leadEngine.ts` | 240 | KEEP AS-IS |
| `newsFeedScanner.ts` | 580 | KEEP AS-IS |
| `workspaceStrategy.ts` | 298 | KEEP AS-IS |
| `workspaceLearning.ts` | — | KEEP AS-IS |
| `profitOptimisation.ts` | 504 | KEEP AS-IS |
| `supplierProcurement.ts` | — | KEEP AS-IS |
| `floorPlanParser.ts` | 689 | KEEP AS-IS |
| `productAI.ts` | 303 | KEEP AS-IS |
| `catalogNormaliser.ts` | 324 | KEEP AS-IS |
| `aiManufacturerOutreach.ts` | — | KEEP AS-IS |
| `intelligenceEngine.ts` | 439 | KEEP AS-IS |
| `whatsappAI.ts` | 383 | KEEP AS-IS |

### 4d. Alex AI Agent — KEEP AS-IS

The `alex/` subdirectory contains Alex's system prompt, context builders, and action handlers. Alex is a chat-based AI (not autonomous). Known gaps from `docs/money-mode-audit.md`:
- Alex v2 autonomous agent loop — NOT built (Stage 2 gap)
- Decision engine — NOT built (Stage 3 gap)

**Do not extend Alex without referencing the money-mode-audit gaps list.**

---

## 5. Global Components — KEEP AS-IS

| Component | File | Classification |
|-----------|------|----------------|
| `NexoraCopilot` | `NexoraCopilot.tsx` | KEEP AS-IS — global AI assistant overlay |
| `NexoraJourneyBar` | `NexoraJourneyBar.tsx` | KEEP AS-IS — persistent journey tracker |
| `Layout` | `Layout.tsx` | KEEP AS-IS — shared Header + Footer |
| `ConciergeContext` | `contexts/ConciergeContext` | KEEP AS-IS — global concierge state |
| `usePageTracking` | `lib/usePageTracking.ts` | KEEP AS-IS — page analytics |

---

## 6. Known Gaps & Open Issues

### From `docs/open-issues.md`

| Priority | Issue | Action |
|----------|-------|--------|
| P2 | Partner dashboard: email-only auth (no OTP) | Acceptable for MVP — add magic-link auth when prioritised |
| P2 | Nexora loop resets on server restart | Mitigated by pg-boss — persistent enough for now |
| P3 | No email notification on referral submission | Add SMTP email to `POST /api/partners/referrals` when prioritised |
| P3 | Partner agreement/document system incomplete | Schema + document tracking exists — routes not built |
| P3 | Commission payout history partial | `POST /api/referrals/:id/commission/pay` exists — UI partial |

### From `docs/money-mode-audit.md`

| Stage | Item | Status |
|-------|------|--------|
| Stage 1 | Global Intelligence Graph (cluster detection, GraphQueryEngine) | MOSTLY MISSING |
| Stage 1 | Event-driven graph enrichment hooks | MISSING |
| Stage 2 | Alex v2 autonomous agent + opportunity detection loop | MISSING |
| Stage 3 | AlexDecisionEngine (IGNORE / MONITOR / OUTREACH / BOOK_MEETING) | MISSING |

**These are substantial features** — do not attempt without explicit planning and user approval.

### Current Sprint Focus (Catalog Polish)

| Item | Status |
|------|--------|
| All 168 product images replaced with clean AI images | ✅ Done |
| Static file serving fixed (`/catalog-assets/`) | ✅ Done |
| Catalog rebuilt with pagination + load more | ✅ Done |
| Card → Product Detail flow (clickable → `/catalog/product/:sku`) | ✅ Done |
| CatalogProductDetail: hero, specs, enquiry modal | ✅ Done |
| Enquiry modal wired to `/api/enquiries` | ✅ Done |
| E2E test: card click → detail → enquiry → success | ✅ Passing |
| Mobile performance audit | ⬜ Pending |
| Preservation map document | ✅ This document |

---

## 7. Critical Rules — Do Not Violate

1. **Do NOT use `/api/leads`** for catalog enquiries — use `/api/enquiries` (the `leads` endpoint returns 500 for unknown `type` values)
2. **Do NOT delete `ProductDetail.tsx`** — it is referenced by the legacy redirect chain
3. **Do NOT modify `server/db.ts`**, `client/src/lib/furnitureCatalogue.ts`, `package.json`, `QuoteBuilder.tsx`, or `UploadFloorPlan.tsx`
4. **Do NOT change primary key types** — `id: serial(...)` stays serial; `id: varchar(...).default(sql\`gen_random_uuid()\`)` stays varchar
5. **SQL pattern:** use `` sql`${col} >= N` `` NOT `gte(col, N)` in raw Drizzle queries
6. **Route ordering:** specific sub-routes (e.g. `/api/admin/partners/stats`) MUST be defined BEFORE wildcard routes (e.g. `/api/admin/partners/:id`)
7. **OpenAI pattern:** always use `AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL` — never bare `OPENAI_API_KEY`
8. **Nexora is the only AI brand** — do not introduce competing AI names on any public-facing page
9. **Partner system is live and in DB** — treat as production data, do not seed/reset/mock

---

*Document written: March 23, 2026. Reflects codebase state at time of preservation audit.*
