# The Corporate Desk — Premium Office Furniture Website

## Overview
A luxury, billionaire-aesthetic office furniture website for The Corporate Desk (thecorporatedesk.com.au). This is a replacement for their existing WordPress site with a complete commercial lead generation funnel, AI chatbot, and marketing hub.

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
| `/admin/marketing` | Marketing.tsx | AI Marketing Hub (password protected) |

## Architecture
- **Frontend**: React + Wouter routing + TanStack Query + Shadcn UI
- **Backend**: Express.js + in-memory storage (MemStorage)
- **Forms**: react-hook-form + Zod validation → POST /api/leads
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini) — chat + marketing content generation
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
- `POST /api/chat` — AI chatbot conversation (streaming SSE)
- `POST /api/marketing/generate` — AI content generation for any platform
- `POST /api/marketing/send-email` — Send email via SMTP
- `POST /api/marketing/telegram` — Post to Telegram channel
- `POST /api/marketing/facebook` — Post to Facebook page
- `POST /api/marketing/instagram` — Post to Instagram business account
- `POST /api/marketing/twitter` — Post thread to X/Twitter
- `POST /api/marketing/whatsapp` — Send WhatsApp Business message
- `GET /api/marketing/status` — Check which channels are configured

## AI Chatbot
- Component: `client/src/components/ChatBot.tsx`
- Integrated into `Layout.tsx` — visible on all pages
- Features: context-aware greetings, streaming AI responses, quick replies, CTA cards, lead escalation
- Knowledge base: full TCD product range, pricing, certifications, services, FAQs
- Model: gpt-5-mini via Replit AI Integrations

## Marketing Hub (Admin)
- Path: `/admin/marketing`
- Password: `tcd2024admin`
- Channels: Email, Facebook, Instagram, Telegram, X/Twitter, WhatsApp
- Features: AI content generation for all channels simultaneously, direct posting when API keys configured
- Environment vars required for each channel (see Settings tab in the hub)

## Lead Form Types
- `layout-plan` — Free Office Layout Plan
- `quote` — Send Us Your Quote
- `strategy` — Workplace Strategy Call
- `contact` — General Contact

## Components
- `Layout.tsx` — Header (fixed, scroll-responsive) + Footer + ChatBot
- `LeadForm.tsx` — Reusable form component for all lead capture forms
- `ChatBot.tsx` — Floating AI sales assistant

## Marketing Channel Credentials (Environment Variables)
### Email
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`

### Telegram
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`

### Facebook & Instagram
- `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`

### X / Twitter
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`

### WhatsApp Business
- `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
