# The Corporate Desk — Premium Office Furniture Website

## Overview
The Corporate Desk project is a luxury office furniture website (`thecorporatedesk.com.au`) designed for lead generation. It features a comprehensive AI-powered business operating system with 14 specialized roles, an interactive quote builder, a finance calculator, case studies, a marketing hub, an admin dashboard, an AI lead intelligence prospecting engine, and an AI Workspace Planning Platform. The platform provides visual zone layouts, furniture recommendations, project cost estimates, lead scoring, and downloadable planning reports, targeting a project value range of $30,000 – $300,000+.

## User Preferences
I prefer iterative development with clear, modular code. Before making any major architectural changes or introducing new external dependencies, please ask for approval. I prefer detailed explanations for complex solutions. Do not make changes to the `server/db.ts` file without explicit instruction. Do not make changes to the `client/src/lib/furnitureCatalogue.ts` file without explicit instruction.

## System Architecture
The application follows a client-server architecture.
- **Frontend**: Built with React, utilizing Wouter for routing, TanStack Query for data fetching, and Shadcn UI for components.
- **Backend**: Implemented using Express.js.
- **Database**: PostgreSQL (Replit auto-provisioned) with Drizzle ORM for data persistence. The schema (`shared/schema.ts`) includes tables for users, leads, prospected leads, supplier quotes, referrals, and planning requests.
- **UI/UX Design**: The theme is dark luxury gold, featuring near-black backgrounds, rich gold accents (#C9A84C), and cream white text. Typography uses Playfair Display for headings and Inter for body text, inspired by Apple/Herman Miller's minimalist and premium aesthetic.
- **AI Integration**: OpenAI's `gpt-5-mini` model is used via Replit AI Integrations for the AI chatbot (14-role business OS), marketing content generation, and lead prospecting. AI prompts are designed to inject the TCD furniture catalogue for tailored recommendations.
- **Core Features**:
    - **Interactive Quote Builder**: A 5-step multi-form with live estimates and an AI Quoting Advisor.
    - **AI Workspace Planning Platform**: Generates detailed plans including lead scores, estimated project values, timelines, workspace zones (with specific color coding), product recommendations, and cost breakdowns.
    - **AI Lead Intelligence & Prospecting Engine**: Ingests leads from multiple sources, uses AI to extract company details, needs, and signals, and includes deduplication logic and batch processing capabilities.
    - **Marketing Hub**: Enables AI-generated content creation and direct posting to various marketing channels.
    - **Admin Dashboard**: Provides KPIs, recent lead overviews, lead type breakdown charts, and access to other admin functionalities.
    - **SEO Blog**: Client-side blog with 200 articles across 10 topic clusters, featuring search, category filters, and pagination.

## Production Recovery — Completed Phases (2026-03-12)
- **Phase 1 — Stripe webhook**: `/api/webhooks/stripe` handles `checkout.session.completed` with signature verification; idempotent; requires `STRIPE_WEBHOOK_SECRET` Replit secret
- **Phase 2 — Supplier names stripped**: `ProductDetail.tsx` — `SUPPLIER_LABELS` → `SUPPLIER_COLLECTION_NAMES` (e.g., "Foshan Feisenzhuo" → "Fessenz Collection"); also fixed `QuoteBuilder.tsx` ("Aimu Series"→"Fessenz Executive", "Breeze Series"→"Milan Workstation") and `OfficeWalkthrough.tsx` ("Feisenzhuo Ruige"→"Presidia Conference Table", "Feisenzhuo Weiyi"→"Presidia Reception Counter")
- **Phase 3 — Images fixed**: All 330 product images remapped in `productCatalog.json` via category/series fallback; 0 broken links remain
- **Phase 4 — Brand names fixed**: `CaseStudies.tsx` + `Testimonials.tsx`: "Aimu Series" → "Fessenz Executive Collection", "Breeze Series" → "Milan Workstation Series" across all 6 case studies and testimonial 1
- **Phase 5 — Payment email**: `server/email.ts` — `sendPaymentConfirmationNotification()` sends admin alert + customer confirmation on Stripe webhook; wired to `checkout.session.completed` event in `routes.ts`
- **Phase 6 — Series display names**: `client/src/lib/seriesDisplayNames.ts` maps raw codes (JN, YOM, HXM, G01–G07, etc.) to branded display names; imported and used in `Products.tsx` (card badge) and `ProductDetail.tsx` (series badge + specs table)
- **Phase 7 — Product reviews**: Already working via `getApprovedReviewsBySku`; no changes needed
- **Phase 8 — Blog category visuals**: `Blog.tsx` — `CategoryBanner` component with 10 category-specific gradient backgrounds and icons; each blog card now has a rich visual header above the text

## Floor Plan Boundary Detection (2026-03-12)

Deterministic computer vision pipeline — no AI/network calls, target < 500ms:

**Pipeline** (`server/services/floorPlanParser.ts`):
1. Load image with `sharp`, resize to 500px working size, convert to grayscale
2. **Gaussian blur** (5×5 kernel, σ≈1.4) — noise reduction
3. **Canny edge detection** — Sobel gradients → NMS → double threshold (15/45) → hysteresis
4. **Background flood-fill** — 4-connected BFS from all 4 image edges to label background
5. **Outer contour extraction** — edge pixels adjacent to background form the outer boundary ring
6. **Moore Neighbor Boundary Tracing** — walks the outer ring collecting ordered contour points
7. **Douglas-Peucker simplification** (ε = 0.012 × max dimension) — reduces polygon to 4-24 pts
8. **Normalise** — all coordinates to 0-1 space
9. **Hough-style line scan** — horizontal/vertical edge-pixel runs ≥ 8% of image = internal wall segments (max 40 stored)

**Fallback chain** (all logged):
1. Pixel silhouette scan — row/column edge sweeps → silhouette polygon
2. Convex hull of all dark pixels
3. Rectangle (only if image is truly blank)

PDF files use page-dimension extraction (no rasterizer available server-side).

**Schema**: `planning_requests` gains `floorGeometryJson` (full JSON) and `geometrySource` (source string) — migrated

**Storage**: `InsertPlanningRequest` + `createPlanningRequest()` include new fields; `updateFloorGeometry()` method on `IStorage`

**Routes** (`POST /api/planning-requests`): `parseFloorPlan()` runs in **parallel** with the OpenAI space planning call (no added latency); geometry stored in DB + returned as `floorGeometry` in response

**SpacePlanningEngine**: accepts `floorBoundary` prop → clips zone treemap via SVG `<clipPath>` to real polygon; renders gold perimeter outline; renders dashed internal wall lines (semi-transparent); confidence badge shows detection %, shape type, and timing in ms

**UploadFloorPlan**: stores `floorGeometry` from API response; payment-verify path reads `floorGeometryJson` from DB and parses it into state; both paths pass geometry to SpacePlanningEngine

## Stripe Paywall
The AI Workspace Planning Report is gated behind a $399 AUD one-time payment:
- **Free tier**: Client brief summary + zone color bar teaser + blurred/watermarked SVG preview
- **Paid tier**: Full SpacePlanningEngine SVG floor plan (no blur/watermark), zone cards, product SKUs, cost breakdown, style direction, key considerations, 3D walkthrough section
- **Payment methods**: Card (incl. Apple Pay + Google Pay on compatible devices), Stripe Link — via `payment_method_types: ["card", "link"]`
- **Watermark system**: When `isPreview=true`, SpacePlanningEngine overlays tiled diagonal "THE CORPORATE DESK / PREVIEW ONLY — NOT FOR PROCUREMENT" text with company name + generated date
- **Backend routes**: `POST /api/planning-requests/:id/checkout` (creates Stripe session at $399), `GET /api/planning-requests/:id/verify-payment?session_id=xxx` (verifies and marks paid)
- **DB columns**: `isPaid` (boolean), `stripeSessionId` (text), `paymentStatus` (text), `paymentTier` (text) on `planning_requests` table
- **To activate**: Add `STRIPE_SECRET_KEY` as a Replit secret (Stripe secret key from your dashboard). Test mode key works for testing.
- **Admin panel**: Always shows full content regardless of payment status
- **3D Walkthrough**: Unlocked section after payment with consultation booking CTA linking to /contact

## External Dependencies
- **Database**: PostgreSQL (Replit built-in)
- **ORM**: Drizzle ORM
- **Email**: Nodemailer (for SMTP email notifications)
- **AI**: OpenAI (via Replit AI Integrations)
- **Payments**: Stripe (npm package installed; requires `STRIPE_SECRET_KEY` secret)
- **Marketing Channels (API Integrations)**:
    - Telegram
    - Facebook
    - Instagram
    - X/Twitter
    - WhatsApp Business

## Admin Authentication
All admin pages are protected with email + password login (stored in sessionStorage as `tcd_admin_auth = "true"`):
- **Primary credentials**: `admin@thecorporatedesk.com.au` / `Jaymin12!/`
- **Legacy password** (any email): `tcd2024admin`
- Auth logic: `client/src/lib/adminAuth.ts` → `validateAdminLogin(email, password)`
- Admin pages: `/admin/dashboard`, `/admin/planning-requests`, `/admin/leads`, `/admin/supplier-quotes`, `/admin/marketing`, `/admin/product-reviews`

## Product Catalogue (330 SKUs — normalized 2026-03-11, was 354)
Live catalogue at `server/data/productCatalog.json`. Supplier DB at `server/data/supplierDatabase.json`.
- **FSZ (Feisenzhuo)** — ~120 SKUs: Weiyi, Blister, Red Cliff, Ruige, Vic, Zhuoya, Dynamic, Dell, Evidenza, Teak, Pari, New Berlin, Shanhe, Bit, Fessenz (open-plan/workstation system)
- **HSG (Huasheng Gaozhuo)** — 21 SKUs: Milan, Karen, Owen, Miller, Mige, Better, Baggio, Bonnie, Mike, Cape sit-stand desk series
- **GJO (GOJO)** — 124 SKUs:
  - Vol 1: LRU (premium dark oak executive suites + boardroom tables)
  - Vol 2 neo-Chinese luxury (Zingana/ebony + copper hardware + mortise-and-tenon):
    - **JN / 忆江南** (Memories of Jiangnan) — 24 SKUs, moon gate lattice motifs
    - **YOM / 云曜** (Cloudy Radiance) — 24 SKUs, dark panel + round copper medallion
    - **HXM / 泓熙** (Flowing Brilliance) — 24 SKUs, gold metal rails + slat fascia
  - Steel Systems: Yashang (white/orange steel filing) + Yafeng (smart-lock lockers)
  - Vol 1 placeholder series (needs_manual_review=true): JCN, YIN, VEP, VEIYE, YUP, GUANHE, YUZ, BSA, WINA, WPN, MZE
- **LSG (GOJO Lounge)** — 13 SKUs: FU8061 sofas, accent chairs, BJ/CJ stone-top tables
- **GJN (GAOJIN / Foshan Bohua Furniture)** — 53 SKUs: Public seating, training chairs, stackable plastic leisure chairs, lounge & dining chairs
  - G01 (sled-base leisure chair, 7 colors), G02 (4-leg stackable, 6 colors), G03 (organic multi-variant, 9 models), G04 (tall-back multi-variant, 8 models), G05 (hole-back design, 4 models), G06 (public/training, 4 models), G07 (heavy-duty public, 4 models)
  - Section 2: 833-1C (classic stackable), 842 (linked training seating), 848/850 (dining chairs), ZC 牛角椅 (bull-horn plastic), LZ9002/LZ9003 (lounge chairs), K01/K02/K03 (premium lounge seating systems)
  - Supplier: 佛山市博华家具有限公司 | Factory: Nanhai Shazhou Industrial Zone, Foshan | Phone: 0757-2388 2788
- Catalogue is built at server startup via `buildCatalogueForAI()` in `server/routes.ts`
- Products page (`/products`) fetches from `/api/products` with live search + category filters; product cards link to detail pages
- Product detail page (`/products/:sku`) shows full product info — image, specs, description, recommended uses, package compatibility, related products, and review system
- Product reviews: `productReviews` table in DB; public GET/POST routes at `/api/products/:sku/reviews`; admin CRUD at `/api/admin/product-reviews`; pending/approved/rejected workflow
- API: `/api/products`, `/api/products/search`, `/api/products/series/:series`, `/api/products/sku/:sku`

## 3D Office Walkthrough (`/3d-office-walkthrough`)
Interactive Three.js 3D floor plan viewer (file: `client/src/pages/OfficeWalkthrough.tsx`):
- **Demo mode** (no `?id` param): Shows "DEMONSTRATION LAYOUT" badge with generated office zones
- **Locked mode** (`?id=xxx` and `isPaid=false`): Shows consultation CTA to unlock via Stripe
- **Full mode** (`?id=xxx` and `isPaid=true`): Renders real zones from AI recommendations
- Zone layout uses binary treemap algorithm based on planning request size
- Furniture geometry built with Three.js (workstations, executive desks, boardroom tables, lounge, reception)
- Raycasting for clickable furniture → product info sidebar with SKU + link to quote
- OrbitControls for pan/zoom/rotate
- Graceful WebGL fallback when hardware acceleration not available
- Backend route: `GET /api/planning-requests/:id/layout` — returns layout data for the walkthrough