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
- **Opportunity Scoring Engine**: Deterministic signal model scoring inbound leads (0–100) with tier assignment based on 11 signal types.
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
- **Brand / Supplier Naming Rules**: Critical rule: internal supplier names are never shown publicly; all are mapped to public brand names like "Fessenz Design Collection" or "Presidia Executive Collection."
- **SEO**: Includes `robots.txt`, dynamic `sitemap.xml`, and JSON-LD structured data for products, blog posts, and the home page.

## External Dependencies
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Email**: Nodemailer
- **AI**: OpenAI
- **Payments**: Stripe
- **Marketing Channels (API Integrations)**: Telegram, Facebook, Instagram, X/Twitter, WhatsApp Business