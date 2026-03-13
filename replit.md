# The Corporate Desk — Premium Office Furniture Website

## Overview
The Corporate Desk project is a lead-generation focused luxury office furniture website (`thecorporatedesk.com.au`). It aims to transform the commercial furniture procurement process through an AI-powered business operating system. Key capabilities include an interactive quote builder, a finance calculator, an AI lead intelligence prospecting engine, and an AI Workspace Planning Platform. The platform provides visual zone layouts, furniture recommendations, project cost estimates, lead scoring, and downloadable planning reports, targeting projects valued from $30,000 to $300,000+. The business vision is to capture a significant share of the commercial office furniture market by offering a streamlined, intelligent, and premium experience.

## User Preferences
I prefer iterative development with clear, modular code. Before making any major architectural changes or introducing new external dependencies, please ask for approval. I prefer detailed explanations for complex solutions. Do not make changes to the `server/db.ts` file without explicit instruction. Do not make changes to the `client/src/lib/furnitureCatalogue.ts` file without explicit instruction.

## System Architecture
The application employs a client-server architecture with a focus on a luxurious, minimalist UI/UX design and AI-driven functionalities.

### UI/UX Design
The aesthetic is dark luxury gold, utilizing near-black backgrounds, rich gold accents (`#C9A84C`), and cream white text. Typography features Playfair Display for headings and Inter for body text, drawing inspiration from premium, minimalist styles like Apple and Herman Miller.

### Technical Implementations
- **Frontend**: React, Wouter for routing, TanStack Query for data fetching, and Shadcn UI for components.
- **Backend**: Express.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **AI Integration**: Utilizes OpenAI's `gpt-5-mini` for a 14-role AI chatbot, marketing content generation, lead prospecting, and workspace planning, leveraging the TCD furniture catalogue for tailored recommendations.
- **Premium AI Workspace Concierge**: A persistent, page-aware AI advisor with conversation history, user profile, and UI state persistence across pages.
- **Floor Plan Boundary Detection**: A computer vision pipeline extracts floor plan geometry from uploaded images to inform AI zone placement.
- **3D Office Walkthrough**: An interactive Three.js viewer renders office zones and furniture, enabling product information retrieval via raycasting.

### Feature Specifications
- **Advanced Commercial Workspace Estimator**: A 4-step wizard generating formal `QuoteSummary` documents with Bill of Quantities (BOQ), GST breakdown, finance options, upsells, and workspace zones.
- **AI Workspace Planning Platform**: Generates detailed plans including lead scores, estimated project values, timelines, workspace zones, product recommendations, and cost breakdowns.
- **AI Lead Intelligence & Prospecting Engine**: AI-driven lead ingestion, analysis, deduplication, and batch processing.
- **Marketing Hub**: AI-generated content creation and direct posting to marketing channels.
- **Admin Dashboard**: Provides KPIs, lead overviews, and administrative functionalities.
- **Opportunity Scoring Engine v2**: Deterministic signal model scoring inbound leads (0–100) with dynamic tier assignment (enterprise/high/medium/low) based on 11 signal types.
- **Supplier Procurement Intelligence**: Supplier performance profiles (6-axis scoring: pricing, delivery, reliability, quality, installation, responsiveness), RFQ project creation with auto-furniture-list generation from headcount, supplier routing matrix, RFQ email draft generation, and supplier response tracking with accept/reject workflow. Tables: `supplier_profiles`, `rfq_projects`, `rfq_responses`. Admin UI at `/admin/supplier-intelligence`.
- **Alex WhatsApp AI Persona**: WhatsApp webhook now uses "Alex, Operations Manager" persona with micro-commitment conversion method, HOT/WARM/COLD lead qualification, discovery flow, workspace planning knowledge (8–12 sqm/staff), and automatic lead capture every 4 messages with DB upsert.
- **Workspace Learning System**: Auto-captures project intelligence from AI Planner submissions to calibrate future AI recommendations.
- **Stripe Paywall**: Gated access to premium AI Workspace Planning Reports ($399 AUD) which include detailed SVG floor plans, zone cards, product SKUs, cost breakdowns, and 3D walkthroughs.
- **Product Catalogue (Rebuilt)**: A fully rebuilt curated catalogue of 64 parent products across 9 categories (Executive Desks, Manager Desks, Workstations, Boardroom Tables, Reception, Seating, Storage, Lounge, Occasional Tables). Products sourced from 5 supplier collections (330 raw SKUs) and curated via `server/data/catalogCuration.json`. Each product has: display name, series marketing name (Apex, Atlas, Evidenza, Presidia, etc.), real catalog photography hero image, size/colour/configuration variation selectors, pricing, short description, and gallery. **Product Image Authenticity Rule**: All product images are real supplier catalog photography — NO AI-generated renders. Images come from `uploads/catalog-images/feisenzhuo/` (34 Feisenzhuo design pages), `uploads/catalog-images/huasheng-gaozhuo/` (individual HSG product photos), and `uploads/catalog-images/gojo/` (GOJO lifestyle catalog shots including jn-executive-desk.jpg, hxm-executive-suite.jpg, lru-executive-desk.jpg etc.). The `AI_IMAGES` map in routes.ts is intentionally empty. API endpoints: `GET /api/products/curated` (full list) and `GET /api/products/curated/:sku` (product detail). Products.tsx and ProductDetail.tsx fully rebuilt.
- **Manufacturer Messaging System**: Admin-only WhatsApp communication system with suppliers, supporting AI-drafted messages and supplier-specific routing rules.
- **Enterprise Lead Intelligence Platform**: Includes Lease Signal Intelligence (AI identifying office move signals), Territory Scanner (AI scans for leads in specific commercial buildings), Deal Pipeline (Kanban view of prospected leads), and Procurement Engine (calculates supplier routing, landed cost, lead times).
- **Automated Follow-Up Email Sequences**: A 4-stage personalized email sequence automatically triggered for inbound leads, configurable via an admin panel.
- **Autonomous Business Intelligence Layer**: A background job engine running scheduled tasks like System Health Check, Spending Trend Analysis, Website Issue Detection, SEO Blog Article Generation, Weekly Business Report, and Office Move Radar Scan.
- **Office Move Radar**: Proactive lead detection system using AI to identify companies likely to move offices, expand, or refit spaces, with scoring, project value estimation, and AI outreach draft generation.
- **AI Workspace Profit Optimisation Engine**: A cost stack calculator deriving itemized furniture packages (Premium/Balanced/Value) for any office size and staff count using real supplier pricing data, returning landed cost, sell price, gross profit, and margin.
- **Formal Quote Builder**: An admin-only system for creating and sending professional PDF quotations to clients, with auto-generated quote numbers, inline editing, status tracking, and email dispatch.
- **AI Deal Intelligence Engine**: A comprehensive system that calculates win probability, estimated project value, estimated gross profit, recommended next actions, and offer strategies for all leads, planning requests, radar signals, and quotes.
- **Partner Network System**: Broker, referral partner, and agent management with automated opportunity routing, revenue share tracking, and partner dashboard.
- **Relocation Intelligence Engine**: Market signal discovery for companies likely to relocate, with probability scoring, relocation timeline inference, and push-to-pipeline.
- **Workspace Strategy Engine**: AI-powered workspace recommendations covering layout, product packages, and margin optimisation for submitted planning requests.
- **AI Deal Hunter Engine**: Automated discovery, scoring, deduplication, and routing of commercial office opportunities from 30 real Australian market signal profiles. Runs daily via the intelligence scheduler. Features weighted scoring (0–100), project type inference, timeline estimation, outreach draft generation, and one-click push to pipeline or Office Move Radar. Admin page at `/admin/deal-hunter`.
- **Global Radar Detection**: Extended Office Move Radar to detect signals across 4 countries (Australia, United States, United Kingdom, New Zealand) covering 21 major cities. New job `global_radar_scan` runs every 24 hours via `intelligenceScheduler`. Signals use the same `office_move_radar` table with `sourceType="global_radar"`.
- **Company Intelligence Profiles**: Persistent company profiles (`company_intelligence` table) aggregating all radar signals into a single intelligence record per company. Multi-signal confidence stacking computes a `confidenceScore` and `priorityLevel` (urgent/high/medium/low) from signal diversity, recency, volume, and source reliability. Profiles accumulate over time without duplication. Service: `server/services/companyIntelligenceService.ts`. Sync endpoint: `POST /api/admin/company-intelligence/sync`. Job `company_intel_sync` runs every 6 hours.
- **Org-Chart Extraction**: AI-powered decision maker contact inference for each company profile. Identifies roles: Head of Workplace, Facilities Manager, Office Manager, Operations Manager, Head of Real Estate, Workplace Experience Manager. Contacts stored in `company_contacts` table. Trigger: `POST /api/admin/company-intelligence/:id/extract-contacts`.
- **Deal Heatmap**: Visual opportunity density map on the Command Centre. Aggregates radar records and visitor sessions by city into interactive bubble/bar chart. Shows hottest city, top 5 Australian cities, and global pipeline breakdown by country. API: `GET /api/admin/heatmap-data`. Frontend: embedded as Deal Heatmap panel in `AdminCommandCentre.tsx` with clickable city bubbles and drill-down modal showing company list per city.
- **Signal Time Window Analysis**: Multi-signal confidence stacking implemented in `computeStackedConfidence()` in `companyIntelligenceService.ts`. Scores combine: unique signal type count, signal volume, recency (90-day and 30-day windows), source reliability weights, and visitor engagement. Priority levels: urgent (≥80%), high (≥65%), medium (≥45%), low.
- **Global Pipeline Visibility**: Heatmap API returns country breakdowns (Australia, United States, UK, New Zealand) with total opportunity count and estimated pipeline value per country, displayed in the Deal Heatmap panel.

## External Dependencies
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Email**: Nodemailer
- **AI**: OpenAI
- **Payments**: Stripe
- **Marketing Channels (API Integrations)**: Telegram, Facebook, Instagram, X/Twitter, WhatsApp Business- **Live Visitor Analytics & Lead Tracking**: Privacy-safe server-side visitor tracking via `site_visits` table (ip-hashed, bot-filtered). Tracking endpoint `POST /api/track/pageview` called on every frontend page change via `usePageTracking` hook in `client/src/lib/usePageTracking.ts`. Analytics API at `GET /api/admin/analytics` returns page views, unique visitors, leads, conversion funnel, top pages, and referrer breakdown across today/week/month/year windows. Admin dashboard shows two live sections: Traffic and Lead Tracking.

## Production Data Policy
- **Demo data removed** (March 2026): 221 test leads deleted, 6 demo radar signals archived, 2 demo prospected leads removed
- **Real leads preserved**: 4 genuine enquiries retained (Benjamin Mumford, Sleep user, Sarah Baxter, Sarah Chen)
- **Radar signals**: 72 real signals active (news_rss, job_signal, predictive sources); 6 manual/unverified demo seeds archived
- **Radar listing/stats API**: Excludes archived signals by default; pass `?status=archived` to query archived records
