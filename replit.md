# The Corporate Desk — Premium Office Furniture Website

## Overview
The Corporate Desk project is a luxury office furniture website (`thecorporatedesk.com.au`) designed for lead generation. It features an AI-powered business operating system with 14 specialized roles, an interactive quote builder, a finance calculator, case studies, a marketing hub, an admin dashboard, an AI lead intelligence prospecting engine, and an AI Workspace Planning Platform. The platform provides visual zone layouts, furniture recommendations, project cost estimates, lead scoring, and downloadable planning reports, targeting a project value range of $30,000 – $300,000+.

## User Preferences
I prefer iterative development with clear, modular code. Before making any major architectural changes or introducing new external dependencies, please ask for approval. I prefer detailed explanations for complex solutions. Do not make changes to the `server/db.ts` file without explicit instruction. Do not make changes to the `client/src/lib/furnitureCatalogue.ts` file without explicit instruction.

## System Architecture
The application follows a client-server architecture.
- **Frontend**: Built with React, utilizing Wouter for routing, TanStack Query for data fetching, and Shadcn UI for components.
- **Backend**: Implemented using Express.js.
- **Database**: PostgreSQL with Drizzle ORM. The schema includes tables for users, leads, prospected leads, supplier quotes, referrals, planning requests, product reviews, manufacturer_messages, follow-up sequences, territories, and workspace_learning_records.
- **UI/UX Design**: The theme is dark luxury gold, featuring near-black backgrounds, rich gold accents (#C9A84C), and cream white text. Typography uses Playfair Display for headings and Inter for body text, inspired by Apple/Herman Miller's minimalist and premium aesthetic.
- **AI Integration**: OpenAI's `gpt-5-mini` model is used for the AI chatbot (14-role business OS), marketing content generation, and lead prospecting. AI prompts inject the TCD furniture catalogue for tailored recommendations.
- **Core Features**:
    - **Advanced Commercial Workspace Estimator** (`/quote-builder`): A 4-step wizard (Project, Requirements, Budget & Style, Contact) that calls `POST /api/estimate` on submission. The endpoint runs the same AI space-planning prompt as the AI Planner (reusing `buildSpacePlanningPrompt()`), then calls `generatePackageAndQuote()` to produce a formal `QuoteSummary` with BOQ, GST breakdown, finance option, upsells, and workspace zones. Results are displayed as a premium, full-page estimate output (bill of quantities table, investment summary, zone cards, CTAs). `estimateJson` is persisted to the `leads` table and is visible in the AdminDashboard when the lead is expanded.
    - **AI Workspace Planning Platform**: Generates detailed plans including lead scores, estimated project values, timelines, workspace zones, product recommendations, and cost breakdowns.
    - **AI Lead Intelligence & Prospecting Engine**: Ingests leads, uses AI to extract company details, needs, and signals, and includes deduplication logic and batch processing capabilities.
    - **Marketing Hub**: Enables AI-generated content creation and direct posting to various marketing channels.
    - **Admin Dashboard**: Provides KPIs, lead overviews, lead type breakdown charts, and admin functionalities.
    - **SEO Blog**: Client-side blog with 200 articles across 10 topic clusters, featuring search, category filters, and pagination.
    - **Opportunity Scoring Engine**: Deterministic signal model scoring inbound leads and planning requests (0–100) with tier assignment (high/medium/low) based on 11 signal types.
    - **Floor Plan Boundary Detection**: A deterministic computer vision pipeline to extract floor plan geometry from uploaded images (resizing, grayscale, Gaussian blur, Canny edge detection, background flood-fill, contour extraction, Douglas-Peucker simplification, Hough-style line scan for internal walls). Includes fallback mechanisms. **Geometry now fed into AI prompt** — detected shape (rectangle/L-shape/U-shape), aspect ratio, and internal wall count guide AI zone placement.
    - **Workspace Learning System** (`/admin/workspace-learning`): Auto-captures project intelligence from every AI Planner submission. Stores office size, headcount, zone mix, supplier routing, estimated cost, package tier, and conversion result (pending/paid/lost). Similar completed projects are fed back into the AI prompt context to calibrate future recommendations. Service: `server/services/workspaceLearning.ts`. DB table: `workspace_learning_records`.
    - **Supplier Pricing Records** (`server/data/supplierPricing.json`): Structured historical supplier pricing for 10 products across 4 suppliers (Boke, Meiyi, Xitian/Ruby, HSG). Includes FOB CNY price, landed AUD cost, sell price AUD, GM%, MOQ, and lead times. Category benchmark ranges for 10 product categories. Served via `GET /api/admin/supplier-pricing`. New records added via `POST /api/admin/supplier-pricing/record`.
    - **Stripe Paywall**: The AI Workspace Planning Report is gated behind a $399 AUD one-time payment. A free tier offers a blurred preview, while the paid tier unlocks the full SVG floor plan, zone cards, product SKUs, cost breakdown, and 3D walkthrough.
    - **Premium Report Structure (8 sections)**: Paid view now shows: §01 Executive Summary, §02 2D Floor Plan, §03 Zone Analysis, §04 Zone Breakdown, §05 Furniture Schedule, §06 Style Direction & Key Considerations, §07 Finance Options (Stratton/QPF/Vestone), §08 Next Steps + 3D Walkthrough. Each section has numbered labels and a confidential report header with client stats bar.
    - **3D Office Walkthrough**: An interactive Three.js 3D floor plan viewer (`/3d-office-walkthrough`) that renders office zones and furniture geometry, allowing raycasting for product information.
- **Admin Authentication**: Admin pages are protected by email and password login, storing authentication status in sessionStorage.
- **Product Catalogue**: A live catalogue (`server/data/productCatalog.json`) with 330 SKUs from 5 supplier collections. Products are served via:
  - `/api/products` — raw product data (used by AI planner)
  - `/api/products/grouped` — 293 grouped products with clean public names (strips supplier prefixes: Weiyi, Ruige, GOJO, etc.), merges size variants by series+category+baseName
  - `/api/products/:sku/size-variants` — size options for products with multiple dimensions
  - Products page (`/products`) uses the grouped endpoint, shows clean names without supplier branding, with "Available in X sizes" badges for variant products
  - Product detail (`/products/:sku`) shows cleaned name, size variant selector (choose 2400mm / 3200mm etc.), breadcrumb with clean name, and image gallery (thumbnail strip + main image; 257/293 products have 2+ images)
  - Series display names mapped in `client/src/lib/seriesDisplayNames.ts` (Weiyi→"Prestige Series", Ruige→"Director Series", LRU→"Executive Series", etc.) — all 65 series now mapped
  - Image gallery system: `SERIES_GALLERY` map in `server/routes.ts` assigns 2–4 images per series using available catalog images; enriched to both `/api/products/grouped` and `/api/products/sku/:sku` endpoints
  - Products page has series sub-filter tabs within each collection section (horizontal scrollable pills per series range)
  - Review system available on product detail pages

## Manufacturer Messaging System
Admin-only WhatsApp manufacturer communication system at `/admin/manufacturer-messaging`.

**Supplier Database** (`server/data/supplierDatabase.json`): Extended to 9 suppliers/manufacturers. Each has `category_specialization`, `routing_rules` (contact_for, do_not_contact_for, priority), and optionally `whatsapp_number` and `whatsapp_enabled`. The file also contains a `routing_logic` block defining AI supplier routing rules by product category.

**WhatsApp-enabled contacts:**
- **Boke Furniture** (BOKE) — `+8613392798732` — Seating ONLY. Never send desk/workstation requests.
- **Guangzhou Meiyi Furniture / Asya** (MEIYI) — `+8613422161319` — Primary for desks/workstations. Trusted contact.
- **Denny** (DENNY) — `+8613127968208` — Sourcing & coordination. Company name TBC.

**Pending confirmation:** Ella Office Furniture (Ms Ella), Xitian Furniture (Ruby) — WhatsApp numbers unknown.

**Routing Logic:**
- Seating → Boke (primary)
- Desks/workstations → Meiyi/Asya (primary), Xitian/Ruby (secondary for large/custom)
- Reception/custom/large → Xitian/Ruby (priority)
- Lounge/occasional → LSG / GJN
- Sit-stand → HSG

**API endpoints:**
- `GET /api/manufacturers` — All manufacturer contacts with routing rules + `whatsappConfigured` flag
- `POST /api/whatsapp/send` — Send via WhatsApp Cloud API (requires `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`). Logs every attempt to DB.
- `GET /api/manufacturer-messages` — Message log (filterable by manufacturerId)
- `POST /api/ai/draft-manufacturer-message` — AI drafts professional supplier messages

**Environment variables required for live WhatsApp:** `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`

**Safety rules:** Admin reviews and manually sends all messages. No autonomous sending. All sends (including failed) are logged to `manufacturer_messages` DB table.

## Enterprise Lead Intelligence Platform

### Lease Signal Intelligence (`/admin/lease-signals`)
AI-powered commercial intelligence engine that detects companies likely to need office furniture by identifying office move, relocation, expansion, and hiring signals across Brisbane, Melbourne, and Sydney.

**How it works:** Runs GPT-4o with deep Australian office market knowledge to generate realistic, qualified leads with: company name, city, industry, signal type, deal probability (0-100%), estimated office sqm, headcount, project value, personalised outreach email, and recommended next action.

**Signal types:** `new_lease`, `relocation`, `office_expansion`, `refurbishment`, `hiring_signals`, `funding_growth`, `new_office_opening`, `territory_signal`

**API:** `POST /api/admin/lease-signal-scan` — accepts `{ cities, signalTypes, count }`. Saves to `prospected_leads` table with extended fields. Deduplicates automatically.

**Extended `prospected_leads` fields:** `signal_type`, `city`, `contact_email`, `contact_role`, `deal_probability`, `estimated_office_sqm`, `estimated_headcount`, `recommended_next_action`, `outreach_subject`, `scan_batch_id`

### Territory Scanner (`/admin/territory-scanner`)
Tracks key office towers and commercial precincts across Brisbane, Melbourne, and Sydney. Admin can add buildings with notes on tenant movements, then trigger an AI scan to generate leads tied to that building.

**DB table:** `territories` — id, building_name, address, suburb, city, state, property_type, notes, tenant_count, active_status, last_activity_at

**API:** `GET/POST /api/admin/territories`, `PATCH/DELETE /api/admin/territories/:id`

### Deal Pipeline (`/admin/deal-pipeline`)
Kanban-style pipeline view across all prospected leads (New → Contacted → Qualified → Won). Shows weighted revenue forecast (probability × value), gross pipeline, high-probability count, and won deal totals. Integrates with existing pipeline-stats from inbound leads.

### Procurement Engine (`/admin/procurement-engine`)
Build a product list (category + quantity) → get supplier routing, landed cost estimates, lead times, and margin bands. Enforces supplier routing rules (Boke = seating only, Meiyi = desks/workstations, Ruby = reception/executive/custom). Generates WhatsApp message drafts per supplier.

**API:** `POST /api/admin/procurement/calculate` — accepts `{ lines: [{ category, quantity }] }`. Returns recommendations with supplier routing.

**Files:**
- `server/services/leaseSignalScanner.ts` — AI scanner + procurement calculator
- `client/src/pages/AdminLeaseSignals.tsx` — AI scanner dashboard
- `client/src/pages/AdminDealPipeline.tsx` — pipeline forecasting
- `client/src/pages/AdminTerritoryScanner.tsx` — building tracker
- `client/src/pages/AdminProcurementEngine.tsx` — supplier procurement

## Automated Follow-Up Email Sequences
Every inbound lead automatically enters a 4-stage personalised email follow-up sequence.

**Schedule:**
- Stage 1 — 24h after lead creation: warm follow-up, personalised by lead type
- Stage 2 — 72h (Day 3): value content (timing advice, hybrid office trends, finance comparison)
- Stage 3 — 168h (Day 7): social proof, 500+ projects, case studies
- Stage 4 — 336h (Day 14): low-pressure final touch, sequence completes

**Lead type personalisation:** `quote-builder`, `finance-lead`, `planner`/`planning-request`, and all other types (contact/strategy/enquiry) each get different email copy tailored to their enquiry context.

**Key files:**
- `server/services/followUpEmails.ts` — All 4 stage × lead-type email templates
- `server/services/followUpScheduler.ts` — Hourly background scheduler + `startFollowUpForLead()` helper
- `shared/schema.ts` — `followUpSequences` DB table
- `server/storage.ts` — CRUD methods for sequences
- `client/src/pages/AdminFollowUpSequences.tsx` — Admin control panel

**Auto-trigger:** Sequences start automatically when leads are created via `/api/leads`, `/api/finance-lead`, or `/api/advanced-estimate`.

**Admin panel:** `/admin/follow-up-sequences` — view all sequences, filter by status, pause/resume/stop individual sequences, mark as replied.

**Sequence statuses:** `active`, `paused`, `completed`, `stopped`, `replied`

**Scheduler:** Starts on server boot (10s delay), runs every hour. Checks `followUpSequences` for rows where `nextSendAt <= NOW()` and `status = active`.

**DB table:** `follow_up_sequences`

**API endpoints:**
- `GET /api/admin/follow-up-sequences?status=active` — List sequences
- `PATCH /api/admin/follow-up-sequences/:id/pause|resume|stop|mark-replied` — Update status

## Brand / Supplier Naming Rules
**Critical:** Supplier names must NEVER appear publicly. All internal supplier keys are mapped to public brand names:
- `Foshan Feisenzhuo Furniture Co., Ltd.` → **Fessenz Design Collection**
- `Huasheng Furniture Group — GOJO Division` → **Presidia Executive Collection**
- `Huasheng Furniture Group — Lounge & Seating Division` → **Presidia Lounge & Seating Collection**
- `Huasheng Furniture Group — Gaozhuo Division` → **Milan Premium Workspace Collection**
- `Foshan Bohua Furniture Co., Ltd. (GAOJIN)` → **Commercial Seating & Storage Collection**
This mapping exists in: `server/routes.ts` (SUPPLIER_COLLECTION_MAP), `client/src/pages/ProductDetail.tsx` (SUPPLIER_COLLECTION_NAMES), `client/src/pages/Products.tsx` (SUPPLIER_COLLECTIONS).

## AI Workspace Planner — Post-Payment Report
The paid report (unlocked after $399 Stripe payment) shows:
1. **2D Layout Plan** — `WorkspaceLayout2D` component with zone percentages
2. **Zone Analysis** — `SpacePlanningEngine` with cost breakdown
3. **Workspace Zones** — grid cards with color dot, percentage, description, `productivityNote`, staff capacity
4. **Furniture Schedule** — product name, SKU, zone badge, unit×qty cost, "View Product →" link to catalog, GST breakdown
5. **Style Direction** — AI-generated aesthetic paragraph
6. **Key Considerations** — acoustic, ergonomic, timeline notes
7. **Recommended Next Step** — call-to-action
8. **3D Walkthrough Access** — link to `/3d-office-walkthrough?id=...`
The AI planning prompt (in `server/routes.ts`, `buildSpacePlanningPrompt()`) uses workspace design intelligence covering ABW principles, space ratios, acoustic/ergonomic guidance, and requires SKUs only from the live catalogue.

## SEO
- **robots.txt**: `client/public/robots.txt` — disallows /admin, /api/, /uploads/; points to sitemap
- **sitemap.xml**: Dynamic server route at `/sitemap.xml` — generates all static pages + 330 product URLs
- **Product JSON-LD**: `ProductDetail.tsx` injects Schema.org Product structured data via `useEffect`
- **Blog JSON-LD**: `BlogPost.tsx` injects Schema.org BlogPosting structured data + meta description + OG title
- **Home JSON-LD**: Already has Organization + LocalBusiness schema

## External Dependencies
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Email**: Nodemailer
- **AI**: OpenAI (via Replit AI Integrations)
- **Payments**: Stripe
- **Marketing Channels (API Integrations)**: Telegram, Facebook, Instagram, X/Twitter, WhatsApp Business