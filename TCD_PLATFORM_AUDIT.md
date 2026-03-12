# The Corporate Desk — Full Platform Audit
**thecorporatedesk.com.au**
*Audit Date: March 2026*

---

## Platform Overview

The Corporate Desk is a luxury commercial office furniture platform built as a complete AI-powered business operating system. It targets enterprise and mid-market companies requiring office fit-outs valued between $30,000 and $300,000+. The platform handles the full commercial cycle: lead capture, AI qualification, workspace planning, formal quoting, supplier procurement, finance referral, and customer communication — all from one admin interface.

**Stack:** React + Express.js + PostgreSQL + Drizzle ORM + OpenAI GPT + Resend (email) + Stripe (payments) + Three.js (3D) + Playwright (testing)

**Design Language:** Dark luxury gold. Near-black backgrounds (`#0f0f13`), gold accents (`#C9A84C`), cream white text, Playfair Display serif headings, Inter body — inspired by Apple/Herman Miller premium minimalism.

**Codebase Scale:** 25,000+ lines across 35 frontend pages, 95 API routes, 18 database tables, 12 email functions, 11 backend services.

---

## Database — 18 Tables

| Table | Purpose |
|---|---|
| `users` | Auth accounts |
| `leads` | Inbound customer leads (all sources) |
| `prospected_leads` | AI-prospected outbound company targets |
| `territories` | Office tower / commercial precinct definitions |
| `supplier_quotes` | Supplier-facing RFQ tracker |
| `referrals` | Finance partner referral tracking |
| `planning_requests` | AI Workspace Planner submissions |
| `product_reviews` | Customer product reviews |
| `follow_up_sequences` | Automated email follow-up state per lead |
| `workspace_learning_records` | AI pattern data from past projects |
| `manufacturer_messages` | WhatsApp message log per supplier |
| `scheduled_jobs` | Background intelligence job execution log |
| `intelligence_reports` | Weekly AI business reports |
| `spending_trends` | Market pricing trend records by category |
| `website_issues` | AI-detected site issues with severity |
| `profit_records` | Per-package margin and cost stack history |
| `quotes` | Formal client-facing quotations |
| `generated_blog_articles` | AI-drafted SEO blog content |

---

## Public-Facing Website

### Home Page — `/`
**File:** `client/src/pages/Home.tsx` (552 lines)

Premium landing page with hero section, value proposition grid, product category showcase, case study highlights, trust signals, AI Workspace Concierge orb, and CTAs driving to the planner, quote builder, and finance tools.

---

### Product Catalogue — `/products`
**File:** `client/src/pages/Products.tsx` (650 lines)

Live catalogue of **330 SKUs** across 5 supplier collections presented with cleaned public brand names (internal supplier names never exposed). Features:
- Category filter tabs (Executive Desks, Workstations, Seating, Reception, Storage, Accessories)
- Series sub-filter for each collection
- Star rating display from customer reviews
- Price range indicators

**Brand name mapping** (internal → public):
- Boke → Fessenz Design Collection
- Meiyi/Asya → Presidia Executive Collection
- Xitian/Ruby → Royale Workspace Series

---

### Product Detail Pages — `/products/:sku`
**File:** `client/src/pages/ProductDetail.tsx` (872 lines)

Individual product pages with:
- Image gallery with variant selectors (size, finish, fabric)
- Full specification table
- Customer review section with star ratings
- Related products grid
- Add to quote / enquire CTAs
- JSON-LD structured data for SEO

---

### AI Quote Builder — `/quote-builder`
**File:** `client/src/pages/QuoteBuilder.tsx` (1,153 lines)

Public-facing 4-step commercial estimator wizard. NOT the admin quote tool — this is the customer self-service tool. Generates a `QuoteSummary` document containing:
- Bill of Quantities (BOQ)
- GST breakdown
- Per-zone furniture recommendations
- Finance option (monthly estimate)
- Upsell opportunities
- Workspace zone descriptions
- Recommended next steps

Steps: Office details → Style preferences → Product selection → Summary + send.

---

### AI Workspace Planner — `/free-office-layout-plan`
**File:** `client/src/pages/FreeLayoutPlan.tsx`

Free workspace planning submission form. Collects:
- Office size (m²), staff count, budget range
- Style direction, workspace zones needed
- Floor plan upload (optional)
- Contact details

On submission: creates a `planning_request` record, triggers AI plan generation, fires a customer confirmation email and admin alert. The full AI plan is generated on the backend using GPT with the TCD furniture catalogue and workspace learning data as context.

**Paywall:** Full 8-section report + 3D walkthrough gated at **$399 AUD** via Stripe.

---

### 3D Office Walkthrough — `/3d-office-walkthrough`
**File:** `client/src/pages/OfficeWalkthrough.tsx` (1,289 lines)

Interactive Three.js viewer rendering office zones and furniture placement from the AI plan. Features:
- Real-time raycasting for product info on hover/click
- Zone colour coding (executive, collaborative, reception, storage)
- Orbit controls + zoom
- Product specification pop-up on furniture click
- Camera presets (overhead, front, corner views)

---

### Floor Plan Upload — `/upload-your-floor-plan`
**File:** `client/src/pages/UploadFloorPlan.tsx` (1,392 lines)

Computer vision pipeline for floor plan analysis:
1. User uploads an image of their floor plan
2. `floorPlanParser.ts` extracts boundary geometry, room counts, internal wall detections
3. Detected geometry feeds into the AI plan generator for more accurate zone placement
4. Returns zone layout with proportional sizing based on actual detected dimensions

---

### Finance Calculator — `/finance-your-workspace`
**File:** `client/src/pages/FinanceWorkspace.tsx` (572 lines)

Commercial finance enquiry tool with:
- Monthly repayment estimator (configurable loan term and rate)
- Finance partner routing logic:
  - Stratton Finance (default) → contacts Katherine + Chris
  - QPF (≥$200k projects) → Katelyn
  - Vestone → Cassie
- Sends 3 emails on submission: customer confirmation, admin alert, partner notification
- Legal disclaimer: indicative only, not a finance offer

---

### Send Us Your Quote — `/send-us-your-quote`
**File:** `client/src/pages/SendQuote.tsx`

Upload-your-quote lead form accepting competitor quotes, BOQs, or project briefs. Triggers admin notification with file attachment context.

---

### Workplace Strategy — `/workplace-strategy`
**File:** `client/src/pages/WorkplaceStrategy.tsx`

Strategy consultation request form for large-scale projects. Generates a customer email and internal alert.

---

### Workplace Solutions — `/workplace-solutions`
**File:** `client/src/pages/WorkplaceSolutions.tsx`

Content page: open plan, private office, reception, boardroom, collaborative, training room solutions with imagery and CTAs.

---

### SEO Blog — `/blog`, `/blog/:slug`
**Files:** `client/src/pages/Blog.tsx`, `BlogPost.tsx`

Dynamic blog with:
- Search across all articles
- Category filter tabs
- Pagination (10 per page)
- Article detail with author, date, read time, tags
- JSON-LD Article structured data
- Content served from DB (`generated_blog_articles` table — AI-drafted)

---

### Case Studies — `/case-studies`
**File:** `client/src/pages/CaseStudies.tsx`

Portfolio of completed projects with industry, size, budget, and before/after content.

---

### Testimonials — `/testimonials`
**File:** `client/src/pages/Testimonials.tsx`

Customer review showcase page with star ratings, company, and project value.

---

### About, Contact, Thank-You Pages
Standard informational and conversion pages. Three thank-you variants: layout plan, quote, strategy.

---

## AI Workspace Concierge (Persistent Cross-Page)

**Files:** `client/src/components/ChatBot.tsx`, `client/src/contexts/ConciergeContext.tsx`, `server/systemPrompt.ts`, `/api/chat`

A premium floating AI advisor present on every page of the site. Key features:

- **14-role business OS** — the AI adopts different specialist personas (workspace designer, commercial estimator, finance advisor, product specialist, etc.) depending on context
- **Page-aware behaviour** — receives `pageContext` signal, adjusts greeting and quick replies per page (8 page-specific quick reply sets)
- **User profile memory** — learns and persists user's m², staff count, budget, style preference, suburb across the entire session via sessionStorage
- **Animated orb trigger** — pulsing gold orb in the bottom-right corner
- **CTA cards** — page-specific action cards (e.g. "Get Your Floor Plan" on product pages, "Calculate Finance" on quote pages)
- **Conversation persistence** — full history survives navigation within the session
- **Backend:** `buildChatSystemPrompt()` in `systemPrompt.ts` injects page context, user profile, and the full TCD furniture catalogue into the GPT system prompt

---

## Admin Dashboard — `/admin/dashboard`

**File:** `client/src/pages/AdminDashboard.tsx` (718 lines)
**Auth:** `admin@thecorporatedesk.com.au` / `Jaymin12!/` (stored in sessionStorage `tcd_admin_auth`)

Central command hub. Features:
- **8 KPI cards:** Total Leads, Hot Leads (score ≥70), Planning Requests, Quote Leads, Active Sequences, Finance Referrals, Workspace Plans Generated, Total Pipeline Value
- **"Needs Your Attention" action banner** — surfaces urgent items requiring action
- **Hot Leads sidebar** — lists all leads with opportunity score ≥70 in real time
- **Pipeline Breakdown** — value distribution by lead type
- **Intelligence Engine status widget** — shows last run time of each background job
- **Quick Actions list** — 17 direct links to every admin tool

---

## Admin Tools — Complete List

### 1. Planning Requests — `/admin/planning-requests`
**File:** `client/src/pages/AdminPlanningRequests.tsx` (1,456 lines)

The primary workspace planning console. 7-tab deep-dive per request:

| Tab | Content |
|---|---|
| **Overview** | Full brief, contact, office details, budget, urgency |
| **AI Plan** | Zone breakdown, workspace analysis, AI-generated layout |
| **Package & Quote** | AI furniture package (tier), product schedule, cost summary, finance option, upsell opportunities. Includes **"Create Formal Quote"** gold button linking to the quote builder pre-filled with this client's data |
| **Profit Intelligence** | Live 3-tier cost stack analysis (Premium/Balanced/Value), margin health badges, supplier mix breakdown, AI recommendation, finance framing |
| **Supplier** | WhatsApp routing, supplier assignment, procurement notes |
| **Report** | 8-section premium report view |
| **Admin** | Internal notes, status management, lead score, AI revise button |

**Key feature:** "Regenerate AI Plan" re-runs the full GPT package generator and auto-saves a profit record to `profit_records` with landed cost, margin %, and supplier mix.

---

### 2. Lead Intelligence — `/admin/leads`
**File:** `client/src/pages/AdminLeads.tsx` (1,049 lines)

Dual-mode lead management:

**Inbound Leads tab:**
- Full lead list with opportunity score badges (0–100), tier assignment (Hot/Warm/Cool/Cold)
- Score breakdown by signal type (11 signals including budget, urgency, company size, intent language)
- Lead detail expansion: full profile, AI analysis, email history
- Status management (New / In Progress / Quoted / Won / Lost)
- Manual trigger for AI enrichment

**Prospected Leads tab (AI Outbound Engine):**
- AI-generated outbound company targets
- Industry filter, location filter, score filter
- Trigger WhatsApp outreach or email sequence per prospect
- Territory-linked prospecting

---

### 3. Formal Quotes — `/admin/quotes`
**File:** `client/src/pages/AdminQuotes.tsx` (882 lines)

Complete formal quotation management system:

**List View:**
- 5 KPI cards: Total Quotes, Draft/Ready, Sent, Accepted, Pipeline Value
- Filter tabs (All / Draft / Ready / Sent / Accepted / Declined / Expired)
- Search by name, company, email, quote number
- Row actions: Edit, Print/PDF, Delete

**Quote Editor:**
- **Client Details:** Name, company, email, phone, office size, staff count, project summary
- **Line Items table:** Inline editable rows — product name, variant, category, qty, unit price → auto-calculates line total. Add/remove rows
- **Additional Costs:** Freight & Delivery, Installation, Other Costs, Discount
- **Live Totals panel:** Subtotal, each cost line, GST (10%), **Total inc. GST**, finance estimate (÷60 months)
- **Quote Settings:** Validity days, Prepared By
- **Status selector:** Draft → Ready → Sent → Accepted / Declined / Expired
- **Actions:** Save, Print/PDF (opens print view in new tab), Send to Client (saves then emails)

**Auto quote numbering:** `TCD-YYYYMM-XXXX` (e.g. `TCD-202603-0001`)

**Pre-fill from Planning Request:** When arriving via "Create Formal Quote" button from `/admin/planning-requests`, the editor auto-populates with the client's name, company, email, phone, office size, and staff count from the planning request.

---

### 4. Quote Print View — `/admin/quotes/:id/print`
**File:** `client/src/pages/QuotePrint.tsx`

A4-formatted browser print view. Opens in a new tab. Click "Print / Save as PDF" to produce a PDF via the browser's native print dialog.

Layout:
- **Header:** Dark TCD branding, quote number, issue date, valid until date
- **Client block:** Name, company, email, phone
- **Project block:** Office size, staff count, project summary
- **Itemised Schedule of Works table:** Description, category, qty, unit price, line total — alternating row shading, gold column headers on dark background
- **Totals section:** Subtotal, freight, install, other, discount, GST, **Total inc. GST** in gold
- **Finance Option panel:** Monthly estimate highlighted (if applicable)
- **Notes / Conditions panel** (if populated)
- **Terms & Conditions:** 7 standard terms
- **Acceptance block:** Signature line, name, position, date
- **Footer:** TCD contact details, quote reference
- `@media print` CSS hides the browser toolbar — clean PDF output

---

### 5. Supplier Quotes — `/admin/supplier-quotes`
**File:** `client/src/pages/AdminSupplierQuotes.tsx` (729 lines)

Supplier-facing RFQ tracker (separate from client formal quotes). Manage outbound quote requests to suppliers, track status, record pricing. Includes referral partner management.

---

### 6. Manufacturer Messaging — `/admin/manufacturer-messaging`
**File:** `client/src/pages/AdminManufacturerMessaging.tsx` (636 lines)

WhatsApp communication system with furniture suppliers:

**Routing rules (strictly enforced):**
- Boke → seating products ONLY
- Meiyi / Asya → desks and workstations ONLY
- Xitian / Ruby → reception, executive, and custom ONLY

**Features:**
- AI-drafted WhatsApp messages with product context
- Message history log per supplier
- Product enquiry routing validation
- WhatsApp Business API integration

---

### 7. Follow-Up Sequences — `/admin/follow-up-sequences`
**File:** `client/src/pages/AdminFollowUpSequences.tsx`

Admin view of automated 4-stage email follow-up sequences triggered for every inbound lead:
- Stage 1 (Day 1): Personalised acknowledgement
- Stage 2 (Day 3): Value add + social proof
- Stage 3 (Day 7): Urgency + offer
- Stage 4 (Day 14): Final soft close

Tailored by lead type (Quote Builder, Planner, Strategy, Finance). Monitor status, pause/resume sequences, view email content sent.

---

### 8. Lease Signal Scanner — `/admin/lease-signals`
**File:** `client/src/pages/AdminLeaseSignals.tsx`

AI-powered engine scanning for office move signals:
- Companies advertising relocations, new office announcements, hiring surges
- Signal strength scoring per company
- One-click outreach trigger
- Filtered by suburb, industry, signal type

---

### 9. Deal Pipeline — `/admin/deal-pipeline`
**File:** `client/src/pages/AdminDealPipeline.tsx`

Kanban-style pipeline for prospected leads:
- Stages: Identified → Contacted → Engaged → Proposal → Won/Lost
- Weighted revenue forecast per stage
- Drag-to-stage (drag-and-drop)
- Total pipeline value in header

---

### 10. Territory Scanner — `/admin/territory-scanner`
**File:** `client/src/pages/AdminTerritoryScanner.tsx`

Track tenants in specific office towers and commercial precincts:
- Define territories (building name, suburb, total floors, known tenants)
- AI scan on demand → returns list of tenants with company type, estimated staff, lease signals
- Feed into prospected leads pipeline

---

### 11. Procurement Engine — `/admin/procurement-engine`
**File:** `client/src/pages/AdminProcurementEngine.tsx`

Supplier routing calculator for project fulfillment:
- Input product list from a quote or planning request
- Engine applies routing rules per product category
- Returns: supplier assignment per line item, landed cost estimate, lead time, total cost
- Validates against supplier capability rules

---

### 12. Workspace Learning — `/admin/workspace-learning`
**File:** `client/src/pages/AdminWorkspaceLearning.tsx`

AI pattern intelligence captured from every completed planning request:
- Records: office size, headcount, zone mix, style direction, budget, product categories
- Calibrates future AI recommendations with real project data
- Browse and filter past learning records
- Aggregate stats: average project value by size, most common zone configurations

---

### 13. Intelligence Hub — `/admin/intelligence-hub`
**File:** `client/src/pages/AdminIntelligenceHub.tsx` (607 lines)

Control panel for the Autonomous Business Intelligence Layer. 5 tabs:

| Tab | Content |
|---|---|
| **Job Engine** | Manually trigger any scheduled job, view full execution history with timing and results |
| **Business Reports** | Weekly AI-generated business reports — view, approve, publish to internal audience |
| **Spending Trends** | Market pricing intelligence by product category and week |
| **Website Issues** | AI-detected site problems with severity rating (Critical/High/Medium/Low), mark as resolved |
| **SEO Articles** | AI-drafted blog articles — review, edit, approve to publish or reject |

**Background jobs (auto-scheduled):**
| Job | Interval |
|---|---|
| System Health Check | Every 12 hours |
| Spending Trend Analysis | Every 24 hours |
| Website Issue Detection | Every 24 hours |
| SEO Blog Article Generation | Every 7 days |
| Weekly Business Report | Every 7 days |

---

### 14. Profit Engine — `/admin/profit-engine`
**File:** `client/src/pages/AdminProfitEngine.tsx`

AI Workspace Profit Optimisation Engine. 3 tabs:

**Package Comparator:** Input office size and staff count → returns live 3-tier analysis:
- Premium, Balanced, Value package breakdowns
- Landed cost, sell price, gross profit, margin % per item
- Margin health badge (Excellent / Good / Tight / Loss Risk)
- Supplier mix recommendation
- AI recommendation text

**Layout Profit Patterns:** 6 office archetypes with average margins:
- Startup Open Plan, Professional Services, Executive Suite, Corporate Enterprise, Creative Studio, Education/Training

**Profit Records:** Historical per-project margin tracking. Every plan regeneration in Planning Requests auto-saves a profit record here.

---

### 15. Lead Intelligence — `/admin/lead-intelligence` (same as `/admin/leads`)
Redirects to the Lead Intelligence page.

---

### 16. Product Reviews — `/admin/product-reviews`
**File:** `client/src/pages/AdminProductReviews.tsx`

Moderate customer product reviews:
- Approve / reject submitted reviews
- View star rating, reviewer name, product, content
- Approved reviews appear on product detail pages

---

### 17. Marketing Hub — `/admin/marketing`
**File:** `client/src/pages/Marketing.tsx` (780 lines)

AI content generation and multichannel publishing:
- Generate content for: Telegram, Facebook, Instagram, X/Twitter, WhatsApp Business
- AI drafts tailored to each channel's format and tone
- Direct post via API integrations
- Content calendar view
- Hashtag and caption generation

---

### 18. Command Centre — `/admin/command-centre`
**File:** `client/src/pages/AdminCommandCentre.tsx` (1,037 lines)

High-level operational overview combining:
- Live lead feed
- Sequence status board
- System health status
- Quick action shortcuts
- Alert queue

---

## Backend Services (11 Specialised Modules)

| Service | File | Purpose |
|---|---|---|
| **Opportunity Scoring** | `server/services/opportunityScoring.ts` | Deterministic 0–100 score from 11 signal types |
| **Lead Intelligence** | `server/services/leadIntelligence.ts` | AI enrichment of inbound and prospected leads |
| **Follow-Up Scheduler** | `server/services/followUpScheduler.ts` | Hourly cron: fires staged email sequences |
| **Follow-Up Emails** | `server/services/followUpEmails.ts` | 4-stage personalised email content by lead type |
| **WhatsApp** | `server/services/whatsapp.ts` | WhatsApp Business API with supplier routing enforcement |
| **Floor Plan Parser** | `server/services/floorPlanParser.ts` | Computer vision: boundary/wall detection from floor plan images |
| **Workspace Learning** | `server/services/workspaceLearning.ts` | Auto-capture and retrieval of past project patterns |
| **Profit Optimisation** | `server/services/profitOptimisation.ts` | Cost stack calculator with category benchmarks and margin analysis |
| **Intelligence Engine** | `server/services/intelligenceEngine.ts` | Executes all 5 intelligence job types |
| **Intelligence Scheduler** | `server/services/intelligenceScheduler.ts` | Background job scheduler (12h/24h/7d intervals) |
| **Lease Signal Scanner** | `server/services/leaseSignalScanner.ts` | AI scan for office move / relocation signals |

---

## AI Package Generator

**Files:** `server/ai/packageGenerator.ts`, `server/ai/knowledgeLoader.ts`, `server/ai/productIntelligence.ts`, `server/ai/supplierIntelligence.ts`

Generates complete furniture packages for any workspace brief:
- Reads the full 330-SKU TCD furniture catalogue via `knowledgeLoader`
- Selects products by category, style direction, budget, and zone requirements
- Enforces supplier routing rules per product type
- Outputs: `FurniturePackage` (items, zones, pricing, tier) + `QuoteSummary` (costs, finance, upsells)
- Integrates workspace learning data to calibrate recommendations from past projects

---

## Email System — 12 Functions

**File:** `server/email.ts` (863 lines)
**Provider:** Resend (`onboarding@resend.dev` sender, `thecorporatedeskservice@gmail.com` admin recipient)

| Function | Trigger | Recipient |
|---|---|---|
| `sendLeadNotification` | New inbound lead | Admin team |
| `sendPlanningRequestNotification` | Workspace planner submission | Admin team |
| `sendSupplierQuoteNotification` | New supplier quote | Admin team |
| `sendPaymentConfirmationNotification` | Stripe payment success | Admin team |
| `sendPlannerSubmissionCustomerEmail` | Workspace planner submitted | Customer |
| `sendQuoteRequestCustomerEmail` | Quote Builder submission | Customer |
| `sendStrategyCallCustomerEmail` | Strategy form submitted | Customer |
| `sendEnquiryCustomerEmail` | General enquiry | Customer |
| `sendFinanceLeadAdminEmail` | Finance enquiry | Admin team |
| `sendFinanceLeadPartnerEmail` | Finance enquiry | Finance partner (Stratton/QPF/Vestone) |
| `sendFinanceLeadCustomerEmail` | Finance enquiry | Customer |
| `sendFormalQuoteEmail` | Admin sends formal quote | Customer + admin notification |

All customer emails use a branded white template. All admin emails use a dark luxury gold template.

---

## API Routes — 95 Endpoints

Organised by domain:

| Domain | Routes |
|---|---|
| Chat / Concierge | `/api/chat` |
| Leads | `/api/leads`, `/api/leads/:id`, `/api/admin/leads`, scoring, enrichment |
| Prospected Leads | `/api/admin/prospected-leads`, batch prospecting, scoring |
| Planning Requests | `/api/planning-requests`, `/api/admin/planning-requests`, revise, report, payment |
| Supplier Quotes | `/api/admin/supplier-quotes` CRUD, referrals |
| Manufacturer Messaging | `/api/admin/manufacturer-messages` CRUD + WhatsApp send |
| Follow-Up Sequences | `/api/admin/follow-up-sequences` CRUD + trigger |
| Territories | `/api/admin/territories` CRUD + scan |
| Product Reviews | `/api/admin/product-reviews` CRUD + approve |
| Workspace Learning | `/api/admin/workspace-learning` CRUD + aggregate |
| Procurement | `/api/admin/procurement/route` |
| Intelligence | `/api/admin/intelligence/*` (jobs, reports, trends, issues, blog) |
| Profit Engine | `/api/admin/profit/*` (analyse, records) |
| Formal Quotes | `/api/admin/quotes` CRUD + `/api/admin/quotes/:id/send` |
| Blog | `/api/blog/articles`, `/api/blog/articles/:slug` |
| Products | `/api/products`, `/api/products/:sku` |
| Finance | `/api/finance/lead` |
| Stripe | `/api/create-payment-intent`, `/api/payment-webhook` |
| Marketing | `/api/marketing/generate`, `/api/marketing/post` |
| SEO | `/sitemap.xml`, `/robots.txt` |

---

## SEO Infrastructure

- `robots.txt` — allows all crawlers, references sitemap
- Dynamic `sitemap.xml` — auto-generates with all public pages, products (330 SKUs), and published blog posts
- JSON-LD structured data on: Home (Organisation), Product Detail (Product schema), Blog Post (Article schema)
- Unique `<title>` and `<meta description>` on every page
- Open Graph tags for social sharing

---

## Stripe Paywall

**Trigger:** AI Workspace Planner report access
**Price:** $399 AUD
**Flow:**
1. User completes free planner → receives preview (2-section report)
2. Stripe payment intent created → Stripe Elements checkout rendered inline
3. Payment confirmed → webhook fires → report unlocked in DB → full 8-section report + 3D walkthrough access granted
4. Customer receives payment confirmation email

---

## 8-Section Premium Planning Report

Each unlocked AI Workspace Planning Report contains:

1. **Executive Summary** — Project overview, key priorities, investment range
2. **2D Floor Plan** — SVG zone layout with proportional sizing based on detected floor plan geometry
3. **Zone Analysis** — Per-zone breakdown (purpose, furniture, capacity, adjacency notes)
4. **Furniture Schedule** — Full product schedule with SKUs, quantities, unit costs
5. **Style Direction** — Material palette, finish recommendations, mood board references
6. **Key Considerations** — Practical constraints, compliance notes, staging suggestions
7. **Finance Options** — Monthly estimates, partner options, total cost framing
8. **Next Steps** — Recommended action plan with timeline and contacts

---

## Admin Authentication

All admin pages share the same auth gate:
- **Email:** `admin@thecorporatedesk.com.au`
- **Password:** `Jaymin12!/`
- **Storage:** `sessionStorage` key `tcd_admin_auth`
- Pattern: check on mount, show login form if not authenticated, set key on success

---

## Key Routing Rules

### Supplier Product Routing
| Supplier | Allowed Product Categories |
|---|---|
| Boke | Seating ONLY |
| Meiyi | Desks, Workstations |
| Asya | Desks, Workstations |
| Xitian | Reception, Executive, Custom |
| Ruby | Reception, Executive, Custom |

### Finance Partner Routing
| Partner | Trigger | Contacts |
|---|---|---|
| Stratton Finance | Default (all projects) | Katherine + Chris |
| QPF Finance | Projects ≥ $200,000 | Katelyn |
| Vestone | Specific product categories | Cassie |

---

## Protected Files (Do Not Modify)

| File | Reason |
|---|---|
| `server/db.ts` | Core DB connection — breaking this breaks everything |
| `client/src/lib/furnitureCatalogue.ts` | 330-SKU catalogue — source of truth for product data |
| `package.json` | Dependency management — use package manager tools instead |
| `client/src/pages/QuoteBuilder.tsx` | Public customer estimator — separate from admin quote tool |

---

## File Reference Map

### Frontend Pages
| Page | Route | File |
|---|---|---|
| Home | `/` | `client/src/pages/Home.tsx` |
| Products | `/products` | `client/src/pages/Products.tsx` |
| Product Detail | `/products/:sku` | `client/src/pages/ProductDetail.tsx` |
| Quote Builder (public) | `/quote-builder` | `client/src/pages/QuoteBuilder.tsx` |
| AI Workspace Planner | `/free-office-layout-plan` | `client/src/pages/FreeLayoutPlan.tsx` |
| 3D Walkthrough | `/3d-office-walkthrough` | `client/src/pages/OfficeWalkthrough.tsx` |
| Floor Plan Upload | `/upload-your-floor-plan` | `client/src/pages/UploadFloorPlan.tsx` |
| Finance Calculator | `/finance-your-workspace` | `client/src/pages/FinanceWorkspace.tsx` |
| Send Your Quote | `/send-us-your-quote` | `client/src/pages/SendQuote.tsx` |
| Workplace Strategy | `/workplace-strategy` | `client/src/pages/WorkplaceStrategy.tsx` |
| Workplace Solutions | `/workplace-solutions` | `client/src/pages/WorkplaceSolutions.tsx` |
| Blog | `/blog` | `client/src/pages/Blog.tsx` |
| Blog Post | `/blog/:slug` | `client/src/pages/BlogPost.tsx` |
| Case Studies | `/case-studies` | `client/src/pages/CaseStudies.tsx` |
| Testimonials | `/testimonials` | `client/src/pages/Testimonials.tsx` |
| About | `/about` | `client/src/pages/About.tsx` |
| Contact | `/contact` | `client/src/pages/Contact.tsx` |
| Admin Dashboard | `/admin/dashboard` | `client/src/pages/AdminDashboard.tsx` |
| Planning Requests | `/admin/planning-requests` | `client/src/pages/AdminPlanningRequests.tsx` |
| Lead Intelligence | `/admin/leads` | `client/src/pages/AdminLeads.tsx` |
| Formal Quotes | `/admin/quotes` | `client/src/pages/AdminQuotes.tsx` |
| Quote Print / PDF | `/admin/quotes/:id/print` | `client/src/pages/QuotePrint.tsx` |
| Supplier Quotes | `/admin/supplier-quotes` | `client/src/pages/AdminSupplierQuotes.tsx` |
| Manufacturer Messaging | `/admin/manufacturer-messaging` | `client/src/pages/AdminManufacturerMessaging.tsx` |
| Follow-Up Sequences | `/admin/follow-up-sequences` | `client/src/pages/AdminFollowUpSequences.tsx` |
| Lease Signals | `/admin/lease-signals` | `client/src/pages/AdminLeaseSignals.tsx` |
| Deal Pipeline | `/admin/deal-pipeline` | `client/src/pages/AdminDealPipeline.tsx` |
| Territory Scanner | `/admin/territory-scanner` | `client/src/pages/AdminTerritoryScanner.tsx` |
| Procurement Engine | `/admin/procurement-engine` | `client/src/pages/AdminProcurementEngine.tsx` |
| Workspace Learning | `/admin/workspace-learning` | `client/src/pages/AdminWorkspaceLearning.tsx` |
| Intelligence Hub | `/admin/intelligence-hub` | `client/src/pages/AdminIntelligenceHub.tsx` |
| Profit Engine | `/admin/profit-engine` | `client/src/pages/AdminProfitEngine.tsx` |
| Product Reviews | `/admin/product-reviews` | `client/src/pages/AdminProductReviews.tsx` |
| Marketing Hub | `/admin/marketing` | `client/src/pages/Marketing.tsx` |
| Command Centre | `/admin/command-centre` | `client/src/pages/AdminCommandCentre.tsx` |

### Backend
| File | Purpose |
|---|---|
| `server/routes.ts` | All 95 API routes (3,155 lines) |
| `server/storage.ts` | Drizzle ORM storage layer — all DB CRUD (924 lines) |
| `server/email.ts` | 12 email functions with branded templates (863 lines) |
| `server/systemPrompt.ts` | AI Concierge system prompt builder |
| `server/marketing.ts` | Marketing channel posting logic |
| `server/static.ts` | Static file serving |
| `shared/schema.ts` | 18 DB table definitions + Zod schemas + types |

---

## Platform Statistics

| Metric | Count |
|---|---|
| Total frontend pages | 35 |
| Admin-only pages | 18 |
| Public-facing pages | 17 |
| Database tables | 18 |
| API endpoints | 95 |
| Email functions | 12 |
| Backend services | 11 |
| Product SKUs in catalogue | 330 |
| Total lines of code | 25,000+ |
| Supplier collections | 5 |
| Finance partners | 3 |

---

*Audit compiled March 2026. The Corporate Desk — thecorporatedesk.com.au*
