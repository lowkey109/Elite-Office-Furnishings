# The Corporate Desk — Premium Office Furniture Website

## Overview
The Corporate Desk project is a luxury office furniture website (`thecorporatedesk.com.au`) designed for lead generation. It features an AI-powered business operating system with 14 specialized roles, an interactive quote builder, a finance calculator, case studies, a marketing hub, an admin dashboard, an AI lead intelligence prospecting engine, and an AI Workspace Planning Platform. The platform provides visual zone layouts, furniture recommendations, project cost estimates, lead scoring, and downloadable planning reports, targeting a project value range of $30,000 – $300,000+.

## User Preferences
I prefer iterative development with clear, modular code. Before making any major architectural changes or introducing new external dependencies, please ask for approval. I prefer detailed explanations for complex solutions. Do not make changes to the `server/db.ts` file without explicit instruction. Do not make changes to the `client/src/lib/furnitureCatalogue.ts` file without explicit instruction.

## System Architecture
The application follows a client-server architecture.
- **Frontend**: Built with React, utilizing Wouter for routing, TanStack Query for data fetching, and Shadcn UI for components.
- **Backend**: Implemented using Express.js.
- **Database**: PostgreSQL with Drizzle ORM. The schema includes tables for users, leads, prospected leads, supplier quotes, referrals, and planning requests.
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
    - **Floor Plan Boundary Detection**: A deterministic computer vision pipeline to extract floor plan geometry from uploaded images (resizing, grayscale, Gaussian blur, Canny edge detection, background flood-fill, contour extraction, Douglas-Peucker simplification, Hough-style line scan for internal walls). Includes fallback mechanisms.
    - **Stripe Paywall**: The AI Workspace Planning Report is gated behind a $399 AUD one-time payment. A free tier offers a blurred preview, while the paid tier unlocks the full SVG floor plan, zone cards, product SKUs, cost breakdown, and 3D walkthrough.
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