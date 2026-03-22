# Website Audit — The Corporate Desk

**Site:** thecorporatedesk.com.au  
**Audit Date:** March 2026  
**Status:** In Progress

---

## Summary

This document tracks website audit findings and their resolution status. The Corporate Desk site is built on a React/Express stack with a PostgreSQL database, served via Vite + Node on Replit.

---

## Pages & Status

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| Home | `/` | Live | Premium, luxury aesthetic ✓ |
| Products | `/products` | Live | Catalogue from `furnitureCatalogue.ts` |
| Product Detail | `/products/:sku` | Live | — |
| Free Layout Plan | `/free-office-layout-plan` | Live | Has layout preview gallery |
| Send Quote | `/send-us-your-quote` | Live | — |
| Workplace Strategy | `/workplace-strategy` | Live | — |
| Quote Builder | `/quote-builder` | Live | Do not modify |
| Finance Your Workspace | `/finance-your-workspace` | Live | — |
| Case Studies | `/case-studies` | Live | — |
| Upload Floor Plan | `/upload-your-floor-plan` | Live | Do not modify |
| AI Workspace Design | `/ai-workspace-design` | Live | — |
| 3D Office Walkthrough | `/3d-office-walkthrough` | Live | — |
| Blog | `/blog` | Live | — |
| Contact | `/contact` | Live | — |
| Partners (NEW) | `/partners` | Live | Built March 2026 |
| Submit Deal (NEW) | `/submit-deal` | Live | Built March 2026 |

---

## Admin Pages & Status

| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/admin/dashboard` | Live |
| Leads | `/admin/leads` | Live |
| Deal Pipeline | `/admin/deal-pipeline` | Live |
| Nexora Command Centre (NEW) | `/admin/nexora` | Live — March 2026 |
| Partner Admin (NEW) | `/admin/partners` | Live — March 2026 |
| Intelligence Hub | `/admin/intelligence-hub` | Live |
| Office Move Radar | `/admin/office-move-radar` | Live |
| Market Intelligence | `/admin/market-intelligence` | Live |
| Workspace Strategy | `/admin/workspace-strategy` | Live |

---

## Known Issues

### 1. "Plone" Field Label Bug
**Status:** Not reproduced in current codebase  
**Notes:** Searched across all `.ts`, `.tsx`, `.html`, and `.json` files — string "Plone" not found. May have been fixed in a prior session or may appear only in external WordPress embed content.

**Action:** Monitor contact form submissions from the live WordPress site for any field labels showing "Plone" — if found, the source is likely in the WordPress form plugin configuration, not this codebase.

---

### 2. Trade Customers Portal — Brand Mismatch
**Status:** Trade portal page not present in current codebase  
**Notes:** No route `/trade-customers-portal` registered in `App.tsx`. No `TradeCustomersPortal.tsx` page file found.

**Action:** If a trade portal is required, a new page needs to be created with correct corporate office furniture content (not luxury home content). This is a planned future task.

---

### 3. Layout Plan Page Upgrade
**Status:** Page exists and is functional (`/free-office-layout-plan`)  
**Current state:** Form-driven lead capture with multiple layout style previews (Luxury Corporate, Open Agile, Professional Services, Creative Studio)  
**Notes:** Page appears comprehensive. No specific upgrade requirements have been identified.

---

### 4. Footer / Nav Duplication
**Status:** To be audited  
**Notes:** Layout component wraps all pages via `<Layout>`. Pages using `<Layout>` wrapper correctly show header/footer once. Any page not using `<Layout>` that still manually imports nav/footer elements could duplicate them.

**Action:** Audit any page that uses a manual nav or footer outside of `<Layout>`.

---

### 5. SEO Meta Tags
**Status:** Partially implemented  
**Notes:** Core pages (Home, Products, Blog) have title and meta description. Admin pages and newer feature pages may be missing OG tags.

**Action:** Add `<title>` and `<meta name="description">` to all public-facing pages. Add OG tags to high-value pages (Home, Products, Free Layout Plan, Partners).

---

### 6. Mobile Responsiveness
**Status:** Generally good  
**Notes:** All pages use Tailwind responsive classes (`md:`, `lg:`). New pages (Partners, Submit Deal) built with full responsive grid layouts.

---

## Brand Guidelines

- **Primary colour:** `hsl(43, 78%, 52%)` (gold/amber)
- **Background:** `#0f0f0f` (near-black)
- **Text:** White with layered opacity (`/90`, `/60`, `/40`)
- **Typography:** Light weight headings (`font-light`), tight tracking
- **Aesthetic:** Premium, billionaire-grade corporate — NOT luxury residential
- **Tone:** Confident, direct, B2B — written for property managers, project managers, and C-suite decision-makers

---

## Admin Credentials (Internal Use Only)

- Email: `admin@thecorporatedesk.com.au`
- Password: `Jaymin12!/`
- Session key: `tcd_admin_auth = "true"` (sessionStorage)

---

## Contact / Sender Profile

- **Name:** Ben Mumford
- **Phone:** 0408 407 166
- **Email:** sales@thecorporatedesk.com.au
- **Role:** Sales representative for all outreach and partner communications
