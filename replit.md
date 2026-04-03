# The Corporate Desk — Premium Office Furniture Website

## Overview
The Corporate Desk (`thecorporatedesk.com.au`) is a luxury office furniture website that aims to be the leading platform for commercial furniture procurement. It focuses on lead generation through an AI-powered operating system, offering features like an interactive quote builder, finance calculator, AI lead intelligence, and an AI Workspace Planning Platform. This platform provides visual zone layouts, furniture recommendations, project cost estimates, lead scoring, and downloadable planning reports for projects valued from $30,000 to $300,000+. The project's ambition is to capture a significant market share by offering a premium, intelligent, and efficient experience in the commercial furniture market.

## User Preferences
I prefer iterative development with clear, modular code. Before making any major architectural changes or introducing new external dependencies, please ask for approval. I prefer detailed explanations for complex solutions. Do not make changes to the `server/db.ts` file without explicit instruction. Do not make changes to the `client/src/lib/furnitureCatalogue.ts` file without explicit instruction.

## System Architecture
The application uses a client-server architecture with a luxurious, minimalist UI/UX design, heavily driven by AI functionalities.

### UI/UX Design
The visual design features a dark luxury gold theme, using near-black backgrounds, gold accents (`#C9A84C`), and cream white text. Playfair Display is used for headings and Inter for body text, reflecting a premium, minimalist aesthetic.

### Technical Implementations
- **Frontend**: React, Wouter for routing, TanStack Query for data fetching, and Shadcn UI for components.
- **Backend**: Express.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **AI Integration**: OpenAI's `gpt-5-mini` powers a 14-role chatbot, marketing content generation, lead prospecting, and workspace planning using the TCD furniture catalogue.
- **AI Workspace Concierge**: A persistent, page-aware AI advisor maintaining conversation history, user profile, and UI state.
- **Floor Plan Boundary Detection**: Computer vision extracts geometry from uploaded images for AI zone placement.
- **3D Office Walkthrough**: Interactive Three.js viewer renders office zones and furniture, enabling product information retrieval.

### Feature Specifications
- **AI Workspace Intelligence Platform**: Generates detailed plans, lead scores, project values, timelines, and product recommendations, including premium reports with financial overlays and procurement pricing.
- **AI Lead Intelligence & Prospecting Engine**: AI-driven lead ingestion, analysis, and processing, including a simulated LinkedIn and Google Maps scraper, and a real lead engine for deduplication and scoring.
- **Nexora Autonomous Loop Engine**: A core engine for automated tasks, with scheduling mechanisms, persistence to a database, and an administrative UI. This engine is the sole intelligence entry point, with pg-boss acting as a durable backup subordinate. It incorporates a 12-layer upgrade for enhanced decision-making, learning from outcomes, safety gates, and robust DB-backed memory and run locks.
- **Nexora Executive Operating System (client-side)**: A fully rebuilt decision engine that runs intent classification, journey stage tracking, confidence scoring, urgency calculation, closer mode, problem solver mode, blocker/opportunity detection, deal band estimation, and admin summary generation.
- **AI Lead Enrichment Pipeline**: Every inbound lead submission triggers an OpenAI `gpt-4o-mini` call for executive briefing and populates lead records with AI-derived insights.
- **Partner Referral Network**: Manages partner recruitment, deal submission, AI-powered lead scoring, and commission tracking with a partner performance scoring engine.
- **AI Product Command Centre**: Comprehensive system for product management, including AI-driven content generation and full CRUD operations.
- **Commercial Workspace Estimator**: A wizard for generating `QuoteSummary` documents.
- **Marketing Hub**: AI-generated content creation and direct posting.
- **Admin Dashboard**: Provides KPIs, lead overviews, and administrative functions, including a System Health Scorecard for Nexora.
- **Nexora AI Monitor** (`/admin/ai-monitor`): Real-time AI observation panel with live Decision Feed (expandable rows), Outcomes, Pipeline, state cards (Mode, Win Rate, Pipeline Value, Outreach, Threshold), auto-refresh 5s. Backend: `GET /api/admin/nexora/monitor` (admin-auth protected).
- **Trading AI Monitor** (`/admin/trading-monitor`): Paper trading engine for crypto (BTC/ETH/SOL) and gold (XAUUSD). **22 PostgreSQL tables** across 10 stages (T001–T010). Paper capital $100K. Live CoinGecko feeds. **T005 Learning**: outcome analysis, edge detection, strategy health, decision quality scoring. **T006 Adaptive**: versioned params, rule engine, guardrails, shadow validation, rollback. **T007 Portfolio**: cross-asset correlation clusters, exposure caps ($25K/asset, $80K gross), risk throttle. **T008 Stress**: 16 scenarios, resilience scoring, stress alerts. **T009 Execution Quality**: per-asset slippage profiles, quality scoring (0-100), execution drag, theoretical vs actual PnL. **T010 Live Bridge**: execution gateway, dry-run adapter, 7-check guardrails, readiness assessment, reconciliation, live order/position tracking — paper_only mode. Endpoints: `GET /api/admin/trading/monitor`, `/learning`, `/adaptation`, `/portfolio`, `/stress`, `/execution`, `/live-bridge`.
- **Opportunity Scoring Engine**: Deterministic signal model for scoring inbound leads and assigning dynamic tiers.
- **Supplier Procurement Intelligence**: Manages supplier performance, RFQ creation, and response tracking using real supplier pricing.
- **Alex WhatsApp AI Persona**: AI for lead qualification, discovery, and automatic lead capture via WhatsApp.
- **Stripe Paywall**: Gated access to premium AI Workspace Planning Reports.
- **Product Catalogue**: A curated catalogue of 216 active products and 330 supplier products, with API normalisation.
- **Enterprise Lead Intelligence Platform**: Includes Lease Signal Intelligence, Territory Scanner, Deal Pipeline, and Procurement Engine.
- **Automated Follow-Up Email Sequences**: A 4-stage personalized email sequence for inbound leads.
- **Autonomous Business Intelligence Layer**: Background jobs for system health, spending trends, SEO, and weekly reports.
- **Office Move Radar**: Proactive AI lead detection for office relocations.
- **AI Workspace Profit Optimisation Engine**: Calculates itemized furniture packages with real supplier pricing.
- **Formal Quote Builder**: Admin-only system for creating and sending professional PDF quotations.
- **AI Deal Intelligence Engine**: Calculates win probability, estimated project value, and recommends next actions.
- **Workspace Strategy Engine**: AI-powered recommendations for layout, product packages, and margin optimization.
- **AI Deal Hunter Engine**: Automated discovery, scoring, deduplication, and routing of commercial opportunities from Australian market signal profiles.
- **Workspace Intelligence Platform**: Comprehensive platform for signal ingestion, intelligent engines, pg-boss job orchestration, map intelligence system with GeoJSON layers, and Command Centre widgets.
- **Tenant Lease Expiry Engine**: Infers lease expiry windows, generates relocation probability predictions, and surfaces urgency-tiered opportunities.
- **Company Hierarchy System**: Builds parent/subsidiary relationships and rolls up signals.
- **Global Intelligence Graph**: Builds a multi-entity graph for relationships between companies, buildings, suburbs, and signals.
- **Outreach Engine + Auto Booking System**: Comprehensive system for contact discovery, AI-personalized message generation, sequence management, and booking integration.
- **Stripe Revenue Engine**: Manages payments, payment links, invoices, webhooks, and revenue tracking.
- **Deal Closing System + Partner Network Extensions + Building/Tenant Database**: Systems for generating branded proposals, managing pricing and approvals, tracking partner commissions, and maintaining a comprehensive database.
- **7-Department Alex AI Company Orchestrator**: Runs all 7 AI departments (Intelligence, Sales, Outreach, Workspace, Marketing, Operations, Finance) in sequence.
- **SEO + Conversion Improvements**: Includes technical SEO enhancements (JSON-LD, canonical links), a quote builder email gate, city landing pages for local SEO, trust elements (WhatsApp, Google Reviews), and retargeting infrastructure (Meta, GA4, LinkedIn pixels).

## External Dependencies
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Email**: Nodemailer, Resend
- **AI**: OpenAI (gpt-4o and gpt-4o-mini)
- **Payments**: Stripe
- **Booking Integration**: Google Calendar, Calendly
- **Job Queue**: pg-boss
- **Signal Source**: Adzuna API
- **Communication**: WhatsApp webhook
- **Marketing Channels (API Integrations)**: Telegram, Facebook, Instagram, X/Twitter, WhatsApp Business