# The Corporate Desk — Premium Office Furniture Website

## Overview
The Corporate Desk project is a luxury office furniture website (`thecorporatedesk.com.au`) focused on lead generation. It features an AI-powered business operating system with specialized roles, an interactive quote builder, a finance calculator, case studies, a marketing hub, an admin dashboard, an AI lead intelligence prospecting engine, and an AI Workspace Planning Platform. The platform provides visual zone layouts, furniture recommendations, project cost estimates, lead scoring, and downloadable planning reports, targeting projects valued from $30,000 to $300,000+.

## User Preferences
I prefer iterative development with clear, modular code. Before making any major architectural changes or introducing new external dependencies, please ask for approval. I prefer detailed explanations for complex solutions. Do not make changes to the `server/db.ts` file without explicit instruction. Do not make changes to the `client/src/lib/furnitureCatalogue.ts` file without explicit instruction.

## System Architecture
The application employs a client-server architecture with a focus on a luxurious, minimalist UI/UX design.

### UI/UX Design
The aesthetic is dark luxury gold, using near-black backgrounds, rich gold accents (`#C9A84C`), and cream white text. Typography features Playfair Display for headings and Inter for body text, drawing inspiration from Apple/Herman Miller's premium and minimalist style.

### Technical Implementations
- **Frontend**: React, Wouter for routing, TanStack Query for data fetching, and Shadcn UI for components.
- **Backend**: Express.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **AI Integration**: Utilizes OpenAI's `gpt-5-mini` model for an AI chatbot (14-role business OS), marketing content generation, lead prospecting, and workspace planning, incorporating the TCD furniture catalogue for tailored recommendations.
- **Premium AI Workspace Concierge**: Persistent cross-page AI advisor (`client/src/components/ChatBot.tsx`) backed by `ConciergeContext` (`client/src/contexts/ConciergeContext.tsx`) with sessionStorage persistence. Conversation history, user profile (sqm, staff, budget, style, location), and UI state all persist across navigation. Page-aware greetings, page-specific quick replies (8 sets), page-specific CTA cards, and a premium animated orb trigger. The `/api/chat` backend receives `pageContext` and `userProfile` fields injected into the AI system prompt via `buildChatSystemPrompt()`.

### Feature Specifications
- **Advanced Commercial Workspace Estimator**: A 4-step wizard generating formal `QuoteSummary` documents with Bill of Quantities (BOQ), GST breakdown, finance options, upsells, and workspace zones.
- **AI Workspace Planning Platform**: Generates detailed plans including lead scores, estimated project values, timelines, workspace zones, product recommendations, and cost breakdowns.
- **AI Lead Intelligence & Prospecting Engine**: Ingests and analyzes leads using AI to extract company details, needs, and signals, with deduplication and batch processing.
- **Marketing Hub**: Facilitates AI-generated content creation and direct posting to various marketing channels.
- **Admin Dashboard**: Provides KPIs, lead overviews, and administrative functionalities.
- **SEO Blog**: Client-side blog with search, category filters, and pagination.
- **Opportunity Scoring Engine v2**: Deterministic signal model scoring inbound leads (0–100) with 4-tier assignment (enterprise/high/medium/low) based on 11 signal types. Updated weights correctly value mid-sized projects: staff 10-25=medium, 25-75=medium-high, 75+=high; sqm 100-300=medium, 300-800=medium-high, 800+=high; budget $50k-120k=medium, $120k-400k=high, $400k+=enterprise. Tier thresholds: enterprise≥68, high≥52, medium≥36. Force-rescore endpoint: POST /api/admin/opportunity-intelligence/rescore-all. "Rescore All" button in Admin Command Centre updates all 225 existing leads live.
- **Floor Plan Boundary Detection**: A computer vision pipeline extracts floor plan geometry from uploaded images, feeding detected shapes and internal wall counts to the AI for zone placement.
- **Workspace Learning System**: Auto-captures project intelligence from AI Planner submissions, storing data like office size, headcount, zone mix, and cost. This intelligence calibrates future AI recommendations.
- **Supplier Pricing Records**: Structured historical pricing data for products across suppliers, accessible via API.
- **Stripe Paywall**: Gated access to premium AI Workspace Planning Reports for $399 AUD, offering detailed SVG floor plans, zone cards, product SKUs, cost breakdowns, and 3D walkthroughs.
- **Premium Report Structure**: Eight-section report including Executive Summary, 2D Floor Plan, Zone Analysis, Furniture Schedule, Style Direction, Key Considerations, Finance Options, and Next Steps, plus 3D Walkthrough access.
- **3D Office Walkthrough**: An interactive Three.js viewer rendering office zones and furniture, enabling raycasting for product information.
- **Admin Authentication**: Secure access to admin pages via email/password, storing authentication in sessionStorage.
- **Product Catalogue**: A live catalogue of 330 SKUs from 5 supplier collections, presented publicly with cleaned, grouped names and series sub-filters. Product detail pages include size variant selectors, image galleries, and a review system.
- **Manufacturer Messaging System**: Admin-only WhatsApp communication system with suppliers, supporting AI-drafted messages and enforcing supplier-specific routing rules (e.g., Boke for seating only, Meiyi/Asya for desks/workstations).
- **Enterprise Lead Intelligence Platform**:
    - **Lease Signal Intelligence**: AI-powered engine identifying companies likely to need office furniture based on office move, relocation, expansion, and hiring signals.
    - **Territory Scanner**: Tracks key office towers and commercial precincts, allowing admins to trigger AI scans for leads tied to specific buildings.
    - **Deal Pipeline**: Kanban-style view of prospected leads, showing weighted revenue forecasts.
    - **Procurement Engine**: Calculates supplier routing, landed cost estimates, and lead times based on product lists, enforcing supplier rules.
- **Automated Follow-Up Email Sequences**: A 4-stage personalized email sequence automatically triggered for every inbound lead, tailored by lead type. An admin panel allows monitoring and management of these sequences.
- **Autonomous Business Intelligence Layer**: A background job engine (`intelligenceScheduler.ts`) running 6 job types on configurable intervals: System Health Check (every 12h), Spending Trend Analysis (every 24h), Website Issue Detection (every 24h), SEO Blog Article Generation (every 7d), Weekly Business Report (every 7d), and Office Move Radar Scan (every 24h, 35min startup offset). All jobs are recorded in the `scheduled_jobs` DB table with timing, status, and results. Admin access via `/admin/intelligence-hub`.
- **Office Move Radar**: Proactive lead detection system that identifies companies likely to move offices, expand teams, open new offices, or refit existing spaces. DB tables: `office_move_radar` (signals, scores, outreach), `building_signals` (building-level tenant intelligence). Features: AI-powered scan via gpt-4o (generates real Australian company detections), radar scoring engine (0–100 score with High/Medium/Low priority), project value estimation from headcount, AI outreach draft generation (email + follow-up + CTA), push-to-pipeline with deduplication, status tracking (New/Reviewing/Outreach Sent/In Pipeline/Dismissed). Lease Signal Scanner automatically forwards signals to radar on every scan. Admin page: `/admin/office-move-radar` with 7 KPI tiles, 4 filters, 3-way sort (score/value/date), detail panel with full outreach draft. Integrated into Command Centre panel and Dashboard widget. API: 11 routes under `/api/admin/office-move-radar/*` and `/api/admin/building-signals`.
- **AI Workspace Profit Optimisation Engine**: Cost stack calculator that derives itemised furniture packages (Premium/Balanced/Value) for any office size and staff count using real supplier pricing data. Returns landed cost, sell price, gross profit, and margin per line item. Includes package comparison, supplier mix optimisation, and layout-type profit patterns (6 office archetypes with avg margins). Admin access via `/admin/profit-engine`.
- **Intelligence Hub Admin Page**: Full admin panel at `/admin/intelligence-hub` with 5 tabs: Job Engine (manual trigger any job, see run history), Business Reports (view/publish weekly AI reports), Spending Trends (market intelligence by category/week), Website Issues (severity-tagged, resolvable), and SEO Articles (AI drafts with approve/reject workflow).
- **Profit Engine Admin Page**: Full admin panel at `/admin/profit-engine` with 3 tabs: Package Comparator (live calculator with real pricing), Layout Profit Patterns (6 archetypes with margins and industry profiles), and Profit Records (historical per-project margin tracking).
- **Formal Quote Builder**: Admin-only system at `/admin/quotes` (AdminQuotes.tsx) for creating and sending professional PDF quotations to clients. Features: auto-generated quote numbers (TCD-YYYYMM-XXXX), inline line items editor with live GST/total calculation, freight/install/discount fields, status tracking (Draft→Ready→Sent→Accepted/Declined/Expired), email dispatch via `sendFormalQuoteEmail()`, and print-to-PDF view at `/admin/quotes/:id/print` (QuotePrint.tsx). Pre-fills from planning requests via "Create Formal Quote" button in the Package & Quote tab. DB table: `quotes`. API routes: GET/POST/PATCH/DELETE `/api/admin/quotes`, POST `/api/admin/quotes/:id/send`.
- **Brand / Supplier Naming Rules**: Critical rule: internal supplier names are never shown publicly; all are mapped to public brand names like "Fessenz Design Collection" or "Presidia Executive Collection."
- **SEO**: Includes `robots.txt`, dynamic `sitemap.xml`, and JSON-LD structured data for products, blog posts, and the home page.

## External Dependencies
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Email**: Nodemailer
- **AI**: OpenAI
- **Payments**: Stripe
- **Marketing Channels (API Integrations)**: Telegram, Facebook, Instagram, X/Twitter, WhatsApp Business

## Phase 11 — AI Workspace Design Engine (Complete)

### New Page: `/ai-workspace-design` (`client/src/pages/WorkspaceDesignEngine.tsx`)
A public-facing 2-step AI design flow:
1. **Step 1** — Upload a floor plan image (optional) + fill out office details (sqm, staff, style, budget, project type)
2. **Step 2** — Instant free AI concept showing: zone allocation breakdown, budget range, top furniture, floor geometry badge (confidence level from CV pipeline), and a CTA to the full $399 planning report and 3D walkthrough

Confidence badge shows 5 detection method tiers: `canny-contour` (High), `pixel-silhouette` (High), `convex-hull` (Medium), `pdf-dimensions` (Medium), `fallback-rectangle` (Low). Submits via existing `/api/planning-requests` endpoint with `source: "design-engine"` in FormData.

### Schema Additions (workspace_learning_records)
- `geometrySource` — Detection method string (canny-contour, pixel-silhouette, convex-hull, pdf-dimensions, fallback-rectangle)
- `geometryConfidence` — Numeric confidence score 0–1
- `designEngineUsed` — Boolean flag for Design Engine vs standard planner submissions

### Backend Updates
- `server/services/workspaceLearning.ts` — Now captures geometry metadata (source, confidence) from floor plan parser output
- `server/routes.ts` — Layout endpoint now returns `floorGeometry` object including boundary points, aspectRatio, confidence, detectedShape, internalWalls
- `server/services/floorPlanParser.ts` — Already had full CV pipeline (689 lines); output now fully wired to learning system

### Admin Updates (`client/src/pages/AdminPlanningRequests.tsx`)
- **Geometry Intelligence Panel** — Appears in the Overview tab of each request card when `geometrySource` is set. Shows: Detection Method (color-coded by confidence: green = high, amber = medium, grey = low), Detected Shape, Confidence %, Internal Walls count. A note confirms when real geometry influenced the AI zone placement.
- **AI Engine Badge** — Small gold "⚡ AI Engine" badge appears on request cards where `source === "design-engine"`, letting admins instantly identify Design Engine submissions
- **PlanningRequest interface** — Added `floorGeometryJson`, `geometrySource`, `source` fields

### 3D Walkthrough Enhancement (`client/src/pages/OfficeWalkthrough.tsx`)
- `FloorGeometryMeta` interface added to LayoutData for geometry-aware rendering
- When a planning request has real floor geometry (from CV pipeline), the 3D room's aspect ratio is derived from `floorGeometry.aspectRatio` instead of defaulting to 1.35. This makes the Three.js room shape match the actual floor plan geometry.
- Aspect ratio is clamped to 0.6–2.5 and only applied when geometry source confidence is within valid bounds (0.3–5.0).
## Phase 13 — AI Deal Intelligence Engine (Complete)

### New DB Table: `dealIntelligenceRecords`
Stores per-deal intelligence records for every lead, planning request, radar signal, quote, and prospect. Key fields: `sourceType` (prospect/planning_request/lead/radar/quote), `winProbability` (0–100), `probabilityTier` (high ≥65 / medium ≥35 / low), `dealStrength`, `estimatedProjectValue`, `estimatedGrossProfit`, `estimatedMarginPct`, `weightedExpectedRevenue`, `weightedExpectedProfit`, `recommendedNextAction`, `recommendedFollowUpTiming`, `recommendedOffer`, `reasoningSummary`, `scoringSignalsJson`. Upserts per sourceType + relatedId so re-running analyse-all is idempotent.

### New Service: `server/services/dealIntelligence.ts`
Full deal intelligence engine with:
- `computeWinProbability(signals)` — 11-signal scoring model (pipeline stage, budget size, staff count, sqm, planning request status, quote sent/accepted, finance interest, radar score, urgency, industry, timing) → 0–100 score with confidence level
- `estimateProjectValue(signals, exactQuote?)` — value estimator using exact quote total or staff-count/sqm heuristics (AU market pricing)
- `getNextAction(signals)` — contextual next action with follow-up timing
- `getOfferStrategy(signals)` — offer recommendation by deal stage
- `analyseDeal(signals, exactQuote?)` — full analysis returning all metrics
- `analyseAllDeals()` — processes all 5 source types: prospected leads (excludes Lost), planning requests (with linked quote data), active radar signals (excludes Converted/Dismissed), inbound leads (top 50), standalone quotes (no planning request link). 68 deals processed.
- Signal converters: `prospectsToSignals()`, `planningRequestToSignals()`, `radarToSignals()`, `leadToSignals()`

### New Page: `/admin/deal-intelligence` (`AdminDealIntelligence.tsx`)
Dedicated deal intelligence dashboard with:
- KPI cards: total deals, weighted pipeline revenue, best win probability, avg margin
- "Best Deals to Chase" spotlight: top 5 deals ranked by win probability
- Deal cards: expandable with win probability donut, source badge, pipeline stage, value/profit, next action panel, offer strategy, outcome buttons (Won/Lost)
- Filters: by probability tier (all/high/medium/low) and source type (all/5 types)
- "Analyse All" button triggers POST /api/admin/deal-intelligence/analyse-all

### API Routes (all under `/api/admin/deal-intelligence`)
- `GET /` — list all records (optional ?tier= and ?sourceType= filters, ?limit= cap)
- `POST /analyse-all` — run full analysis across all 5 sources, upsert results
- `GET /summary` — aggregate stats (total, weighted revenue, profit, tier breakdown)
- `GET /by-related/:id` — get intel for a specific related entity ID
- `PATCH /:id/outcome` — mark deal as won/lost

### Integration Points
- **AdminDealPipeline.tsx**: Each pipeline kanban card gets a `dealIntel` prop from a batch query (`dealIntelMap`). Win probability badge (green/amber/gray) shows in the top-right of each card.
- **AdminCommandCentre.tsx**: "AI Deal Intelligence" panel shows weighted pipeline revenue, total profit, and "Best Deals to Chase" top-5 list with win probability badges and quick action links.
- **AdminDashboard.tsx**: "AI Deal Intelligence" quick action link added to the action grid.
- **AdminPlanningRequests.tsx**: "AI Deal Intelligence" panel appears in the Overview tab of each expanded planning request (when a deal intelligence record exists for that planning request). Shows win probability, value, profit, next action, follow-up timing, and offer recommendation.
- **AdminQuotes.tsx**: Win probability badge appears below the status badge in each quote row. Looks up by `planningRequestId` (for linked quotes) or by `quoteId` (for standalone quotes). Both lookup maps are combined via `quoteDealIntelMap`.
