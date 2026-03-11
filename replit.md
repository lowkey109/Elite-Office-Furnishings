# The Corporate Desk — Premium Office Furniture Website

## Overview
A luxury, billionaire-aesthetic office furniture website for The Corporate Desk (thecorporatedesk.com.au). Full commercial lead generation funnel, AI chatbot (14-role business OS), interactive quote builder, finance calculator, case studies, marketing hub, admin dashboard, and AI-powered lead intelligence prospecting engine.

## Design System
- **Theme**: Dark luxury gold — near-black backgrounds, rich gold accents (#C9A84C), cream white text
- **Typography**: Playfair Display (headings/serif), Inter (body/sans)
- **Style**: Apple/Herman Miller-inspired minimalism — spacious, premium, architectural

## Pages
| Path | Component | Description |
|------|-----------|-------------|
| `/` | Home.tsx | Hero, product categories, features, testimonials, CTA + OG/schema SEO |
| `/about` | About.tsx | Company story, values, timeline |
| `/products` | Products.tsx | Filterable product catalog |
| `/workplace-solutions` | WorkplaceSolutions.tsx | Funnel entry — three paths |
| `/free-office-layout-plan` | FreeLayoutPlan.tsx | Lead form → /thank-you-layout-plan |
| `/send-us-your-quote` | SendQuote.tsx | Lead form → /thank-you-quote |
| `/workplace-strategy` | WorkplaceStrategy.tsx | Lead form → /thank-you-strategy |
| `/quote-builder` | QuoteBuilder.tsx | Interactive AI-assisted multi-step quote builder |
| `/finance-your-workspace` | FinanceWorkspace.tsx | Finance options + repayment calculator |
| `/case-studies` | CaseStudies.tsx | 6 industry-filtered case study cards |
| `/thank-you-layout-plan` | ThankYou.tsx | Confirmation page |
| `/thank-you-quote` | ThankYou.tsx | Confirmation page |
| `/thank-you-strategy` | ThankYou.tsx | Confirmation page |
| `/contact` | Contact.tsx | Contact form + info |
| `/admin/marketing` | Marketing.tsx | AI Marketing Hub (password protected) |
| `/admin/dashboard` | AdminDashboard.tsx | Business metrics, leads overview |
| `/admin/leads` | AdminLeads.tsx | AI Lead Intelligence & Prospecting Engine |
| `/admin/supplier-quotes` | AdminSupplierQuotes.tsx | Supplier Quote Management + Referral Tracking |

## Architecture
- **Frontend**: React + Wouter routing + TanStack Query + Shadcn UI
- **Backend**: Express.js + in-memory storage (MemStorage)
- **Forms**: react-hook-form + Zod validation → POST /api/leads
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini) — chat, marketing content, lead prospecting
- **Images**: AI-generated + stock photography in /public/images/

## Business Info (The Corporate Desk)
- Phone: 1300 977 607
- Email: service@thecorporatedesk.com.au
- Address: 10 Primrose Street, Bowen Hills, QLD 4006
- Certifications: ISO 9001, ISO 14001, 6-year warranty, Australian owned
- Markets: Brisbane, Sydney, Melbourne + nationally
- Project range: $30,000 – $300,000+

## AI System — 14-Role Business OS
The chatbot operates as a coordinated executive team:
1. AI CEO / Strategic Operator
2. AI Luxury Brand Designer
3. AI CRO Strategist
4. AI SEO Director
5. AI Product Merchandising Manager
6. AI Sales Consultant
7. AI Quoting Specialist
8. AI Procurement Coordinator
9. AI Customer Service Manager
10. AI Marketing Director
11. AI Business Analyst
12. AI Finance & Admin Assistant (GST, margins — not licensed advice)
13. AI Workplace Strategy Consultant
14. AI Web Architect

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
- `POST /api/admin/prospect` — AI analyses company signals, scores lead, generates outreach
- `GET /api/admin/prospects` — Get all prospected leads pipeline
- `PATCH /api/admin/prospects/:id/status` — Update lead status
- `DELETE /api/admin/prospects/:id` — Remove prospected lead

## AI Chatbot
- Component: `client/src/components/ChatBot.tsx`
- Integrated into `Layout.tsx` — visible on all pages
- Features: context-aware greetings per page, streaming AI responses, quick replies, CTA cards, lead escalation
- Knowledge base: full TCD product range, pricing, certifications, services, quoting logic, GST/finance calculations, procurement support
- Model: gpt-5-mini via Replit AI Integrations
- Page greetings: Home, Products, Workplace Solutions, Free Layout Plan, Send Quote, Quote Builder, Finance, Case Studies, Strategy, About, Contact

## Quote Builder (/quote-builder)
- 5-step multi-form: Project Type → Style/Space → Products → Contact → Summary
- Live estimate with GST breakdown (ex-GST, GST 10%, total inc GST)
- AI Quoting Advisor sidebar — context-aware chat as user progresses
- Submits to /api/leads with type "quote-builder"

## Finance Your Workspace (/finance-your-workspace)
- Finance benefits section (6 benefits)
- Interactive repayment estimator: amount slider + 12/24/36/48/60 month terms
- GST breakdown in calculations
- FAQ accordion
- Important disclaimer: indicative only, not licensed financial advice

## Case Studies (/case-studies)
- 6 industry case studies: Legal, Finance, Technology, Healthcare, Property, Government
- Industry filter bar
- Expandable cards: challenge, solution, outcome + stats
- CTAs to quote builder and layout plan

## Admin System (Password: tcd2024admin)
### Dashboard (/admin/dashboard)
- KPI cards: total leads, today, this week, quote requests
- Recent leads table with expandable details
- Leads by type breakdown chart
- Quick actions: Lead Intelligence, Marketing Hub, View Site

### Lead Intelligence Engine (/admin/leads)
- Paste company signals (news, LinkedIn, funding announcements, job ads)
- AI analyses expansion indicators and scores opportunity (1-10)
- Returns: company, location, industry, team size, project value estimate, signals, decision makers, outreach message, reasoning
- Priority: High/Medium/Low
- Status tracking: New → Contacted → Responded → Qualified → Closed
- Copy outreach message to clipboard
- Pipeline filtering by priority and status
- Signal guide for what to look for

### Marketing Hub (/admin/marketing)
- Channels: Email, Facebook, Instagram, Telegram, X/Twitter, WhatsApp
- AI content generation for all channels simultaneously
- Direct posting when API keys configured

## Lead Form Types
- `layout-plan` — Free Office Layout Plan
- `quote-request` — Send Us Your Quote
- `quote-builder` — Quote Builder (new)
- `strategy-call` — Workplace Strategy Call
- `contact` — General Contact

## Components
- `Layout.tsx` — Header (fixed, scroll-responsive, 6 nav links + 8 mobile links) + Footer + ChatBot
- `LeadForm.tsx` — Reusable form component for all lead capture forms
- `ChatBot.tsx` — Floating AI business OS assistant

## OpenAI Configuration
- Model: `gpt-5-mini`
- API Key: `AI_INTEGRATIONS_OPENAI_API_KEY`
- Base URL: `AI_INTEGRATIONS_OPENAI_BASE_URL`
- DO NOT use `temperature` or `max_tokens` params — use `max_completion_tokens` or omit entirely
- Cast as `as any` for TypeScript compatibility

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
