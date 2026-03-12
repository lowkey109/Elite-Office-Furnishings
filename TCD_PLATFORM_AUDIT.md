# The Corporate Desk — Full Platform Audit
**thecorporatedesk.com.au**
**Audit Date:** March 12, 2026
**Build Status:** All 16 phases complete

---

## 1. Frontend Pages (37 routes)

### Public-facing (customer)

| Route | File | Purpose |
|---|---|---|
| `/` | `Home.tsx` | Hero, product preview, trust signals, CTA sections |
| `/about` | `About.tsx` | Brand story, team, values |
| `/products` | `Products.tsx` | Full product catalogue with filters |
| `/products/:sku` | `ProductDetail.tsx` | Individual product page, size variants, reviews |
| `/workplace-solutions` | `WorkplaceSolutions.tsx` | Solutions landing page by office zone |
| `/workplace-strategy` | `WorkplaceStrategy.tsx` | Strategy consultation landing + form |
| `/free-office-layout-plan` | `FreeLayoutPlan.tsx` | Layout plan submission form (free lead gen) |
| `/send-us-your-quote` | `SendQuote.tsx` | Upload competitor quote for price match |
| `/quote-builder` | `QuoteBuilder.tsx` | Public interactive quote configurator |
| `/finance-your-workspace` | `FinanceWorkspace.tsx` | Finance application form (Stratton / QPF / Vestone routing) |
| `/upload-your-floor-plan` | `UploadFloorPlan.tsx` | Drag-and-drop floor plan upload + AI parse |
| `/3d-office-walkthrough` | `OfficeWalkthrough.tsx` | Three.js 3D interactive office preview |
| `/case-studies` | `CaseStudies.tsx` | Project case studies with photography |
| `/testimonials` | `Testimonials.tsx` | Client testimonials and trust signals |
| `/contact` | `Contact.tsx` | Contact form + office location |
| `/blog` | `Blog.tsx` | Blog listing page |
| `/blog/:slug` | `BlogPost.tsx` | Individual blog post |
| `/thank-you-layout-plan` | `ThankYou.tsx` | Post-submission thank you (layout plan) |
| `/thank-you-quote` | `ThankYou.tsx` | Post-submission thank you (quote) |
| `/thank-you-strategy` | `ThankYou.tsx` | Post-submission thank you (strategy call) |
| `/embed/quote-builder` | `QuoteBuilder.tsx` | Embeddable quote builder (iframe) |
| `/embed/finance-your-workspace` | `FinanceWorkspace.tsx` | Embeddable finance form (iframe) |

### Admin panel

| Route | File | Purpose |
|---|---|---|
| `/admin` | — | Redirects to `/admin/dashboard` |
| `/admin/dashboard` | `AdminDashboard.tsx` | Master command dashboard — KPIs, hot leads, revenue forecast panel, intelligence status |
| `/admin/leads` | `AdminLeads.tsx` | All inbound leads — table view, filters, export |
| `/admin/lead-intelligence` | `AdminLeads.tsx` | Alias for `/admin/leads` |
| `/admin/planning-requests` | `AdminPlanningRequests.tsx` | AI-scored planning submissions — full editor, formal quote creation button |
| `/admin/deal-pipeline` | `AdminDealPipeline.tsx` | **7-stage Kanban** — Lead Detected → Won/Lost, stage probability auto-display, weighted revenue forecast KPI tiles, move-stage dropdowns |
| `/admin/quotes` | `AdminQuotes.tsx` | Formal client quote list + editor (TCD-YYYYMM-XXXX) |
| `/admin/quotes/:id/print` | `QuotePrint.tsx` | A4 print/PDF layout for formal quotes |
| `/admin/supplier-quotes` | `AdminSupplierQuotes.tsx` | Supplier pricing tracker |
| `/admin/command-centre` | `AdminCommandCentre.tsx` | Opportunity intelligence — combined prospect + lead view |
| `/admin/manufacturer-messaging` | `AdminManufacturerMessaging.tsx` | WhatsApp outreach to manufacturers (Boke/Meiyi/Xitian routing) |
| `/admin/follow-up-sequences` | `AdminFollowUpSequences.tsx` | 4-stage automated email follow-up manager |
| `/admin/lease-signals` | `AdminLeaseSignals.tsx` | Commercial property lease signal scanner |
| `/admin/territory-scanner` | `AdminTerritoryScanner.tsx` | Geographic territory management |
| `/admin/procurement-engine` | `AdminProcurementEngine.tsx` | Cost / procurement calculator |
| `/admin/workspace-learning` | `AdminWorkspaceLearning.tsx` | AI workspace learning records (behaviour patterns) |
| `/admin/intelligence-hub` | `AdminIntelligenceHub.tsx` | BI scheduler — reports, trends, issues, blog generation |
| `/admin/profit-engine` | `AdminProfitEngine.tsx` | Margin optimisation, supplier mix, cost-stack analysis |
| `/admin/product-reviews` | `AdminProductReviews.tsx` | Product review moderation |
| `/admin/marketing` | `Marketing.tsx` | Marketing assets and campaign tools |

---

## 2. Database Tables (20 tables — `shared/schema.ts`)

| Table | Schema Line | Purpose |
|---|---|---|
| `users` | 6 | Auth users (reserved, not active in current build) |
| `leads` | 20 | All public form submissions — quote, layout, strategy, enquiry |
| `prospected_leads` | 51 | AI-prospected outbound leads from territory/lease scans. Status column holds 7-stage pipeline value |
| `territories` | 88 | Geographic territory definitions for scanner |
| `supplier_quotes` | 107 | Supplier pricing tracker — inbound manufacturer pricing (NOT client quotes) |
| `referrals` | 126 | Referral partner tracking |
| `planning_requests` | 141 | AI planning submissions — floor plans, AI recommendations, Stripe payment flag |
| `product_reviews` | 181 | Customer product reviews (moderated by admin) |
| `follow_up_sequences` | 205 | Automated 4-stage email follow-up records per lead |
| `workspace_learning_records` | 232 | AI-observed workspace preference patterns from submissions |
| `manufacturer_messages` | 266 | WhatsApp/message log to manufacturers |
| `scheduled_jobs` | 292 | BI intelligence scheduler job run log |
| `intelligence_reports` | 307 | Generated business intelligence reports |
| `spending_trends` | 319 | AI-analysed spending trend snapshots |
| `website_issues` | 332 | AI-detected website / SEO issues |
| `profit_records` | 347 | Profit optimisation calculation records |
| `quotes` | 376 | **Formal client quotes** — TCD-YYYYMM-XXXX auto-numbering, items stored as JSON |
| `generated_blog_articles` | 410 | AI-generated SEO blog articles |

---

## 3. API Routes (103 endpoints — `server/routes.ts`)

### Public / Customer

| Method | Route | Line | Purpose |
|---|---|---|---|
| GET | `/api/health` | 277 | System health + email/Stripe config check |
| GET | `/sitemap.xml` | 287 | Auto-generated XML sitemap |
| GET | `/api/products` | 327 | Full product catalogue |
| GET | `/api/products/categories` | 332 | Distinct product categories |
| GET | `/api/products/search` | 342 | Product search with filters |
| GET | `/api/products/grouped` | 571 | Products grouped by category |
| GET | `/api/products/:sku/size-variants` | 576 | Size variants for a product |
| GET | `/api/products/:sku/reviews` | 604 | Customer reviews for a product |
| POST | `/api/products/:sku/reviews` | 614 | Submit a product review |
| GET | `/api/products/by-supplier/:supplierId` | 368 | Products by supplier |
| GET | `/api/products/sku/:sku` | 382 | Single product by SKU |
| GET | `/api/products/series/:series` | 401 | Products by series |
| GET | `/api/suppliers` | 358 | All suppliers |
| GET | `/api/catalog/metadata` | 598 | Catalogue metadata summary |
| POST | `/api/leads` | 656 | Submit any public lead form |
| GET | `/api/leads` | 761 | All leads (admin context) |
| POST | `/api/finance-lead` | 771 | Finance application — Stratton/QPF/Vestone routing |
| POST | `/api/estimate` | 886 | Instant project cost estimate |
| POST | `/api/chat` | 1045 | AI planning assistant chat |
| POST | `/api/planning-requests` | 1334 | Submit an AI planning request |
| GET | `/api/planning-requests/:id/layout` | 2625 | Get layout data for a planning request |
| POST | `/api/planning-requests/:id/checkout` | 2254 | Stripe checkout for planning request |
| GET | `/api/planning-requests/:id/verify-payment` | 2312 | Verify payment status |
| GET | `/api/manufacturers` | 2501 | All manufacturer profiles |
| POST | `/api/whatsapp/send` | 2530 | Send WhatsApp message to manufacturer |
| GET | `/api/manufacturer-messages` | 2571 | WhatsApp / message log |
| POST | `/api/ai/draft-manufacturer-message` | 2581 | AI-draft manufacturer outreach message |

### Admin — Leads & Deal Pipeline

| Method | Route | Line | Purpose |
|---|---|---|---|
| GET | `/api/admin/prospects` | 1121 | All prospected leads |
| GET | `/api/admin/prospects/adapters` | 1130 | Available scan adapters |
| POST | `/api/admin/prospect` | 1134 | Run single prospect scan |
| POST | `/api/admin/prospects/batch-scan` | 1209 | Batch territory scan |
| PATCH | `/api/admin/prospects/:id/status` | 1296 | **Update pipeline stage** — accepts all 7 stages + legacy statuses |
| DELETE | `/api/admin/prospects/:id` | 1312 | Delete a prospect |
| GET | `/api/admin/pipeline-stats` | 1594 | Planning request pipeline statistics |
| GET | `/api/admin/opportunity-intelligence` | 1741 | Combined inbound + outbound opportunity view |
| GET | `/api/admin/deal-forecast` | 3086 | **Revenue forecast** — gross pipeline, weighted expected revenue, probable deals ≥60%, won value, win rate |

### Admin — Planning Requests

| Method | Route | Line | Purpose |
|---|---|---|---|
| GET | `/api/admin/planning-requests` | 1983 | All planning submissions |
| GET | `/api/admin/planning-requests/:id` | 1992 | Single planning request |
| PATCH | `/api/admin/planning-requests/:id/status` | 2002 | Update status |
| PATCH | `/api/admin/planning-requests/:id` | 2018 | Update fields |
| POST | `/api/admin/planning-requests/:id/revise` | 2030 | AI re-run with revised brief |
| DELETE | `/api/admin/planning-requests/:id` | 2148 | Delete planning request |
| POST | `/api/admin/planning-requests/backfill-scores` | 1883 | Backfill AI lead scores |
| POST | `/api/admin/planning-requests/:id/generate-floor-plan` | 2169 | Generate 2D floor plan layout |

### Admin — Formal Quotes

| Method | Route | Line | Purpose |
|---|---|---|---|
| GET | `/api/admin/quotes` | 3144 | All formal client quotes |
| GET | `/api/admin/quotes/:id` | 3154 | Single quote |
| POST | `/api/admin/quotes` | 3164 | Create new formal quote |
| PATCH | `/api/admin/quotes/:id` | 3180 | Update quote |
| DELETE | `/api/admin/quotes/:id` | 3190 | Delete quote |
| POST | `/api/admin/quotes/:id/send` | 3199 | Send formal quote PDF via email |

### Admin — Supplier Quotes

| Method | Route | Line | Purpose |
|---|---|---|---|
| GET | `/api/admin/supplier-quotes` | 2369 | All supplier quotes |
| POST | `/api/admin/supplier-quotes` | 2378 | Create supplier quote |
| PATCH | `/api/admin/supplier-quotes/:id/status` | 2406 | Update supplier quote status |
| PATCH | `/api/admin/supplier-quotes/:id` | 2422 | Update supplier quote fields |
| DELETE | `/api/admin/supplier-quotes/:id` | 2433 | Delete supplier quote |

### Admin — Product Reviews

| Method | Route | Line | Purpose |
|---|---|---|---|
| GET | `/api/admin/product-reviews` | 630 | All product reviews |
| PATCH | `/api/admin/product-reviews/:id` | 637 | Approve / reject review |
| DELETE | `/api/admin/product-reviews/:id` | 649 | Delete review |

### Admin — Referrals

| Method | Route | Line | Purpose |
|---|---|---|---|
| GET | `/api/admin/referrals` | 2445 | All referrals |
| POST | `/api/admin/referrals` | 2454 | Create referral |
| PATCH | `/api/admin/referrals/:id/status` | 2473 | Update referral status |
| DELETE | `/api/admin/referrals/:id` | 2489 | Delete referral |

### Admin — Territories & Lease Signals

| Method | Route | Line | Purpose |
|---|---|---|---|
| GET | `/api/admin/territories` | 2715 | All territories |
| POST | `/api/admin/territories` | 2723 | Create territory |
| PATCH | `/api/admin/territories/:id` | 2732 | Update territory |
| DELETE | `/api/admin/territories/:id` | 2741 | Delete territory |
| POST | `/api/admin/lease-signal-scan` | 2653 | Run lease signal scan |

### Admin — Procurement & Profit

| Method | Route | Line | Purpose |
|---|---|---|---|
| POST | `/api/admin/procurement/calculate` | 2752 | Procurement cost calculation |
| POST | `/api/admin/profit/compare` | 3005 | Margin comparison |
| POST | `/api/admin/profit/cost-stack` | 3019 | Full cost-stack analysis |
| POST | `/api/admin/profit/supplier-mix` | 3033 | Supplier mix optimisation |
| GET | `/api/admin/profit/layout-patterns` | 3047 | Layout pattern benchmarks |
| GET | `/api/admin/profit/records` | 3057 | Saved profit records |
| POST | `/api/admin/profit/records` | 3066 | Save profit record |
| PATCH | `/api/admin/profit/records/:id` | 3075 | Update profit record |
| GET | `/api/admin/supplier-pricing` | 2873 | Supplier pricing history |
| POST | `/api/admin/supplier-pricing/record` | 2884 | Record supplier pricing |

### Admin — Follow-Up Sequences

| Method | Route | Line | Purpose |
|---|---|---|---|
| GET | `/api/admin/follow-up-sequences` | 2767 | All follow-up sequences |
| PATCH | `/api/admin/follow-up-sequences/:id/pause` | 2777 | Pause sequence |
| PATCH | `/api/admin/follow-up-sequences/:id/resume` | 2787 | Resume sequence |
| PATCH | `/api/admin/follow-up-sequences/:id/stop` | 2797 | Stop sequence |
| PATCH | `/api/admin/follow-up-sequences/:id/mark-replied` | 2807 | Mark replied |

### Admin — Workspace Learning

| Method | Route | Line | Purpose |
|---|---|---|---|
| GET | `/api/admin/workspace-learning` | 2819 | All learning records |
| GET | `/api/admin/workspace-learning/:id` | 2828 | Single record |
| PATCH | `/api/admin/workspace-learning/:id/conversion` | 2838 | Mark conversion |
| GET | `/api/admin/workspace-learning/stats/summary` | 2848 | Learning stats summary |

### Admin — Intelligence (BI Scheduler)

| Method | Route | Line | Purpose |
|---|---|---|---|
| GET | `/api/admin/intelligence/jobs` | 2904 | All scheduled job runs |
| POST | `/api/admin/intelligence/jobs/trigger` | 2913 | Manually trigger a job |
| GET | `/api/admin/intelligence/reports` | 2924 | Generated BI reports |
| PATCH | `/api/admin/intelligence/reports/:id/status` | 2934 | Update report status |
| GET | `/api/admin/intelligence/trends` | 2944 | Spending trends |
| GET | `/api/admin/intelligence/issues` | 2953 | Detected website issues |
| PATCH | `/api/admin/intelligence/issues/:id/status` | 2963 | Update issue status |
| GET | `/api/admin/intelligence/blog-articles` | 2973 | Generated blog articles |
| PATCH | `/api/admin/intelligence/blog-articles/:id/status` | 2983 | Publish / reject article |
| GET | `/api/admin/intelligence/health` | 2993 | Latest system health report |

---

## 4. Email Functions (13 — `server/email.ts`)

| Function | Line | Trigger | Recipients |
|---|---|---|---|
| `sendLeadNotification` | 164 | Any lead form submission | Admin |
| `sendPlanningRequestNotification` | 232 | Planning submission | Admin |
| `sendSupplierQuoteNotification` | 294 | New supplier quote | Admin |
| `sendPaymentConfirmationNotification` | 337 | Stripe payment success | Admin |
| `sendPlannerSubmissionCustomerEmail` | 396 | Planning submission | Customer |
| `sendQuoteRequestCustomerEmail` | 456 | Quote request | Customer |
| `sendStrategyCallCustomerEmail` | 508 | Strategy call booking | Customer |
| `sendEnquiryCustomerEmail` | 576 | Contact/enquiry | Customer |
| `sendFinanceLeadAdminEmail` | 604 | Finance application | Admin |
| `sendFinanceLeadPartnerEmail` | 652 | Finance application | Finance partner (routed by deal size) |
| `sendFinanceLeadCustomerEmail` | 721 | Finance application | Customer |
| `sendFormalQuoteEmail` | 765 | Admin sends formal quote | Customer (PDF layout) |
| `isEmailConfigured` | 861 | Utility check | — |

**FROM address:** `The Corporate Desk <onboarding@resend.dev>`
**Admin alerts to:** `thecorporatedeskservice@gmail.com`

**Finance partner routing:**
- Default (Stratton) → Katherine + Chris
- QPF (≥$200k deal) → Katelyn
- Vestone → Cassie

---

## 5. Backend Services (11 files — `server/services/`)

| File | Purpose |
|---|---|
| `floorPlanParser.ts` | Computer-vision floor plan parser — Canny edge detection, contour tracing, convex hull, Douglas-Peucker simplification, internal wall detection, AI dimension estimation |
| `followUpEmails.ts` | 4-stage follow-up email template engine — per-stage subject/body, delay scheduling |
| `followUpScheduler.ts` | Cron-based follow-up runner — polls DB every hour, sends due emails, advances stages |
| `intelligenceEngine.ts` | BI engine — spending trend analysis, SEO blog generation, website issue detection, system health checks, weekly reports |
| `intelligenceScheduler.ts` | Cron scheduler for intelligence jobs — health(12h), trends(24h), issues(24h), SEO(7d), report(7d) |
| `leadIntelligence.ts` | AI lead scoring + enrichment — signal detection, deal probability assignment, outreach generation |
| `leaseSignalScanner.ts` | Commercial property lease signal scanner — detects office move/expansion signals |
| `opportunityScoring.ts` | Opportunity scoring formula — converts planning request fields into 0–100 lead scores |
| `profitOptimisation.ts` | Margin engine — cost stacks, supplier mix comparison, category benchmarks (`category_benchmarks` is an object, use `getRawBenchmarks()`) |
| `whatsapp.ts` | WhatsApp Business API — manufacturer routing: Boke→seating; Meiyi/Asya→desks/workstations; Xitian/Ruby→reception/executive/custom |
| `workspaceLearning.ts` | Workspace behaviour learning — pattern extraction and storage from planning submissions |

---

## 6. Key Shared Files

| File | Lines | Purpose |
|---|---|---|
| `shared/schema.ts` | 425 | All Drizzle ORM table definitions + Zod insert schemas |
| `server/storage.ts` | 924 | `IStorage` interface + `DrizzleStorage` class (all DB queries) |
| `server/routes.ts` | 3,216 | All 103 Express API route handlers |
| `server/email.ts` | 863 | All Resend email functions |
| `client/src/lib/furnitureCatalogue.ts` | — | Static product catalogue (DO NOT MODIFY) |
| `client/src/lib/adminAuth.ts` | — | Admin session auth helper |
| `client/src/lib/queryClient.ts` | — | TanStack Query client + `apiRequest` helper |

---

## 7. Admin Authentication

- **Email:** `admin@thecorporatedesk.com.au`
- **Password:** `Jaymin12!/`
- **Storage:** `sessionStorage` key `tcd_admin_auth` = `"email:password"`
- Every admin page checks this on mount via `useEffect` → `validateAdminLogin()`
- No backend session — purely client-side guard

---

## 8. Deal Pipeline — 7 Stages (Phase 10)

| Stage | Probability | Badge colour |
|---|---|---|
| Lead Detected | 10% | White/dim |
| Contacted | 25% | Blue |
| Planning | 40% | Violet |
| Quoted | 60% | Amber |
| Negotiation | 80% | Orange |
| Won | 100% | Green |
| Lost | 0% | Red |

**Legacy status backward-compatibility map:**

| Old status | Maps to |
|---|---|
| `New` | Lead Detected |
| `Responded` | Contacted |
| `Qualified` | Planning |
| `Closed` | Won |

Probability is auto-assigned by stage in the Kanban. Move-stage dropdown on each card triggers `PATCH /api/admin/prospects/:id/status`.

---

## 9. Revenue Forecasting (Phase 11)

**API:** `GET /api/admin/deal-forecast` (line 3086, `server/routes.ts`)

| Metric | Formula |
|---|---|
| Gross Pipeline | Sum of `estimatedProjectValue` for all non-Lost leads |
| Weighted Expected Revenue | Sum of (value × stage_probability / 100) across all leads |
| Probable Deals | Count of leads at ≥60% stage probability (Quoted / Negotiation / Won) |
| Won Revenue | Sum of value for Won + Closed leads |
| Win Rate | Won ÷ (Won + Lost) × 100 |

**Shown in two places:**
1. `/admin/dashboard` → "Revenue Forecast" panel (right column, replaces old Pipeline Breakdown)
2. `/admin/deal-pipeline` → 5 KPI tiles above the Kanban (live, filtered by city selection)

---

## 10. Formal Quote System (Phase 9)

- Auto quote numbers format: `TCD-YYYYMM-XXXX` (e.g. `TCD-202603-0001`)
- Quote items stored as JSON string in `quotes.items` DB column
- PDF/print at `/admin/quotes/:id/print` (`QuotePrint.tsx`) — A4 TCD-branded layout
- "Send" button triggers `sendFormalQuoteEmail()` → customer receives branded email with quote details
- "Create Formal Quote" button in `/admin/planning-requests` pre-populates client details
- Statuses: `Draft` → `Sent` → `Accepted` / `Declined`

---

## 11. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Routing | wouter |
| Data fetching | TanStack Query v5 |
| Backend | Node.js, Express, TypeScript (tsx) |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Replit managed) |
| AI | OpenAI GPT-4o |
| Email | Resend (`onboarding@resend.dev`) |
| Payments | Stripe |
| WhatsApp | WhatsApp Business API |
| 3D rendering | Three.js (React Three Fiber) |
| PDF output | Browser print CSS — A4 layout |
| Icons | lucide-react, react-icons/si |

---

## 12. Critical Rules (Do Not Break)

| Rule | Detail |
|---|---|
| **Never modify** | `server/db.ts`, `client/src/lib/furnitureCatalogue.ts`, `package.json`, `client/src/pages/QuoteBuilder.tsx` |
| **URL query params** | Use `window.location.search` — NOT `useLocation()` |
| **DB migrations** | Run `npm run db:push` after any `shared/schema.ts` change |
| **Profit engine** | `category_benchmarks` is an object — use `getRawBenchmarks()` and `getBenchmarkRaw()` helpers, not array methods |
| **ProspectedLead status** | Must update BOTH: the union type in `server/storage.ts` line 39 AND the `validStatuses` array in `server/routes.ts` line 1303 |
| **supplierQuotes table** | Supplier-facing pricing only — not for client quotes |
| **quotes table** | Client-facing formal quotes only — items as JSON text, never reuse for supplier pricing |
| **Admin auth** | `tcd_admin_auth` in `sessionStorage` — no backend session token |

---

*Last updated: March 12, 2026 — all 16 phases complete, post Phase 10 (7-stage pipeline) + Phase 11 (revenue forecasting) implementation*
