# The Corporate Desk — Premium Office Furniture Website

## Overview
The Corporate Desk (`thecorporatedesk.com.au`) is a luxury office furniture website focused on lead generation through an AI-powered operating system. It aims to streamline commercial furniture procurement with features like an interactive quote builder, finance calculator, AI lead intelligence, and an AI Workspace Planning Platform. This platform provides visual zone layouts, furniture recommendations, project cost estimates, lead scoring, and downloadable planning reports for projects valued from $30,000 to $300,000+. The project's ambition is to capture a significant market share by offering a premium, intelligent, and efficient experience in the commercial furniture market.

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
- **AI Workspace Intelligence Platform**: Generates detailed plans, lead scores, project values, timelines, and product recommendations, including premium reports with financial overlays and procurement pricing.
- **AI Lead Intelligence & Prospecting Engine**: AI-driven lead ingestion, analysis, and processing, including a simulated LinkedIn and Google Maps scraper, and a real lead engine for deduplication and scoring.
- **Nexora Autonomous Loop Engine**: A core engine for automated tasks, with scheduling mechanisms, persistence to a database, and an administrative UI.
- **Nexora Executive Operating System (client-side)**: A fully rebuilt decision engine (`client/src/lib/nexoraEngine.ts`) that runs intent classification, journey stage tracking, confidence scoring, urgency calculation, closer mode, problem solver mode, blocker/opportunity detection, deal band estimation, and admin summary generation. Every significant user action emits a typed `NexoraSignal` to the ConciergeContext signal bus. The ChatBot is a thin UI render layer — Nexora runs the decisions. Components: `nexoraEngine.ts`, `ConciergeContext.tsx` (full signal bus with `emit()`, `sessionId`, `signalLog`, `lastDecision`, `closerMode`, `problemSolverMode`), `useNexoraSignal.ts` hook, `NexoraJourneyBar.tsx` (persistent bottom bar showing recommended next action on all non-admin pages).
- **AI Lead Enrichment Pipeline**: Every inbound lead submission triggers a non-blocking OpenAI gpt-4o-mini call that generates a 2–3 sentence executive briefing. Result is written back to the lead record's `nexoraAdminSummary` field. The lead also captures `nexoraIntent`, `nexoraJourney`, `nexoraUrgency`, `nexoraConfidence`, `nexoraNextAction`, `nexoraDealBand`, `nexoraEscalation`, and `sourcePage` from the Nexora session context.
- **Admin Nexora Intelligence Panel**: AdminDashboard lead cards now include a "Nexora Intelligence" section showing the AI-generated admin brief, intent classification, journey stage, urgency, confidence, deal band estimate, recommended next action, and escalation flag.
- **Partner Referral Network**: Manages partner recruitment, deal submission, AI-powered lead scoring, and commission tracking.
- **AI Product Command Centre**: A comprehensive system for product management, including AI-driven content generation from uploads, weighted AI scoring, and full CRUD operations for product categories and drafts.
- **Commercial Workspace Estimator**: A wizard for generating `QuoteSummary` documents.
- **Marketing Hub**: AI-generated content creation and direct posting.
- **Admin Dashboard**: Provides KPIs, lead overviews, and administrative functions.
- **Opportunity Scoring Engine**: Deterministic signal model for scoring inbound leads and assigning dynamic tiers.
- **Supplier Procurement Intelligence**: Manages supplier performance, RFQ creation, and response tracking, leveraging real supplier pricing data.
- **Alex WhatsApp AI Persona**: AI for lead qualification, discovery, and automatic lead capture via WhatsApp.
- **Workspace Learning System**: Auto-captures project intelligence to calibrate future AI recommendations.
- **Stripe Paywall**: Gated access to premium AI Workspace Planning Reports.
- **Product Catalogue**: A curated catalogue of 216 active products (database) and 330 supplier products (furnitureCatalogue.ts). API normalisation (`normaliseProduct`) ensures `name`, `imageUrl`, `imageAlt` are consistent across all endpoints. All 216 database products use AI-generated category images at `/catalog-assets/office-furniture/cat-{category}.png` (8 premium images). furnitureCatalogue products use real supplier images from `/uploads/catalog-images/{supplier}/`.
- **Strategy Call Calendar Booking**: Full 3-step booking flow on `/workplace-strategy` — Step 1: Contact details form, Step 2: Premium calendar with real-time availability from database (Mon-Fri, 9am-4:30pm AEST, 30-min slots), Step 3: Confirmation with email notification. Bookings stored in `strategy_bookings` DB table. Admin can view/confirm/cancel via Admin Dashboard Strategy Bookings section.
- **Blog Homepage Preview**: 3 latest articles shown in a "Workplace Intelligence" section on the homepage, linking to the full blog. 10 real blog categories with 30+ articles, all with real content, SEO meta tags, and 20 real blog images.
- **Manufacturer Messaging System**: Admin-only WhatsApp communication with suppliers, supporting AI-drafted messages.
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
- **Deal Closing System + Partner Network Extensions + Building/Tenant Database**: Systems for generating branded proposals, managing pricing and approvals, tracking partner commissions, and maintaining a comprehensive database of buildings, tenants, and leases.
- **Partner Scaling System**: Partner performance scoring engine (`server/services/partnerScoring.ts`) that calculates a 0–100 score from volume, conversion rate, revenue, consistency, and recency. Assigns tiers: Tier 1 (default), Tier 2 Preferred (score≥40, 3+ referrals), Tier 3 Strategic (score≥75, 10+ referrals, $100k+ revenue). Routes: `GET /api/admin/partners/leaderboard`, `POST /api/admin/partners/:id/score`, `POST /api/admin/partners/score-all`, `GET /api/admin/partners/nudge-targets`. Leaderboard tab in AdminPartners.tsx with tier/city filters and per-partner score sync.
- **Deal Closing Pipeline** (`/admin/deal-pipeline`): Inbound lead pipeline management on `AdminDealPipeline.tsx`. Shows all leads from `leads` table with status pipeline (new→contacted→qualified→proposal→negotiating→won→lost). Lead detail panel for qualification (budget range, next action, has floorplan). Follow-up flags: 24h FOLLOW UP, 72h STALE alerts. Routes: `GET /api/admin/leads/pipeline`, `PATCH /api/admin/leads/:id/pipeline`.
- **Lead Outreach Messaging System**: Three default message templates (initial_contact, follow_up_1, follow_up_2) stored in `lead_message_templates` table. Admin composes messages for leads using templates (auto-fills `{{name}}`), messages stored in `lead_outreach` table as drafts requiring admin approval. Routes: `GET /api/admin/lead-templates`, `PUT /api/admin/lead-templates/:type`, `POST /api/admin/leads/:id/outreach/compose`, `PATCH /api/admin/leads/:id/outreach/:outreachId/approve`, `GET /api/admin/leads/:id/outreach`. Message Templates tab in deal pipeline page with copy + edit functionality.
- **Partner Onboarding Flow** (`/partners/apply`): Self-serve 3-step partner onboarding — no manual approval, no dead states. Step 1: application form (partner type, contact details, ABN, city/state); Step 2: full agreement review + inline digital signing (checkbox + name); Step 3: instant activation success screen with direct links to dashboard and deal submission. Duplicate email handling: if partner already exists and is signed → redirect; if pending/unsent → resume at signing step. Backend: `POST /api/partners/apply` (create + return agreement text); `POST /api/partners/apply/:id/sign` (sign + activate: sets agreementStatus=signed, onboardingStatus=active, activeStatus=active, logs to partner_agreements, sends welcome email). Welcome email sent via `sendPartnerWelcomeEmail()`.
- **Partner Agreement System**: Full digital signing flow for the referral partner network. Admin can send/resend agreement emails (generates unique signing token, sends branded email), manually override status, or mark partners as signed. Partners with unsigned agreements see a blocking gate on their dashboard. Public signing page at `/partner/agreement/:token` shows full legal agreement text, checkbox consent, and digital signature name capture. Agreement enforced on referral submission — unsigned partners receive 403 with clear message. Schema: `partners.agreementStatus` (pending|sent|signed|rejected), `partners.agreementToken`, `partners.agreementSentAt`, `partners.agreementSignedAt`, `partners.agreementSignedByName`, `partners.agreementSignedByIp`, plus `partner_agreements` audit table storing full signed text + template version.
- **7-Department Alex AI Company Orchestrator**: Runs all 7 AI departments (Intelligence, Sales, Outreach, Workspace, Marketing, Operations, Finance) in sequence, recording results and actions.
- **SEO + Conversion Improvements (Staged Rollout)**:
  - *Stage 1 — Technical SEO*: Blog posts now inject full `BlogPosting` JSON-LD (with `datePublished`, `wordCount`, `image`, `keywords`) + `BreadcrumbList` schema. og:type switches to "article" on blog posts and resets on navigation. Canonical link dynamically inserted/removed. Both schemas cleaned up on unmount.
  - *Stage 2 — Quote Builder Email Gate*: Step 3 "Your Details" replaced with "Unlock Your Estimate" — email-only gate (low friction: email + optional name/company). Backend validation relaxed to email-only. Post-estimate phone capture panel added to `EstimateResultsPage`. `/api/estimate/contact-update` endpoint created for best-effort phone capture.
  - *Stage 3 — City Landing Pages*: Four SEO-optimised city pages at `/office-furniture-brisbane`, `/office-furniture-sydney`, `/office-furniture-melbourne`, `/office-furniture-canberra`. Each has `LocalBusiness` + `BreadcrumbList` JSON-LD, city-specific meta, suburb badges, precinct sections, testimonials, and full-range CTAs. All 4 added to sitemap.xml at priority 0.9/0.8.
  - *Stage 4 — Trust & Live Contact*: `WhatsAppButton` component (floating, bottom-right above Nexora) — env-var driven (`VITE_WHATSAPP_NUMBER`). `GoogleReviewsBadge` component (floating bottom-left, also inline variant) — env-var driven (`VITE_GOOGLE_PLACE_ID`, `VITE_GOOGLE_RATING`, `VITE_GOOGLE_REVIEW_COUNT`). Neither renders without the env var.
  - *Stage 5 — Retargeting Infrastructure*: `TrackingPixels` component fires on mount and every SPA route change. Supports Meta Pixel (`VITE_META_PIXEL_ID`), Google Analytics 4 (`VITE_GA_MEASUREMENT_ID`), LinkedIn Insight Tag (`VITE_LINKEDIN_PARTNER_ID`). All three fire only when respective env var is set.

## External Dependencies
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Email**: Nodemailer
- **AI**: OpenAI
- **Payments**: Stripe
- **Booking Integration**: Google Calendar, Calendly
- **Marketing Channels (API Integrations)**: Telegram, Facebook, Instagram, X/Twitter, WhatsApp Business