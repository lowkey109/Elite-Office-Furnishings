# Module Health Report — Workspace Intelligence Platform
_Generated: 2026-03-17_

## Health Rating Scale
- ✅ HEALTHY — fully wired (UI + backend + DB)
- ⚠️ PARTIAL — some wiring missing
- ❌ BROKEN — disconnected or missing critical path

## Module Health Summary

| Module | Health | Tags | Notes |
|--------|--------|------|-------|
| Product Catalogue | ✅ | | JSON-backed, no DB table — fast reads |
| AI Chat Advisor | ✅ | | OpenAI integration, lead capture working |
| Quote Builder | ✅ | | Stripe checkout, PDF print |
| Floor Plan Upload | ✅ | | Multer upload, AI parsing |
| Office Move Radar | ✅ | | Full scan + outreach pipeline |
| Deal Hunter | ✅ | | Scan + push-to-pipeline + review workflow |
| Deal Intelligence | ✅ | | AI enrichment per deal |
| Intelligence Engine | ✅ | | Spending, SEO, issues, health, weekly report |
| Company Intelligence | ✅ | | Visitor session tracking + contact extraction |
| Relocation Intelligence | ✅ | | Generate + push-to-pipeline |
| Workspace Learning | ✅ | | Capture + conversion tracking |
| Workspace Strategy | ✅ | | AI recommendations + learning insights |
| Supplier Procurement | ✅ | | RFQ creation + AI email generation |
| Profit Engine | ✅ | | Cost stack + supplier mix + comparison |
| Partner Network | ✅ | | Routing + revenue share tracking |
| Follow-up Sequences | ✅ | | Automated email scheduling |
| Market Map | ⚠️ | UI_ONLY_MODULE | Uses Leaflet; needs backend map layer routes |
| Signal Ingestion | ❌ | BACKEND_ONLY_SERVICE | No service exists yet |
| Intelligence Map Layers | ❌ | SCHEMA_WITHOUT_API | No /api/map/layers/* routes |
| Job Orchestration | ⚠️ | PERFORMANCE_RISK | In-process timers only; no durability on crash |
| Building Risk Engine | ❌ | BACKEND_ONLY_SERVICE | Not implemented |
| Demand Forecast Engine | ❌ | BACKEND_ONLY_SERVICE | Not implemented |
| Zone Scoring Engine | ❌ | BACKEND_ONLY_SERVICE | Not implemented |
| Opportunity Engine | ❌ | BACKEND_ONLY_SERVICE | Not implemented |
| SAFE_MODE | ❌ | SECURITY_RISK | No env flag to disable external actions in staging |

## Tag Definitions

| Tag | Meaning |
|-----|---------|
| UI_ONLY_MODULE | Page exists but backend routes or DB support is incomplete |
| BACKEND_ONLY_SERVICE | Service exists but no UI or routes expose it |
| SCHEMA_WITHOUT_API | DB table defined but no API routes CRUD it |
| SYNTHETIC_PRODUCTION_PATH | Uses synthetic/mock data in production path |
| SECURITY_RISK | No auth guard or SAFE_MODE protection |
| PERFORMANCE_RISK | Potential bottleneck (in-process timers, missing indexes) |
| DATA_INTEGRITY_RISK | No dedupe constraint, possible duplicate records |

## Critical Issues

### DATA_INTEGRITY_RISK — Duplicate Signal Records
`office_move_radar` and `deal_hunter_signals` have no dedupe constraint.  
Repeated scans generate duplicate entries for the same company + signal.  
**Fix**: Add composite unique index on (normalized_company_name, normalized_city, signal_type, signal_window_bucket).

### PERFORMANCE_RISK — Missing DB Indexes
Hot query paths (filter by companyName, status, city, signalType, createdAt) have no indexes.  
**Fix**: Add indexes on all high-frequency filter columns.

### PERFORMANCE_RISK — In-Process Job Scheduler
`intelligenceScheduler.ts` uses `setInterval` / `setTimeout`.  
On process crash, all pending jobs are lost.  
**Fix**: Migrate to pg-boss durable job queue.

### SECURITY_RISK — No SAFE_MODE
Email sends, CRM pushes, supplier messages, and billing actions have no staging guard.  
**Fix**: Implement `SAFE_MODE` env flag.
