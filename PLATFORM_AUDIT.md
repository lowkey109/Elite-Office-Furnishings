# THE CORPORATE DESK — FULL PLATFORM AUDIT
**Date:** March 12, 2026
**Scope:** Public website, admin system, planner flow, visual layout/3D, product catalog, payment, AI intelligence

---

## PART 1 — PUBLIC WEBSITE AUDIT

| Route | Name | Loads | Production Ready | Data | In Nav | What It Does | What's Missing |
|-------|------|-------|-----------------|------|--------|--------------|----------------|
| `/` | Home | ✅ | Yes | Mixed | ✅ | Hero, CTA funnel, lead capture, chatbot | Real project photos |
| `/products` | Products | ✅ | Partial | Real (330 SKUs) | ✅ | Browse all 330 products grouped by collection | 57 broken image links; supplier company names used as internal keys |
| `/products/:sku` | Product Detail | ✅ | **NO — CRITICAL** | Real | ✅ | Dimensions, materials, colours, specs | **Supplier company names visibly printed in 3 places on every product page.** No multi-image gallery. Generic non-product-specific images. |
| `/workplace-solutions` | Workplace Solutions | ✅ | Yes | Marketing copy | ✅ | Lead form, project scope intro | Marketing copy only; no interactive tool |
| `/upload-your-floor-plan` | AI Office Planner | ✅ | Yes | Real | ✅ | Upload floor plan, form intake, AI analysis, payment gate, SVG 2D layout, 3D link, furniture package | No email notifications (SMTP not configured) |
| `/3d-office-walkthrough` | 3D Walkthrough | ✅ | Partial | Real (AI zone data) | ✅ | Three.js zone-based walkthrough driven by AI output | Zone boxes only — no actual furniture 3D models. Broken product images in sidebar. |
| `/quote-builder` | Quote Builder | ✅ | Partial | Frontend formula | Mobile only | Room-type selector, price estimator, lead capture | Simple formula estimator. No product-level line items. No real quoting engine. |
| `/finance-your-workspace` | Finance | ✅ | Partial | Indicative only | Mobile only | Repayment calculator, FAQ | No real finance partner API. Indicative figures only. No application flow. |
| `/free-office-layout-plan` | Free Layout Plan | ✅ | Partial | Lead capture | No | Standalone lead capture form | Overlaps with main funnel — purpose unclear vs `/upload-your-floor-plan` |
| `/send-us-your-quote` | Send Quote | ✅ | Yes | Real lead capture | No | Quote enquiry form | Not linked in main nav |
| `/workplace-strategy` | Workplace Strategy | ✅ | Yes | Lead capture | No | Strategy call booking form | Not linked in main nav |
| `/case-studies` | Case Studies | ✅ | **NO** | **100% fictional** | ✅ | 6 case studies across industries | All companies invented. All reference **"Aimu Series"** which does not exist in the real product catalog. Brand integrity risk. |
| `/testimonials` | Testimonials | ✅ | **NO** | **100% fictional** | Mobile only | Client testimonial cards | All names and quotes invented. References to "Aimu Series" products that don't exist in catalog. |
| `/blog` | Blog | ✅ | Partial | Real content (static) | ✅ | 200 articles across 10 categories | All posts hardcoded in TypeScript — no CMS, no images, cannot update without code deploy. |
| `/blog/:slug` | Blog Post | ✅ | Partial | Static | ✅ | Full article with related posts | No featured images. No author profiles. No schema markup. |
| `/about` | About | ✅ | Yes | Static | ✅ | Company overview | Static copy only |
| `/contact` | Contact | ✅ | Yes | Real lead capture | ✅ | Contact form + phone/email | — |
| `/thank-you-layout-plan` | Thank You | ✅ | Yes | Static | No | Confirmation page | Generic |
| `/thank-you-quote` | Thank You | ✅ | Yes | Static | No | Confirmation page | Generic |
| `/thank-you-strategy` | Thank You | ✅ | Yes | Static | No | Confirmation page | Generic |
| `/embed/quote-builder` | Embed Quote | ✅ | Yes | Real | No | WordPress iframe embed | Working |
| `/embed/finance-your-workspace` | Embed Finance | ✅ | Yes | Real | No | WordPress iframe embed | Working |

---

## PART 2 — ADMIN / BACKEND AUDIT

| Route | Purpose | Loads | Real Data | Production Ready | Gaps |
|-------|---------|-------|-----------|-----------------|------|
| `/admin` | Redirects to dashboard | ✅ | — | ✅ | — |
| `/admin/dashboard` | Admin Dashboard | ✅ | Yes — DB metrics, recent leads, planning requests | ✅ | No email alerts (SMTP not configured) |
| `/admin/command-centre` | AI Command Centre | ✅ | Yes — real pipeline stats, lead scores, AI project values | ✅ | Pipeline value is AI-estimated, not client-confirmed |
| `/admin/planning-requests` | Planning Requests | ✅ | Yes — 8 real records, AI recommendations, furniture packages | ✅ | No admin-side PDF download |
| `/admin/leads` | Web Leads | ✅ | Yes — 3 real leads | ✅ | — |
| `/admin/lead-intelligence` | Alias for leads | ✅ | Same as above | ✅ | — |
| `/admin/supplier-quotes` | Supplier Quote Tracker | ✅ | 1 real record | ✅ | Manual data entry only; no supplier portal |
| `/admin/product-reviews` | Product Reviews | ✅ | 1 real review | ✅ | Reviews not displayed on public product pages |
| `/admin/marketing` | Marketing Content Gen | ✅ | AI-driven | Partial | Generates content but no export/publish flow |

**Missing admin tools:** no product image management interface, no bulk SKU editor, no Stripe payment history view.

---

## PART 3 — PLANNER FLOW AUDIT

| Step | Status | Reality |
|------|--------|---------|
| Floor plan upload | ✅ Real | Accepts image, stores in DB, visible in admin |
| Form submission | ✅ Real | Staff count, sqm, style, budget, office type, contact — all saved to `planning_requests` table |
| AI analysis | ✅ Real | OpenAI GPT generates workspace zones, product recs by SKU, cost breakdown, lead score, project value estimate. Stored as JSON. |
| Free preview | ✅ Real | Zone summary + blurred 2D layout shown without payment |
| Payment gate | ✅ Real | Live Stripe checkout $399 AUD. `is_paid` flag stored in DB. |
| Post-payment unlock | ✅ Real | Full SVG floor plan, furniture package with SKUs, cost breakdown, 3D link — all unlock on payment |
| Admin record creation | ✅ Real | Every submission creates a planning request record with AI data visible in admin |
| Quote linkage | ⚠️ Partial | Customer can click "Request Quote" — goes to lead form. No automated quote from furniture package. |
| 3D linkage | ⚠️ Partial | 3D walkthrough reads the same zone data. Renders zone blocks. Products appear in sidebar only — not rendered as 3D geometry. |
| Email confirmation | ❌ Broken | SMTP not configured. Zero emails sent to customer or admin on submission or payment. |
| Stripe webhook | ❌ Missing | If browser closes before success redirect, `is_paid` never gets set. Customer paid $399 and unlocked nothing. |

---

## PART 4 — VISUAL LAYOUT / 3D AUDIT

### 2D Layout — `WorkspaceLayout2D.tsx`

- **Real SVG renderer** using a zone treemap algorithm.
- AI generates zones (name, percentage of space, colour, key furniture list).
- Pre-payment: layout is blurred with paywall overlay.
- Post-payment: full SVG with zone labels, wall grid, north indicator, title block, staff capacity per zone.
- **What it is NOT**: does not read the uploaded floor plan image geometry. The floor plan upload is stored for admin review but does NOT influence the 2D rendering — a rectangular treemap is always generated regardless of actual floor shape.

### 3D Walkthrough — `OfficeWalkthrough.tsx`

- **Real Three.js implementation** — OrbitControls, zone-based room geometry, lighting.
- Powered by real AI zone data from the planning request.
- Zones rendered as coloured box volumes (floor plate + walls per zone). Zone labels float in 3D.
- Product sidebar shows AI-recommended furniture with images.
- **What it is NOT**: individual furniture pieces are not modelled in 3D. No chairs, desks, or tables exist as geometry in the scene — only abstract zone blocks. Product images in the sidebar have a ~62% broken link rate.

---

## PART 5 — PRODUCT CATALOG AUDIT

**Overview:**
- 330 products across 5 suppliers, 10 categories, ~65 series.
- Categories: Executive Desks (50), Storage/Filing (87 combined), Seating (55 combined), Workstations (31), Boardroom Tables (29), Manager Desks (28), Lounge Seating (35), Occasional Tables (24), Reception Desks (4).

### CRITICAL — Broken Product Images

| Metric | Value |
|--------|-------|
| Total products | 330 |
| Unique image paths referenced | 92 |
| Image files that exist on disk | 35 |
| **Broken image references** | **57 (62%)** |
| Products with multi-image gallery | 0 |
| Images matched to specific SKUs | 0 (all generic rotation) |

All 330 products rotate through ~92 generic design shot paths named `design-04.jpg`, `design-05.jpg` etc. — not product-specific photographs. Multiple products share the same image.

### CRITICAL — Supplier Names Exposed

Full Chinese manufacturer company names appear on every product detail page in **3 places**:
1. As a badge label (`supplierLabel` variable — line 350)
2. "Supplied by: Foshan Feisenzhuo Furniture Co., Ltd." (line 457)
3. Full "Supplier & Sourcing" card: `{product.supplier}` (line 678)

Exposed names: "Foshan Feisenzhuo Furniture Co., Ltd.", "Huasheng Furniture Group — Gaozhuo Division", "Huasheng Furniture Group — GOJO Division", "Foshan Bohua Furniture Co., Ltd. (GAOJIN)"

### Raw Internal Codes as Product Names

Series names in the catalog include internal manufacturer codes: "JN", "HXM", "YOM", "G03", "G04", "BSA", "VEIYE", "YIN", "YUP", "YUZ". These appear on product cards and detail pages as the series identifier.

### Case Study / Testimonial Mismatch

All case studies and testimonials reference **"Aimu Series"** furniture. This series does not exist anywhere in the 330-product catalog. Real catalog series include: Fessenz, GOJO, LRU, Milan, Weiyi, Fessenz, Cape, Baggio, etc.

---

## PART 6 — PAYMENT / MONETISATION AUDIT

| Item | Status | Notes |
|------|--------|-------|
| Stripe connected | ✅ Live | `STRIPE_SECRET_KEY` confirmed, `cs_live_...` sessions created |
| Unlock button triggers real payment | ✅ | Stripe checkout session created on click |
| Currency / amount | ✅ | $399.00 AUD |
| Payment status stored | ✅ | `is_paid` flag in `planning_requests` DB |
| Success redirect | ✅ | Returns to `/upload-your-floor-plan?id=...&session_id=...` |
| Verify payment endpoint | ✅ | `GET /api/planning-requests/:id/verify-payment` polls Stripe |
| Email receipt to customer | ❌ | SMTP not configured |
| Email alert to admin | ❌ | SMTP not configured |
| Stripe webhook | ❌ **Missing** | If browser closes mid-redirect, paid customer gets nothing |
| Refund management | ⚠️ | Must use Stripe dashboard — no admin UI |

**Revenue Risk:** Without a Stripe webhook, payment completion is only confirmed when the customer's browser completes the redirect and the `verify-payment` endpoint is polled. A crashed browser, closed tab, or network drop = `is_paid` stays `false` despite real money being charged.

---

## PART 7 — AI / INTELLIGENCE AUDIT

### What Is Real

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| System prompt | `server/systemPrompt.ts` | 547 | ✅ Real — covers business strategy, psychology, negotiation, workspace design, brand voice |
| Knowledge loader | `server/ai/knowledgeLoader.ts` | 264 | ✅ Real — loads 40+ JSON files into AI context |
| Package generator | `server/ai/packageGenerator.ts` | 299 | ✅ Real — selects SKUs from catalog based on zone requirements |
| Lead intelligence | `server/services/leadIntelligence.ts` | 205 | ✅ Real logic — manual adapter only |
| Chatbot | `client/src/components/ChatBot.tsx` | — | ✅ Real — streaming OpenAI, conversation history, brand-aware |
| CEO reasoning | `AdminCommandCentre.tsx` | — | ✅ Real — live OpenAI calls per lead |
| Lead scoring | DB + routes | — | ✅ Real — formula + AI-extracted scores, 8/8 records scored |

### Knowledge Files Inventory

| Category | Directory | Files | Status |
|----------|-----------|-------|--------|
| Business | `ai/knowledge/` (root) | companyProfile, businessRules, pricingStrategy, supplierStrategy, clientProfiles, offerStructure, projectQualificationRules, brandVoice, serviceAreas | ✅ Exist |
| Industry | `ai/knowledge/industry/` | officeFurnitureIndustry, workplaceDesign, officeFitoutProcess, constructionWorkflow, commercialFurnitureSales, logisticsAndSupplyChain, projectManagement, australianWHS, australianBuildingCompliance, accessibilityAndInclusiveDesign, commercialRealEstateSignals | ✅ Exist |
| Psychology | `ai/knowledge/psychology/` | b2bBuyingPsychology, procurementBehaviour, negotiationPsychology, stakeholderDynamics, valuePerception, constructionDecisionPsychology | ✅ Exist |
| Finance | `ai/knowledge/finance/` | commercialPricing, marginStrategy, projectValueAssessment, cashflowSensitivity, financePositioning | ✅ Exist |
| Growth | `ai/knowledge/growth/` | b2bMarketingStrategy, leadGenerationStrategy, partnershipStrategy, contentStrategy, marketPositioning | ✅ Exist |
| Market | `ai/knowledge/market/` | highValueLeadSignals, industryTargeting, companyGrowthSignals, officeMoveIndicators | ✅ Exist |
| Accounting | `ai/knowledge/accounting/` | 7 files | ✅ Exist |
| Risk | `ai/knowledge/risk/` | 6 files | ✅ Exist |

**Total: 40+ JSON knowledge files confirmed on disk.**

### What Is Partial / Weak

- Knowledge loader references some files using flat path assumptions — subdirectory files may not all load correctly. `safeReadJson` swallows errors silently so failures are invisible.
- Lead intelligence prospect scanning: only `manualAdapter.ts` active. No real LinkedIn, Seek, or property data API connected.

---

## PART 8 — REAL VS DEMO SUMMARY

### A. FULLY REAL AND WORKING
- Stripe live payment ($399 AUD, session creation, verification, `is_paid` DB flag)
- AI Office Planner form intake → OpenAI analysis → zone/package generation
- SVG 2D floor plan renderer (zone treemap, pre/post payment blur)
- Three.js 3D walkthrough (zone geometry, orbit controls, product sidebar)
- Admin dashboard, command centre, planning requests (all real DB data)
- AI lead scoring (formula + AI JSON extraction, 8/8 records scored)
- AI CEO strategic summaries (live OpenAI calls in Command Centre)
- Chatbot (streaming OpenAI, context-aware, full conversation history)
- 330-SKU product catalog (JSON-served, categorised, searchable)
- Blog (200 articles, real content, filterable)
- All lead capture forms (saves to `leads` table)
- All admin CRUD (planning requests, leads, supplier quotes, referrals, reviews)

### B. PARTIALLY WORKING
- Product images — 35 of 92 files exist; 57 references are broken 404s
- Payment success — no Stripe webhook; browser close = unlock failure
- AI knowledge loading — 40+ files exist but subdirectory path resolution may be incomplete
- Finance calculator — math works; no real finance partner
- Quote builder — estimator works; no product-level quoting engine
- 3D walkthrough furniture — zones display; no actual furniture geometry

### C. DEMO / PLACEHOLDER / NOT FULLY CONNECTED
- Case studies — 100% fictional. Reference "Aimu Series" which doesn't exist in catalog.
- Testimonials — 100% fictional. Same Aimu Series inconsistency.
- 3D furniture models — abstract zone blocks only, no real furniture geometry
- Blog images — 200 articles, zero images
- Finance partner — no lender API or application flow
- Product reviews — data exists in DB; not displayed on any public product page

### D. BROKEN OR NOT PRODUCTION READY
- **Supplier names exposed** — full Chinese manufacturer company names on every product detail page (3 locations)
- **57 broken product image links** — 62% of image references return 404
- **"Aimu Series" in case studies/testimonials** — references a series that doesn't exist in catalog
- **SMTP not configured** — zero emails fired on any event (submissions, payments, leads)
- **No Stripe webhook** — paid customer can lose their unlock if browser closes mid-redirect
- **Raw internal codes as series names** — "JN", "HXM", "YOM", "G03" visible on product cards
- **Blog has no images** — 200 articles, zero featured images
- **Product reviews not displayed** — review system exists in DB and admin; not shown on product pages

---

## PART 9 — TOP 10 PRIORITIES

| Priority | Fix | Impact | Risk |
|----------|-----|--------|------|
| 1 | **Stripe webhook** — implement `/api/webhooks/stripe` to set `is_paid` on payment success event | Revenue protection — live money at risk now | Low effort, high safety |
| 2 | **Strip supplier names from product pages** — replace with collection names or "The Corporate Desk Network" | Brand integrity, competitive intelligence protection | Low risk |
| 3 | **Fix broken product images** — remap 330 products to the 35 images that actually exist on disk | Conversion — 62% of product images are broken | Low risk |
| 4 | **Configure SMTP** — add SMTP_HOST, SMTP_USER, SMTP_PASS to Replit Secrets | Operational — admin blind to new leads and payments | Zero code change |
| 5 | **Replace "Aimu Series"** in case studies and testimonials with real catalog series names (Fessenz, GOJO, Milan, LRU) | Brand integrity — current copy references non-existent products | Low effort |
| 6 | **Clean up raw SKU codes** — rename "JN", "HXM", "YOM", "G03" series to branded names in product cards | Premium brand perception | Medium effort |
| 7 | **Display product reviews on public product pages** — review system and data already exist | Conversion and trust | Low effort |
| 8 | **Blog featured images** — add category-based or generated hero images to blog articles | Premium brand perception, SEO click-through | Medium effort |
| 9 | **Multi-image gallery per product** — add 2–3 additional images per product using existing on-disk stock | Conversion — product detail pages feel thin | Medium effort |
| 10 | **Real case study content** — replace invented case studies with real (or real-adjacent) project write-ups | Credibility risk — invented company names are Googleable | Medium effort |

---

## PART 10 — FINAL VERDICT

**1. Is the platform truly live or still partially demo?**
Live infrastructure with demo content in the trust-building layer. The technical systems — payment, AI, database, 3D, admin — are genuinely functional. The social proof layer (case studies, testimonials) is entirely fictional and references products that don't exist. The product image system has a 62% broken link rate. SMTP is silent.

**2. What percentage complete is it?**
**~65% production ready.** The planner funnel, payment system, admin intelligence, AI engine, and product catalog are solid. The brand credibility layer (images, case studies, testimonials, series naming) and operational plumbing (email, webhooks) are materially incomplete.

**3. What is the single biggest missing feature?**
A **Stripe webhook**. Customers can pay $399 in live mode right now, close their browser before the redirect completes, and receive nothing. This is a live revenue safety issue happening today.

**4. What is the single most commercially valuable next step?**
**Stripe webhook → supplier name removal → broken image fix.** In that order. The webhook protects every dollar earned. The supplier names are a brand integrity failure on every product page visit. The broken images are killing conversion on the highest-engagement pages in the catalog.

---

*Audit conducted March 12, 2026. Based on direct code inspection of all routes, components, database records, AI files, and server logic.*
