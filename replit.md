# The Corporate Desk — Premium Office Furniture Website

## Overview
The Corporate Desk is a lead-generation focused luxury office furniture website (`thecorporatedesk.com.au`) aiming to revolutionize commercial furniture procurement. It leverages an AI-powered business operating system to offer an interactive quote builder, a finance calculator, an AI lead intelligence prospecting engine, and an AI Workspace Planning Platform. This platform provides visual zone layouts, furniture recommendations, project cost estimates, lead scoring, and downloadable planning reports for projects valued from $30,000 to $300,000+. The vision is to capture a significant market share by delivering a streamlined, intelligent, and premium experience.

## User Preferences
I prefer iterative development with clear, modular code. Before making any major architectural changes or introducing new external dependencies, please ask for approval. I prefer detailed explanations for complex solutions. Do not make changes to the `server/db.ts` file without explicit instruction. Do not make changes to the `client/src/lib/furnitureCatalogue.ts` file without explicit instruction.

## System Architecture
The application features a client-server architecture with a luxurious, minimalist UI/UX design and extensive AI-driven functionalities.

### UI/UX Design
The aesthetic centers on dark luxury gold, utilizing near-black backgrounds, rich gold accents (`#C9A84C`), and cream white text. Typography uses Playfair Display for headings and Inter for body text, drawing inspiration from premium, minimalist brands.

### Technical Implementations
- **Frontend**: React, Wouter for routing, TanStack Query for data fetching, and Shadcn UI for components.
- **Backend**: Express.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **AI Integration**: OpenAI's `gpt-5-mini` powers a 14-role AI chatbot, marketing content generation, lead prospecting, and workspace planning using the TCD furniture catalogue.
- **Premium AI Workspace Concierge**: A persistent, page-aware AI advisor maintaining conversation history, user profile, and UI state across pages.
- **Floor Plan Boundary Detection**: A computer vision pipeline extracts geometry from uploaded images for AI zone placement.
- **3D Office Walkthrough**: An interactive Three.js viewer renders office zones and furniture, enabling product information retrieval via raycasting.

### Feature Specifications
- **Commercial Workspace Estimator**: A 4-step wizard for generating formal `QuoteSummary` documents.
- **AI Workspace Planning Platform**: Generates detailed plans, lead scores, project values, timelines, and product recommendations.
- **AI Lead Intelligence & Prospecting Engine**: AI-driven lead ingestion, analysis, and processing.
- **Marketing Hub**: AI-generated content creation and direct posting.
- **Admin Dashboard**: Provides KPIs, lead overviews, and administrative functions.
- **Opportunity Scoring Engine v2**: Deterministic signal model for scoring inbound leads (0–100) and assigning dynamic tiers.
- **Supplier Procurement Intelligence**: Manages supplier performance, RFQ creation, and response tracking.
- **Alex WhatsApp AI Persona**: An AI persona for WhatsApp, focusing on lead qualification, discovery, and automatic lead capture.
- **Workspace Learning System**: Auto-captures project intelligence to calibrate future AI recommendations.
- **Stripe Paywall**: Gated access to premium AI Workspace Planning Reports ($399 AUD).
- **Product Catalogue**: A rebuilt, curated catalogue of 64 parent products across 9 categories from 5 supplier collections, ensuring authentic photography.
- **Manufacturer Messaging System**: Admin-only WhatsApp communication with suppliers, supporting AI-drafted messages.
- **Enterprise Lead Intelligence Platform**: Includes Lease Signal Intelligence, Territory Scanner, Deal Pipeline (Kanban), and Procurement Engine.
- **Automated Follow-Up Email Sequences**: A 4-stage personalized email sequence for inbound leads.
- **Autonomous Business Intelligence Layer**: Background jobs for system health, spending trends, website issues, SEO, weekly reports, and office move radar.
- **Office Move Radar**: Proactive AI lead detection for office relocations, expansions, or refits.
- **AI Workspace Profit Optimisation Engine**: Calculates itemized furniture packages (Premium/Balanced/Value) with real supplier pricing.
- **Formal Quote Builder**: Admin-only system for creating and sending professional PDF quotations.
- **AI Deal Intelligence Engine**: Calculates win probability, estimated project value, gross profit, and recommends next actions for leads.
- **Partner Network System**: Manages brokers, referral partners, and agents with automated opportunity routing.
- **Relocation Intelligence Engine**: Discovers market signals for company relocations with probability scoring.
- **Workspace Strategy Engine**: AI-powered recommendations for layout, product packages, and margin optimization.
- **AI Deal Hunter Engine**: Automated discovery, scoring, deduplication, and routing of commercial opportunities from 30 Australian market signal profiles.
- **Global Radar Detection**: Extends Office Move Radar to 4 countries and 21 major cities.
- **Company Intelligence Profiles**: Aggregates radar signals into persistent company profiles, calculating confidence and priority levels.
- **Org-Chart Extraction**: AI-powered inference of decision-maker contacts for company profiles.
- **Deal Heatmap**: Visual opportunity density map showing aggregated radar records and visitor sessions by city.
- **Signal Time Window Analysis**: Multi-signal confidence stacking combining unique signal types, volume, recency, source reliability, and visitor engagement.
- **Global Pipeline Visibility**: Heatmap API provides country-level breakdowns of opportunities and estimated pipeline value.
- **Workspace Intelligence Platform**: A comprehensive platform encompassing signal ingestion, intelligent engines (opportunity, zone scoring, building risk, demand aggregation, relocation readiness, cluster, alert), pg-boss job orchestration (14 queues), map intelligence system with 12 GeoJSON layers, and Command Centre widgets for intelligence display.
- **Upgrade 1 — Tenant Lease Expiry Engine**: New `lease_records` and `lease_expiry_predictions` tables. `leaseExpiryService.ts` scans radar/company data to infer lease expiry windows, generates relocation probability predictions, and surfaces urgency-tiered opportunities. New map layer: `/api/map/layers/lease-expiries`. New admin panel: Lease Expiry Engine with manual scan trigger.
- **Upgrade 2 — Company Hierarchy System**: New `company_hierarchy_nodes` and `company_relationships` tables. `companyHierarchyService.ts` builds parent/subsidiary relationships from pattern-matching and rolls up signals. New map layer: `/api/map/layers/hierarchy-clusters`.
- **Upgrade 3 — Alex AI Enhancement**: Alex's system prompt now injects live intelligence context on every chat request — top demand suburbs, opportunity zones, lease expiry opportunities, and likely-relocating companies — via `/api/chat/intelligence-context` endpoint.
- **Upgrade 4 — Admin Command Centre Extension**: Three new panels at `/admin/command-centre`: (1) Lease Expiry Engine panel with opportunity list and scan trigger; (2) Job Control Dashboard with manual scan buttons and live pg-boss queue stats; (3) Intelligence Source Control table with per-source enable/disable toggles. New routes: POST `/api/admin/intelligence/trigger-scan`, PATCH `/api/admin/intelligence/source/:id/toggle`.
- **Upgrade 5 — Global Intelligence Graph**: New `intelligence_graph_edges` table. `intelligenceGraphService.ts` builds a multi-entity graph (company→building, company→suburb, suburb→zone, company→signal, subsidiary_of). Graph stats exposed via `/api/admin/intelligence/graph-stats`.
- **Upgrade 6 — Map Layer Extensions**: Four new map layers added to MarketMap.tsx (12 total): Lease Expiries (urgency-colored by tier), Tenant Movement (movement signal types), Corp Hierarchy (company cluster by city), Demand Zones (demand score colored). All layers have popups with relevant property data.
- **Upgrade 7 — Outreach Engine + Auto Booking System**: Full 15-part Outreach Engine upgrade. New tables: `contact_discovery_runs`, `contact_verification_logs`, `outreach_threads`, `outreach_messages`, `outreach_sequences`, `outreach_events`, `meeting_booking_events`; extended `company_contacts` with email/phone/verificationStatus/isPrimary/contactType fields. Services: `contactDiscoveryService.ts` (AI decision-maker discovery + fallback generic contacts), `outreachGenerationService.ts` (AI personalized message generation, Day 0/3/7/14 stages), `outreachEngine.ts` (thread/sequence management, stop conditions), `bookingService.ts` (provider-abstracted: google|calendly|manual). 7 new pg-boss queues (contacts.discovery, outreach.generate, outreach.send, outreach.followup, booking.sync, reply.detect, outreach.metrics.refresh) = 21 total queues. 20+ new API routes under /api/outreach/*, /api/contacts/*, /api/bookings/*, /api/admin/outreach|bookings|contact-discovery/stats. 4 new map layers: outreach-ready, contact-coverage, meetings-booked, follow-up-due (= 16 map layers total). 4 new Admin Command Centre panels: Outreach Control, Booking Control, Contact Discovery, Sequence Control. Alex AI now injects full outreach/booking intelligence context per chat request. SAFE_MODE compliant throughout.

## External Dependencies
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Email**: Nodemailer
- **AI**: OpenAI
- **Payments**: Stripe
- **Marketing Channels (API Integrations)**: Telegram, Facebook, Instagram, X/Twitter, WhatsApp Business
- **Live Visitor Analytics & Lead Tracking**: Privacy-safe server-side visitor tracking with a `site_visits` table.- **Upgrade 8 — Stripe Revenue Engine**: Full 13-part Stripe Revenue Engine upgrade. New tables: `payment_customers`, `payment_links`, `payment_intents_log`, `invoices_log`, `revenue_events`, `webhook_events`, `audit_logs`; extended `quotes` table with `financial_status`, `deposit_required`, `deposit_amount`, `deposit_percent`, `amount_paid`, `amount_due`, `last_payment_at`, `payment_link_url`, `payment_link_status`, `stripe_payment_link_id`, `stripe_customer_id`, `opportunity_id`, `company_id` fields. Services (server/services/stripe/): `stripeConfigService.ts` (Stripe client config + feature flags), `paymentLinkService.ts` (full/deposit payment link creation, Stripe product/price/link generation, superseding stale links), `invoiceService.ts` (invoice creation, finalization, resend), `webhookService.ts` (idempotent webhook processing, event deduplication via `webhook_events.externalEventId` unique constraint), `revenueService.ts` (revenue queries, stats, outstanding invoices, deposit deals). 6 new pg-boss queues (payments.sync, payments.reconcile, payments.retry-failed, invoices.refresh, revenue.metrics.refresh, webhooks.replay) = 27 total queues. 12+ new API routes: /api/payments/status, /api/payments/create-link, /api/payments/create-deposit-link, /api/payments/create-invoice, /api/payments/resend-link, /api/payments/resend-invoice, /api/payments/reconcile, /api/payments/quote/:quoteId, /api/payments/simulate-webhook, /api/payments/stripe/webhook (comprehensive idempotent webhook handler), /api/admin/revenue/stats, /api/admin/revenue/payments, /api/admin/revenue/invoices, /api/admin/revenue/webhooks. 3 new map layers: payments-pending, deposits-paid, revenue-zones (= 19 map layers total). 4 new Admin Command Centre panels: Stripe Status (API/webhook health), Payment Operations (links/deposits/outstanding), Revenue Monitoring (day/week revenue + recent links), Payment Controls (simulate webhook, reconcile, refresh). Alex AI now injects full revenue intelligence context: revenueStats (today/week revenue, deposits, outstanding invoices, expired links), quotesAwaitingPayment, depositPaidDeals. SAFE_MODE compliant: safeMode=true suppresses live Stripe charges; testMode=true enables Stripe test-mode API. Stripe keys: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_CURRENCY=AUD, STRIPE_MODE=test.
