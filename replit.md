# The Corporate Desk — Premium Office Furniture Website

## Overview
The Corporate Desk (`thecorporatedesk.com.au`) is a luxury office furniture website focused on lead generation. It aims to streamline commercial furniture procurement through an AI-powered operating system. Key capabilities include an interactive quote builder, finance calculator, AI lead intelligence, and an AI Workspace Planning Platform. This platform offers visual zone layouts, furniture recommendations, project cost estimates, lead scoring, and downloadable planning reports for projects ranging from $30,000 to $300,000+. The project's ambition is to capture a significant market share by providing a premium, intelligent, and efficient experience.

## User Preferences
I prefer iterative development with clear, modular code. Before making any major architectural changes or introducing new external dependencies, please ask for approval. I prefer detailed explanations for complex solutions. Do not make changes to the `server/db.ts` file without explicit instruction. Do not make changes to the `client/src/lib/furnitureCatalogue.ts` file without explicit instruction.

## Session Improvements (March 22, 2026 — AI Workspace Intelligence Platform)

### 17-Phase Spec Progress — This Session
- **WorkspaceDesignEngine route**: Added `/admin/workspace-design-engine` route in App.tsx — the full 876-line AI planning tool with premium §01-§08 report is now accessible
- **Premium report §07 Workspace Strategy**: Injects per-zone `productivityNote` from AI output as a data-referenced productivity insight section
- **Premium report §08 Finance Overlay**: Real amortization formula (3.9% p.a. / 60 months) with ±8% monthly payment range using `FinanceOverlay` component
- **Procurement pricing — real data**: `computeProcurementRecommendations` in `leaseSignalScanner.ts` now loads actual `supplierPricing.json` landed costs via lazy-cached `loadSupplierPricing()`. Category matching via `getPricingForCategory()` returns min/max/confidence
- **Procurement UI — Pricing Intelligence Database**: Collapsible "Landed Price Intelligence Database" section in `AdminProcurementEngine` shows all 10 pricing records (ID, category, product, supplier, AUD landed cost, lead time, MOQ, confidence badge)
- **Admin nav link**: "AI Design Engine" button added to `AdminPlanningRequests` header navigation → links to `/admin/workspace-design-engine`
- **All routes verified 200**: homepage, /start, /partners, /capability, /admin/procurement-engine, /admin/workspace-design-engine, /api/admin/supplier-pricing, /api/admin/deal-forecast

## New Major Features (March 2026 — Latest Build)

### Premium Live Product Catalog (Catalog Activation)
- **231 real products** extracted from 3 supplier ZIPs and organized into `catalog-images/` directory
- **Image pipeline**: `TCDcatalog.zip` → office-furniture (76 images) + traditional-series (89 images); `TCD_Reception.zip` → reception-seating (66 images)
- **Image storage**: `catalog-images/{category}/{sku}.{ext}` served statically via Express at `/catalog/*`
- **Database**: `catalog_products` table — 231 products with sku, name, category, image_url; `catalog_config` table — `catalogReady=true`
- **Product names**: Descriptive category-appropriate names (e.g. "Open Plan Workstation", "Executive Writing Desk", "Reception Counter")
- **Catalog UI** (`/catalog`): Premium dark-theme page with hero header, sticky category filter bar, search, lazy-loaded product grid (5 cols), product detail modal, enquiry CTA
- **Category pages**: `/catalog/office-furniture`, `/catalog/traditional-series`, `/catalog/reception-seating`
- **API**: `GET /api/catalog/products?category=X&search=Y&limit=N`, `GET /api/catalog/categories`, `GET /api/catalog/config`, `GET /api/catalog/products/:sku`
- **Admin toggle**: `PATCH /api/admin/catalog/config` — switch `catalogReady` on/off
- **Ingestion**: New ZIPs can be added via `catalog-images/` directory; admin upload pipeline at `/api/admin/catalog/upload` re-seeds from ZIP

### Nexora Autonomous Loop Engine
- Single source of truth: `runNexoraCycle(trigger)` in `server/services/nexoraLoop.ts`
- Two scheduling mechanisms: pg-boss 30-min durable queue + in-memory interval loop
- Lock guard prevents concurrent execution
- All runs persisted to `nexoraRuns` table (signals, outreach, duration, success)
- Admin UI: `/admin/nexora` — run history, loop start/stop/config, real-time status
- Control API: `GET/POST /api/nexora/loop/*` (status, start, stop, config, run-now)
- Documentation: `docs/nexora-loop.md`, `docs/nexora-loop-open-issues.md`

### Partner Referral Network (Full Build)
- **Public pages**: `/partners` (recruitment) + `/submit-deal` (frictionless deal submission)
- **Admin page**: `/admin/partners` — tabbed: Referrals, Partners, Commissions, Settings
- **Schema**: Extended `partners` + `partnerReferrals` tables; new `partnerReferralEvents`, `partnerCommissions`, `partnerDocuments`, `partnerSettings` tables
- **AI scoring**: `server/services/partnerReferralAI.ts` — GPT-4o fit score (0–100), summary, next action, risk flags
- **Commission flow**: Submit deal → AI score → qualify/quote → mark won (auto-creates commission at 7.5%) → mark paid
- **Routes**: All specific `/admin/partners/*` routes correctly ordered BEFORE `/:id` route to avoid Express interception
- Documentation: `docs/partner-network-build-report.md`
- Commission rate: 7.5% flat (configurable via settings)
- Contact: Ben Mumford | 0408 407 166 | sales@thecorporatedesk.com.au

## New Major Features (March 2026)

### AI Product Command Centre (`/admin/products`)
- Full product management system with 7-tab interface: Dashboard, Upload Centre, AI Queue, Draft Review, Published, Categories, SEO Manager
- AI pipeline: upload image/PDF/CSV → GPT-4o extracts SKU, title, descriptions, features, tags, SEO metadata, AI scores
- Weighted AI scoring (market appeal, commercial relevance, visual quality, brand fit) → publish readiness bands (Ready/Publish/Review/Hold Back)
- Full CRUD: approve, reject, edit, regenerate, publish, unpublish, bulk publish
- Category manager with AI SEO generation
- Schema: `product_categories`, `product_drafts`, `upload_queue` tables
- Routes: `/api/admin/products/*`, `/api/admin/product-categories/*`, `/api/admin/uploads/*`

### Real Lead Engine (`/admin/lead-engine`)
- Lead ingestion: `POST /api/intelligence/ingest-lead` — deduplication, scoring (hiring: 80, relocation: 85, website form: 90), auto-push to intelligenceSignals + dealExecution
- LinkedIn scraper (simulated) → extracts expansion/hiring signals
- Google Maps scraper (simulated) → extracts office relocation signals
- CSV/bulk import: `POST /api/admin/import-leads`
- 25 AU seeded leads (Sydney/Melbourne/Brisbane — tech, law, accounting, construction, real estate)
- Scheduler: LinkedIn + Maps scrapers every 6 hours
- Dedup via `dedupe_key` unique index (email or company+city)
- Schema: `ingested_leads` table with `idx_ingested_leads_dedupe` unique index

## System Architecture
The application uses a client-server architecture with a luxurious, minimalist UI/UX design, heavily driven by AI functionalities.

### UI/UX Design
The visual design features a dark luxury gold theme, using near-black backgrounds, gold accents (`#C9A84C`), and cream white text. Playfair Display is used for headings and Inter for body text, reflecting a premium, minimalist aesthetic.

### Technical Implementations
- **Frontend**: React, Wouter for routing, TanStack Query for data fetching, and Shadcn UI for components.
- **Backend**: Express.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **AI Integration**: Powered by OpenAI's `gpt-5-mini` for a 14-role chatbot, marketing content generation, lead prospecting, and workspace planning using the TCD furniture catalogue.
- **AI Workspace Concierge**: A persistent, page-aware AI advisor maintaining conversation history, user profile, and UI state.
- **Floor Plan Boundary Detection**: Computer vision extracts geometry from uploaded images for AI zone placement.
- **3D Office Walkthrough**: Interactive Three.js viewer renders office zones and furniture, enabling product information retrieval.

### Feature Specifications
- **Commercial Workspace Estimator**: A wizard for generating `QuoteSummary` documents.
- **AI Workspace Planning Platform**: Generates detailed plans, lead scores, project values, timelines, and product recommendations.
- **AI Lead Intelligence & Prospecting Engine**: AI-driven lead ingestion, analysis, and processing.
- **Marketing Hub**: AI-generated content creation and direct posting.
- **Admin Dashboard**: Provides KPIs, lead overviews, and administrative functions.
- **Opportunity Scoring Engine**: Deterministic signal model for scoring inbound leads and assigning dynamic tiers.
- **Supplier Procurement Intelligence**: Manages supplier performance, RFQ creation, and response tracking.
- **Alex WhatsApp AI Persona**: AI for lead qualification, discovery, and automatic lead capture via WhatsApp.
- **Workspace Learning System**: Auto-captures project intelligence to calibrate future AI recommendations.
- **Stripe Paywall**: Gated access to premium AI Workspace Planning Reports.
- **Product Catalogue**: A curated catalogue of 64 parent products across 9 categories from 5 supplier collections.
- **Manufacturer Messaging System**: Admin-only WhatsApp communication with suppliers, supporting AI-drafted messages.
- **Enterprise Lead Intelligence Platform**: Includes Lease Signal Intelligence, Territory Scanner, Deal Pipeline, and Procurement Engine.
- **Automated Follow-Up Email Sequences**: A 4-stage personalized email sequence for inbound leads.
- **Autonomous Business Intelligence Layer**: Background jobs for system health, spending trends, SEO, and weekly reports.
- **Office Move Radar**: Proactive AI lead detection for office relocations.
- **AI Workspace Profit Optimisation Engine**: Calculates itemized furniture packages with real supplier pricing.
- **Formal Quote Builder**: Admin-only system for creating and sending professional PDF quotations.
- **AI Deal Intelligence Engine**: Calculates win probability, estimated project value, and recommends next actions.
- **Partner Network System**: Manages brokers, referral partners, and agents with automated opportunity routing.
- **Relocation Intelligence Engine**: Discovers market signals for company relocations with probability scoring.
- **Workspace Strategy Engine**: AI-powered recommendations for layout, product packages, and margin optimization.
- **AI Deal Hunter Engine**: Automated discovery, scoring, deduplication, and routing of commercial opportunities from 30 Australian market signal profiles.
- **Global Radar Detection**: Extends Office Move Radar to 4 countries and 21 major cities.
- **Company Intelligence Profiles**: Aggregates radar signals into persistent company profiles.
- **Org-Chart Extraction**: AI-powered inference of decision-maker contacts for company profiles.
- **Deal Heatmap**: Visual opportunity density map showing aggregated radar records and visitor sessions by city.
- **Signal Time Window Analysis**: Multi-signal confidence stacking.
- **Global Pipeline Visibility**: Heatmap API provides country-level breakdowns of opportunities.
- **Workspace Intelligence Platform**: Comprehensive platform for signal ingestion, intelligent engines, pg-boss job orchestration, map intelligence system with 12 GeoJSON layers, and Command Centre widgets.
- **Tenant Lease Expiry Engine**: Infers lease expiry windows, generates relocation probability predictions, and surfaces urgency-tiered opportunities.
- **Company Hierarchy System**: Builds parent/subsidiary relationships and rolls up signals.
- **Alex AI Enhancement**: Alex's system prompt now injects live intelligence context on every chat request.
- **Admin Command Centre Extension**: New panels for Lease Expiry Engine, Job Control Dashboard, and Intelligence Source Control.
- **Global Intelligence Graph**: Builds a multi-entity graph for relationships between companies, buildings, suburbs, and signals.
- **Map Layer Extensions**: Four new map layers (Lease Expiries, Tenant Movement, Corp Hierarchy, Demand Zones) added to MarketMap.tsx.
- **Outreach Engine + Auto Booking System**: Comprehensive system for contact discovery, AI-personalized message generation, sequence management, and booking integration. Includes new tables, services, pg-boss queues, API routes, and map layers.
- **Stripe Revenue Engine**: Manages payments, payment links, invoices, webhooks, and revenue tracking. Integrates with Stripe for charges, subscriptions, and financial reporting. Includes new tables, services, pg-boss queues, API routes, and map layers.
- **Deal Closing System + Partner Network Extensions + Building/Tenant Database**: Includes systems for generating branded proposals, managing pricing and approvals, tracking partner commissions, and maintaining a comprehensive database of buildings, tenants, and leases. This involves new tables, services, admin pages, and API routes.

## External Dependencies
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Email**: Nodemailer
- **AI**: OpenAI
- **Payments**: Stripe
- **Marketing Channels (API Integrations)**: Telegram, Facebook, Instagram, X/Twitter, WhatsApp Business
- **Live Visitor Analytics & Lead Tracking**: Server-side visitor tracking with a `site_visits` table.
- **Booking Integration**: Google Calendar, Calendly (abstracted provider).- **Money Mode Activation (Stages 21-22)**: Global Intelligence Graph Query Engine (8 methods: getNeighbors, getCompanyNetwork, getConnectedOpportunities, etc.), Cluster Engine (growth/relocation/high_risk_building/industry_density clusters with CLUSTER_MEMBER graph edges), Alex Decision Engine (IGNORE/MONITOR/OUTREACH/PRIORITY_OUTREACH/BOOK_MEETING/ESCALATE_TO_HUMAN), Alex Autonomous Agent (runAlexCycle, deal pipeline management, action logging with SAFE_MODE), deal_execution and alex_actions and clusters DB tables, graph weights in opportunity scoring, 4 new ACC panels (Autonomous Deals Pipeline, Alex Actions Feed, High-Probability Deals, Revenue Forecast).
- **7-Department Alex AI Company Orchestrator (Stage 23)**: `runTcdAiCompany()` in `server/services/alex/companyOrchestrator.ts`. Runs all 7 AI departments in sequence: Intelligence (ingestedLeads/officeMovRadar/companyIntelligence), Sales (dealExecution/leads/quotes), Outreach (outreachThreads/outreachMessages), Workspace (planningRequests), Marketing (generatedBlogArticles/visitorSessions), Operations (scheduledJobs/websiteIssues), Finance (quotes/profitRecords/revenueEvents/commissions). Each returns DepartmentResult with actionsTaken/blockers/metrics/recommendations. Results saved to `alex_company_runs` DB table. In-memory lock prevents concurrent runs. Admin dashboard at `/admin/alex` with ONE BUTTON trigger, live department status cards, metrics panel, blockers panel, run history. Backend routes: POST/GET `/api/admin/alex/run-company`, `/sync`, `/status`, `/history`.
