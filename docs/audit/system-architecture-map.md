# System Architecture Map — Workspace Intelligence Platform
_Generated: 2026-03-17_

## Overview

The Workspace Intelligence Platform is a full-stack TypeScript/Node.js application that serves as an AI-powered office furniture and commercial workspace intelligence system for The Corporate Desk (thecorporatedesk.com.au).

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 + tsx |
| Framework | Express.js |
| Frontend | React 18 + Vite + Wouter routing |
| Database | PostgreSQL via Drizzle ORM |
| AI | OpenAI (via Replit AI Integrations) |
| Email | Resend / Nodemailer |
| Payments | Stripe |
| Maps | Leaflet / react-leaflet |
| Job Scheduling | In-process setInterval/setTimeout (→ migrating to pg-boss) |

## Module Map

### Public-Facing Modules

| Module | UI Page | Backend Service | DB Tables |
|--------|---------|----------------|-----------|
| Product Catalogue | Products.tsx, ProductDetail.tsx | routes.ts (inline) | productCatalog.json (JSON) |
| AI Chat Advisor | Home.tsx | /api/chat | leads |
| Quote Builder | QuoteBuilder.tsx | /api/quotes | quotes |
| Floor Plan Upload | UploadFloorPlan.tsx | /api/planning-requests | planning_requests |
| Contact / Lead Capture | Contact.tsx | /api/leads | leads |
| Finance Workspace | FinanceWorkspace.tsx | /api/finance-lead | leads |
| Market Map | MarketMap.tsx | /api/market-map | office_move_radar |
| Partner Onboarding | PartnerOnboarding.tsx | /api/partners | partners |
| Partner Dashboard | PartnerDashboard.tsx | /api/partner-dashboard/:email | partners, partner_opportunities |
| Blog | Blog.tsx, BlogPost.tsx | /api/admin/intelligence/blog-articles | generated_blog_articles |

### Admin Modules

| Module | UI Page | Backend Service | DB Tables | Tags |
|--------|---------|----------------|-----------|------|
| Command Centre | AdminCommandCentre.tsx | /api/admin/analytics | all tables (aggregate) | |
| Deal Pipeline | AdminDealPipeline.tsx | /api/admin/prospects | prospected_leads | |
| Office Move Radar | AdminOfficeMovRadar.tsx | officeMovRadarService.ts | office_move_radar | |
| Deal Hunter | AdminDealHunter.tsx | dealHunter.ts | deal_hunter_signals | |
| Deal Intelligence | AdminDealIntelligence.tsx | dealIntelligence.ts | deal_intelligence_records | |
| Intelligence Hub | AdminIntelligenceHub.tsx | intelligenceEngine.ts | intelligence_reports, spending_trends, website_issues | |
| Company Intelligence | AdminCompanyVisitors.tsx | companyIntelligenceService.ts | company_intelligence, company_contacts, visitor_sessions | |
| Lease Signals | AdminLeaseSignals.tsx | leaseSignalScanner.ts | building_signals | |
| Relocation Intelligence | AdminRelocationIntelligence.tsx | relocationIntelligence.ts | relocation_signals | |
| Workspace Learning | AdminWorkspaceLearning.tsx | workspaceLearning.ts | workspace_learning_records | |
| Workspace Strategy | AdminWorkspaceStrategy.tsx | workspaceStrategy.ts | workspace_strategy_recommendations | |
| Supplier Intelligence | AdminSupplierIntelligence.tsx | supplierProcurement.ts | supplier_profiles, rfq_projects, rfq_responses | |
| Profit Engine | AdminProfitEngine.tsx | profitOptimisation.ts | profit_records | |
| Partner Network | AdminPartnerNetwork.tsx | partnerNetwork.ts | partners, partner_opportunities, partner_referrals, revenue_share_records | |
| Market Intelligence | AdminMarketIntelligence.tsx | relocationIntelligence.ts | relocation_signals | |
| Follow-up Sequences | AdminFollowUpSequences.tsx | followUpScheduler.ts | follow_up_sequences | |
| Planning Requests | AdminPlanningRequests.tsx | floorPlanParser.ts | planning_requests | |
| Quotes | AdminQuotes.tsx | routes.ts | quotes | |
| Territory Scanner | AdminTerritoryScanner.tsx | routes.ts | territories | |
| Procurement Engine | AdminProcurementEngine.tsx | supplierProcurement.ts | rfq_projects, rfq_responses | |

## Scheduler Architecture

All jobs run as in-process timers in `intelligenceScheduler.ts`.

Queues (current):
- system_health (12h)
- spending_trends (24h)
- website_issues (24h)
- seo_content (7d)
- weekly_report (7d)
- radar_scan (24h)
- deal_hunter (24h)
- news_rss_scan (12h)
- job_signal_scan (12h)
- predictive_scan (12h)
- global_radar_scan (24h)
- company_intel_sync (6h)

## Data Flow

```
External Signal Sources
  ↓
signalIngestionService (Stage 3)
  ↓
Raw Signal Capture → Dedupe → Normalize → Classify → Confidence Score
  ↓
Entity Matching → Persistence
  ↓
officeMovRadarService / dealHunterService / relocationIntelligenceService
  ↓
opportunityScoring → leadIntelligence
  ↓
Admin UI (Command Centre, Radar, Deal Hunter)
  ↓
Email / CRM / Supplier Actions
```
