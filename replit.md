# The Corporate Desk — Premium Office Furniture Website

## Overview
The Corporate Desk (`thecorporatedesk.com.au`) is a luxury office furniture website focused on lead generation. It aims to streamline commercial furniture procurement through an AI-powered operating system. Key capabilities include an interactive quote builder, finance calculator, AI lead intelligence, and an AI Workspace Planning Platform. This platform offers visual zone layouts, furniture recommendations, project cost estimates, lead scoring, and downloadable planning reports for projects ranging from $30,000 to $300,000+. The project's ambition is to capture a significant market share by providing a premium, intelligent, and efficient experience.

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
