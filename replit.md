# The Corporate Desk — Premium Office Furniture Website

## Overview
A luxury, billionaire-aesthetic office furniture website for The Corporate Desk (thecorporatedesk.com.au). This is a replacement for their existing WordPress site with a complete commercial lead generation funnel.

## Design System
- **Theme**: Dark luxury gold — near-black backgrounds, rich gold accents (#C9A84C), cream white text
- **Typography**: Playfair Display (headings/serif), Inter (body/sans)
- **Style**: Apple/Herman Miller-inspired minimalism — spacious, premium, architectural

## Pages
| Path | Component | Description |
|------|-----------|-------------|
| `/` | Home.tsx | Hero, product categories, features, testimonials, CTA |
| `/about` | About.tsx | Company story, values, timeline |
| `/products` | Products.tsx | Filterable product catalog |
| `/workplace-solutions` | WorkplaceSolutions.tsx | Funnel entry — three paths |
| `/free-office-layout-plan` | FreeLayoutPlan.tsx | Lead form → /thank-you-layout-plan |
| `/send-us-your-quote` | SendQuote.tsx | Lead form → /thank-you-quote |
| `/workplace-strategy` | WorkplaceStrategy.tsx | Lead form → /thank-you-strategy |
| `/thank-you-layout-plan` | ThankYou.tsx | Confirmation page |
| `/thank-you-quote` | ThankYou.tsx | Confirmation page |
| `/thank-you-strategy` | ThankYou.tsx | Confirmation page |
| `/contact` | Contact.tsx | Contact form + info |

## Architecture
- **Frontend**: React + Wouter routing + TanStack Query + Shadcn UI
- **Backend**: Express.js + in-memory storage (MemStorage)
- **Forms**: react-hook-form + Zod validation → POST /api/leads
- **Images**: AI-generated + stock photography in /public/images/

## Business Info (The Corporate Desk)
- Phone: 1300 977 607
- Email: service@thecorporatedesk.com.au
- Address: 10 Primrose Street, Bowen Hills, QLD 4006
- Certifications: ISO 9001, ISO 14001, 6-year warranty, Australian owned
- Markets: Brisbane, Sydney, Melbourne + nationally
- Project range: $30,000 – $300,000+

## API Endpoints
- `POST /api/leads` — Submit a lead (any form type)
- `GET /api/leads` — List all leads (admin)

## Lead Form Types
- `layout-plan` — Free Office Layout Plan
- `quote` — Send Us Your Quote
- `strategy` — Workplace Strategy Call
- `contact` — General Contact

## Components
- `Layout.tsx` — Header (fixed, scroll-responsive) + Footer
- `LeadForm.tsx` — Reusable form component for all lead capture forms
