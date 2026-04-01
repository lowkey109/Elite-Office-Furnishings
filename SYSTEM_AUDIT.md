# The Corporate Desk — Full System Audit
### April 2026 · Complete inventory, dead weight, and improvement plan

---

## WHAT THIS SYSTEM IS

A B2B intelligence and outreach platform for commercial office furniture sales in Australia.

**Core value proposition:** Detect companies likely to move, expand, or refit offices → automatically qualify them → push to pipeline or radar → do outreach → learn from outcomes.

**The engine that makes it real:** Nexora Autonomous OS — a closed-loop intelligence system:
`signal → decision → action → outcome → learning`

Everything else in the system either feeds Nexora, or supports the humans working the leads Nexora surfaces.

---

## FULL INVENTORY

### Backend
| File | Lines | What it does |
|---|---|---|
| `server/routes.ts` | 11,206 | All API endpoints — 418 routes total |
| `shared/schema.ts` | 3,141 | DB schema — 101 tables |
| `server/storage.ts` | 1,560 | Storage interface |
| `server/services/intelligence/nexoraOrchestrator.ts` | 1,222 | Nexora brain — signal collection, AI decision, action execution |
| `server/services/intelligence/nexora/nexora-support.ts` | 1,202 | Idempotency, push logic, learning, thresholds |
| `server/services/nexoraEngine.ts` | 914 | Legacy nexora engine (pre-orchestrator) |
| `server/services/intelligence/nexora/nexora-types.ts` | 307 | Types |
| `server/services/nexoraLoop.ts` | 149 | Autonomous loop scheduler |

### Services (server/services/)
44 service files. Below is the full list with status:

| Service | Status | Notes |
|---|---|---|
| `intelligence/nexoraOrchestrator.ts` | LIVE — CORE | The main engine. Proven 7/7 health |
| `intelligence/nexora-support.ts` | LIVE — CORE | Idempotency, push actions, learning |
| `intelligence/newsFeedScanner.ts` | LIVE | Scans Google News, SmartCompany, Startup Daily for signals |
| `intelligence/dealHunter.ts` | LIVE | Adzuna job ads + property feeds for signals |
| `intelligence/signalIngestionService.ts` | LIVE | Signal validation and deduplication |
| `intelligence/signalClassificationService.ts` | LIVE | AI classification of signals |
| `intelligence/opportunityEngine.ts` | LIVE | Opportunity scoring |
| `intelligence/officeMovRadarService.ts` | LIVE | Radar management |
| `intelligence/leaseExpiryService.ts` | LIVE | Lease expiry prediction |
| `intelligence/companyIntelligenceAggregationService.ts` | LIVE | Company data enrichment |
| `intelligence/companyHierarchyService.ts` | LIVE | Parent/subsidiary mapping |
| `intelligence/intelligenceGraphService.ts` | LIVE | Graph edges between companies/buildings |
| `intelligence/buildingRiskEngine.ts` | LIVE | Building-level risk scoring |
| `intelligence/confidenceScoringService.ts` | LIVE | Signal confidence calculation |
| `intelligence/demandForecastEngine.ts` | LIVE | Suburb/area demand prediction |
| `intelligence/clusterEngine.ts` | LIVE | Geographic cluster detection |
| `intelligence/zoneScoringEngine.ts` | LIVE | Zone/suburb scoring |
| `intelligence/workspaceIntelligenceEngine.ts` | LIVE | Workspace fit analysis |
| `intelligence/communications/` | LIVE | Outreach comms layer |
| `intelligence/partnerNetwork.ts` | LIVE | Partner referral scoring |
| `nexoraLoop.ts` | LIVE | Loop state management |
| `jobOrchestrator.ts` | LIVE | pg-boss queue management |
| `dealHunter.ts` | LIVE (ROOT) | Root-level deal hunter entry point |
| `newsFeedScanner.ts` | LIVE (ROOT) | Root-level scanner entry point |
| `intelligenceScheduler.ts` | LIVE | Scheduler (subordinated to Nexora) |
| `followUpScheduler.ts` | BROKEN | `budget_min column does not exist` — crashes on every cycle |
| `followUpEmails.ts` | LIKELY BROKEN | Depends on broken scheduler |
| `leaseSignalScanner.ts` | LIVE | Lease/property signal scanning |
| `outreach/` | LIVE | Outreach message building |
| `workspaceLearning.ts` | LIVE | Workspace quiz learning |
| `workspaceStrategy.ts` | LIVE | Strategy recommendation |
| `relocationIntelligence.ts` | LIVE | Relocation-specific signals |
| `dealIntelligence.ts` | LIVE | Deal stage intelligence |
| `leadIntelligence.ts` | LIVE | Lead enrichment |
| `leadEngine.ts` | LIVE | Lead scoring/ranking |
| `opportunityScoring.ts` | LIVE | Opportunity scoring |
| `productAI.ts` | LIVE | Product recommendations |
| `aiManufacturerOutreach.ts` | LIVE | AI draft messages to manufacturers |
| `whatsapp.ts` / `whatsappAI.ts` / `whatsappAssistant.ts` | LIVE | WhatsApp integration (3 overlapping files) |
| `supplierProcurement.ts` | LIVE | RFQ / supplier procurement |
| `profitOptimisation.ts` | LIVE | Margin/profit calculation |
| `companyIntelligenceService.ts` | LIVE | Company data (ROOT level) |
| `alex/` | DEAD | Alex AI — superseded entirely by Nexora |
| `nexoraEngine.ts` | SUPERSEDED | Pre-orchestrator engine — kept as fallback but not called |
| `nexoraAI.ts` | PARTIAL | Only called by old code paths |
| `intelligenceEngine.ts` | SUPERSEDED | Old engine, replaced by orchestrator |
| `partnerReferralAI.ts` | LIVE | Partner referral AI |
| `partnerScoring.ts` | LIVE | Partner scoring |
| `partnerAgreement.ts` | LIVE | Partner agreement generation |
| `realLeadSeeder.ts` | DEV ONLY | Seeds test leads — should never run in production |
| `runAllRealScans.ts` | DEV ONLY | Manual scan trigger — dev tool |
| `catalogNormaliser.ts` | LIVE | Normalises product catalog |
| `floorPlanParser.ts` | LIVE | Floor plan image analysis |
| `dealClosing/` | LIVE | Deal closing assistance |
| `stripe/` | LIVE | Stripe payment processing |
| `buildings/` | LIVE | Building data management |

---

### Database — 101 Tables

**CORE (keep, actively used):**
- `leads` — inbound enquiries
- `opportunities` — the spine; everything flows into/out of here
- `prospected_leads` — Nexora pipeline pushes
- `office_move_radar` — Nexora radar pushes
- `nexora_decisions` — AI decision audit log
- `nexora_outcomes` — win/loss feedback
- `nexora_thresholds` — adaptive decision calibration
- `nexora_knowledge` — company-level learning
- `nexora_idempotency_keys` — idempotency control
- `nexora_run_locks` — distributed lock
- `nexora_runs` — run history
- `raw_signals` / `intelligence_signals` / `deal_hunter_signals` — signal pipeline
- `quotes` / `planning_requests` / `supplier_quotes` — transactional
- `company_intelligence` / `company_contacts` — company graph
- `buildings` / `tenants` / `leases` / `lease_records` — property layer
- `outreach_messages` / `outreach_threads` / `outreach_sequences` — comms
- `follow_up_sequences` — follow-up automation
- `partners` / `partner_referrals` / `partner_agreements` — partner network
- `catalog_products` / `catalog_staging_items` — product data
- `payment_customers` / `payment_links` / `invoices_log` — Stripe
- `audit_logs` / `webhook_events` — audit

**OVERSIZED (consolidate or remove):**
- `building_risk_snapshots` — snapshots pile up with no purge policy
- `suburb_demand_snapshots` — same problem
- `company_zone_scores` — computed values that can be recalculated
- `intelligence_graph_edges` — graph data that may never be queried directly by UI
- `company_hierarchy_nodes` / `company_relationships` — likely populated, never used in UI
- `lease_expiry_predictions` — predictions exist but no UI uses them
- `signal_evidence` — evidence table populated but no UI shows it
- `contact_discovery_runs` / `contact_verification_logs` — logging tables, no cleanup
- `spending_trends` / `profit_records` / `revenue_share_records` — financial tables with no active UI showing them
- `ingested_leads` — staging table that may not be flushed
- `clusters` — geographic cluster data, no visible UI
- `scheduled_jobs` / `outreach_jobs` — duplicate with pg-boss native state
- `meeting_booking_events` — exists, no booking flow in UI

**DEAD (can drop):**
- `alex_actions` — Alex AI is gone
- `alex_company_runs` — Alex AI is gone
- `website_issues` — populated by a health check no longer running
- `generated_blog_articles` — blog is static, this auto-gen was abandoned
- `upload_queue` — upload flow replaced by direct storage
- `catalog_config` — never queried
- `commissions` — superseded by `partner_commissions`

---

### Frontend — 30+ Admin Pages

| Page | Status | Verdict |
|---|---|---|
| `AdminNexoraCommandCentre` | LIVE — CORE | ✅ Keep — just cleaned up |
| `AdminNexoraAdvanced` | LIVE — NEW | ✅ Keep |
| `AdminDashboard` | LIVE | ✅ Keep — top-level summary |
| `AdminLeads` | LIVE | ✅ Keep — 1,696 lines, consider splitting |
| `AdminPlanningRequests` | LIVE | ✅ Keep |
| `AdminQuotes` | LIVE | ✅ Keep |
| `AdminDealPipeline` | LIVE | ✅ Keep |
| `AdminOfficeMovRadar` | LIVE | ✅ Keep — radar view |
| `AdminDealHunter` | LIVE | ✅ Keep — signal browser |
| `AdminPartners` | LIVE | ✅ Keep |
| `AdminManufacturerMessaging` | LIVE | ✅ Keep |
| `AdminFollowUpSequences` | LIVE | ✅ Keep (but backend is broken) |
| `AdminProductCommandCentre` | LIVE | ✅ Keep |
| `AdminCatalogStaging` | LIVE | ✅ Keep |
| `AdminSupplierQuotes` | LIVE | ✅ Keep |
| `AdminLeadEngine` | QUESTIONABLE | ⚠️ Overlaps with AdminLeads — merge or remove |
| `AdminCommandCentre` | DEAD | ❌ Remove — superseded by AdminNexoraCommandCentre |
| `AdminAlexDashboard` | DEAD | ❌ Remove — Alex AI does not exist |
| `AdminIntelligenceHub` | DEAD | ❌ Remove — duplicates Nexora Signals/Decisions tabs |
| `AdminProfitEngine` | REDUNDANT | ❌ Remove or merge into AdminDashboard |
| `AdminWorkspaceLearning` | MINOR | ⚠️ Low value — workspace quiz results |
| `AdminWorkspaceStrategy` | MINOR | ⚠️ Low value — rarely used |
| `AdminTerritoryScanner` | MINOR | ⚠️ Territory management UI — one-time setup, doesn't need a full page |
| `AdminProcurementEngine` | MINOR | ⚠️ RFQ calculator — one form, full page overkill |
| `AdminRelocationIntelligence` | REDUNDANT | ❌ Data also in DealHunter/Nexora — duplicate view |
| `AdminLeaseSignals` | REDUNDANT | ❌ Signal data already shown in Nexora Signals tab |
| `AdminSupplierIntelligence` | QUESTIONABLE | ⚠️ Supplier scoring — mostly display, low action |
| `AdminDealIntelligence` | REDUNDANT | ❌ Overlaps with DealHunter and Nexora Decisions |
| `AdminMarketIntelligence` | REDUNDANT | ❌ Overlaps with Nexora Signals + DealHunter |
| `AdminCompanyVisitors` | BROKEN | ❌ Depends on `siteVisits` — backend crashes |
| `AdminPartnerNetwork` | OVERLAP | ⚠️ Overlaps with AdminPartners — merge |
| `BuildingDatabase` | LIVE | ✅ Keep — building data management |
| `ProposalEngine` | LIVE | ✅ Keep |
| `WorkspaceDesignEngine` | LIVE | ✅ Keep |
| `AdminAIChat` | MINOR | ⚠️ Internal AI chat — low usage evidence |
| `Marketing` | LIVE | ✅ Keep |

---

## CONFIRMED BUGS (Active in Production)

### BUG 1 — FollowUp Scheduler Crashes Every Hour
**Error:** `column "budget_min" does not exist`
**Location:** `server/services/followUpScheduler.ts`
**Impact:** Every scheduled follow-up email fails silently. No follow-ups are being sent automatically.
**Fix:** The `budget_min` column was renamed or removed from `leads`. Update the query to use `budgetMin` (camelCase ORM field) or whichever column name exists.

### BUG 2 — Analytics Tracking Broken
**Error:** `siteVisits is not defined`
**Location:** `server/routes.ts` — pageview/visitor-session tracking handlers
**Impact:** No website analytics are being recorded. Visitor session data is dead.
**Fix:** Import `siteVisits` from the schema before using it in the route handler.

### BUG 3 — Multiple Duplicate Nexora Run Routes
**Routes that all do the same thing:**
- `POST /api/nexora/run`
- `POST /api/nexora/run-now`
- `POST /api/nexora/loop/run-now`
- `POST /api/system/run`
- `router.post("/run")` (mounted under a subrouter)
- `router.post("/run-now")` (same subrouter)
**Impact:** Any client hitting the wrong route may double-trigger or fail silently. Wastes OpenAI credits.
**Fix:** Delete all but `POST /api/nexora/run`. Already done in the admin UI but server still has the dead routes.

### BUG 4 — WhatsApp Split Across 3 Files
**Files:** `whatsapp.ts`, `whatsappAI.ts`, `whatsappAssistant.ts`
**Impact:** Confusing maintenance. Unclear which handles inbound vs outbound vs AI drafting.
**Fix:** Merge into a single `whatsappService.ts` with clear exports.

### BUG 5 — `realLeadSeeder.ts` Is in Production Code
**File:** `server/services/realLeadSeeder.ts`
**Impact:** If called accidentally, it seeds fake test leads into the real database.
**Fix:** Delete it or gate with a `NODE_ENV !== 'production'` hard guard.

---

## WHAT TO GET RID OF

### Admin Pages — Delete These

```
/admin/command-centre      → superseded by /admin/nexora (done)
/admin/alex                → Alex AI is gone, tables are dead
/admin/intelligence-hub    → everything is in Nexora tabs
/admin/deal-intelligence   → everything is in DealHunter + Nexora
/admin/market-intelligence → everything is in Nexora Signals
/admin/relocation-intelligence → signals already in DealHunter
/admin/lease-signals       → signals already in Nexora Signals tab
/admin/profit-engine       → merge summary stats into AdminDashboard
/admin/company-visitors    → broken (siteVisits bug) — fix or delete
```

### Backend Routes — Delete These
- `POST /api/nexora/run-now` (duplicate of `/run`)
- `POST /api/nexora/loop/run-now` (duplicate of `/run`)
- `POST /api/system/run` (duplicate of `/run`)
- `router.post("/run")` and `router.post("/run-now")` under the subrouter
- All `GET /api/nexora/background-status` duplicates (appears 3 times)

### Services — Delete or Archive
- `server/services/alex/` — entire directory, Alex is dead
- `server/services/nexoraEngine.ts` — old engine, orchestrator replaced it
- `server/services/nexoraAI.ts` — old AI caller, not in active path
- `server/services/intelligenceEngine.ts` — old engine, replaced
- `server/services/realLeadSeeder.ts` — dangerous in production
- `server/services/runAllRealScans.ts` — dev tool, not production code

### Database Tables — Drop These
```sql
DROP TABLE alex_actions;
DROP TABLE alex_company_runs;
DROP TABLE website_issues;
DROP TABLE generated_blog_articles;
DROP TABLE upload_queue;
DROP TABLE catalog_config;
DROP TABLE commissions;          -- superseded by partner_commissions
```

---

## HOW TO MAKE IT BETTER — PRIORITY ORDER

### Priority 1 — Fix the Broken Things (This Week)

**1a. Fix FollowUp Scheduler**
Find the query in `followUpScheduler.ts` that references `budget_min` and update it.
This is the most immediately damaging bug — zero automated follow-ups are going out.

**1b. Fix siteVisits Analytics**
Add `import { siteVisits } from "@shared/schema"` where it is missing.
Visitor session tracking is completely dark.

**1c. Delete the duplicate Nexora run routes**
Clean the 5 duplicate routes from `routes.ts`. The admin UI already only calls one.

---

### Priority 2 — Consolidate the Admin (This Month)

**2a. Merge AdminLeads + AdminLeadEngine**
`AdminLeads.tsx` is 1,696 lines and `AdminLeadEngine` covers the same data.
Split `AdminLeads` into components (Lead list, Lead detail, Lead pipeline) and remove `AdminLeadEngine`.

**2b. Delete 8 redundant admin pages**
Listed above. Remove routes from `App.tsx` and delete the files.

**2c. Merge AdminPartners + AdminPartnerNetwork**
Both show partner data. One view, well structured.

**2d. Move AdminProfitEngine data into AdminDashboard**
Profit metrics belong in the main dashboard summary, not a dedicated page.

---

### Priority 3 — Database Cleanup (This Month)

**3a. Drop the 7 dead tables**
They are accumulating rows forever with no consumers.

**3b. Add purge policies to snapshot tables**
`building_risk_snapshots`, `suburb_demand_snapshots`, `contact_discovery_runs`, `contact_verification_logs` have no row-count limits or TTL.
Add a nightly cleanup job: keep last 90 days, delete older.

**3c. Audit `intelligence_signals` and `raw_signals`**
These grow without bound. Confirm what the maximum useful age is (probably 6 months) and schedule a purge.

---

### Priority 4 — Nexora Quality (Next Month)

**4a. Increase decision volume — fix Adzuna 429s**
The deal hunter is hitting Adzuna rate limits on every run (429 Too Many Requests on all 10 search terms). This means job-ad signals are not being collected at all. 
Fix: Stagger Adzuna calls with 2-second delays between each, or reduce to 3-4 search terms.

**4b. Wire outcomes back to Nexora more automatically**
Currently someone has to manually click "Record Outcome" in the Outcomes tab.
Better: Auto-detect wins from the `quotes` table (quote → won), and auto-detect losses when a lead is marked `lost`. That populates `nexora_outcomes` without human input.

**4c. Add signal deduplication quality report**
The scanner logs show many duplicates being skipped. A weekly report showing:
- signals scanned vs saved ratio
- top deduplication reasons
- companies seen most often
would let you tune the scanner to get better yield.

**4d. Increase `MIN_LEARNING_SAMPLE` over time**
Currently set to 3. As outcomes accumulate, raise to 10, then 20 for more stable threshold adjustment. This should be a setting in the admin Settings tab, not a hardcoded constant.

---

### Priority 5 — New Features Worth Building

**5a. Nexora → CRM Bridge (High Value)**
When Nexora pushes a company to pipeline, it creates a `prospected_lead` but does NOT create an `opportunity` in the core CRM. The humans have to do that manually.
Build: On `push_pipeline`, auto-create an `opportunity` record with `sourceType: "nexora"` and pre-fill company, city, signal type, score.

**5b. Automated Follow-Up Trigger from Nexora**
When Nexora qualifies a company and pushes to radar/pipeline, it should automatically enqueue a follow-up sequence (WhatsApp or email) rather than waiting for human approval.
Gated behind the existing `outreach_messages` approval queue, so it's safe.

**5c. Win Rate Dashboard by Signal Type**
Nexora records outcomes but there's no chart showing: "When we act on office_expansion signals, we win X% of the time vs hiring_surge signals."
This should be on the Outcomes tab — a simple table, no charting library needed.

**5d. Lease Expiry Alerts**
The `lease_expiry_predictions` table is being populated but nothing surfaces the predictions in the UI or triggers an alert.
Add a simple "Leases Expiring in 90 Days" panel to the Nexora Signals tab, sourced from this table.

**5e. Real-Time Nexora Progress**
When "Run Nexora" is clicked, the UI freezes waiting for a response (can take 60+ seconds).
Fix: Run Nexora in a background job (pg-boss), return a job ID immediately, poll for progress.
The pg-boss infrastructure already exists — this is a wiring change, not architecture.

---

## SYSTEM ARCHITECTURE — HOW IT ACTUALLY WORKS

```
SIGNAL SOURCES
  ├── Google News / SmartCompany / Startup Daily (newsFeedScanner)
  ├── Adzuna job ads (dealHunter) ← currently 429 rate-limited
  ├── Property/lease RSS feeds (dealHunter)
  ├── Inbound website leads (leads table)
  └── Manual entry

        ↓ dedup + classify (AI)

RAW SIGNALS TABLE
  office_move_radar (status: New)
  deal_hunter_signals

        ↓ POST /api/nexora/run

NEXORA ORCHESTRATOR (nexoraOrchestrator.ts)
  1. collectSignals() — pulls unprocessed signals
  2. AI decision per signal (GPT-4o) — action: push_pipeline | push_radar | review | hold
  3. Idempotency check (nexora_idempotency_keys)
  4. Execute action:
     push_radar    → office_move_radar.status = "Qualified"
     push_pipeline → prospected_leads table INSERT
     review        → outreach_messages table INSERT (awaits human approval)
  5. applyLearningFromRun() — adjust thresholds from recent outcomes

        ↓

HUMAN LAYER
  AdminNexoraCommandCentre
  ├── See what Nexora decided
  ├── Approve/reject outreach
  ├── Record outcomes (won/lost)
  └── Run again or set auto loop

        ↓

OUTCOMES → nexora_outcomes → recalibrate thresholds → next run is smarter
```

---

## SUMMARY SCORECARD

| Area | Score | Verdict |
|---|---|---|
| Nexora Engine | 9/10 | Working perfectly. 7/7 health. Proven. |
| Signal Collection | 5/10 | Broken by Adzuna 429s. Scanner works but Adzuna blocked. |
| Follow-Up Automation | 0/10 | Completely broken — `budget_min` crash on every cycle |
| Analytics | 0/10 | Completely broken — `siteVisits` undefined |
| Admin UI | 7/10 | Just cleaned up. Still too many redundant pages. |
| Database | 4/10 | 101 tables, several dead, no purge policies, growing forever |
| Routes | 3/10 | 418 routes in one 11k-line file. Multiple duplicates. |
| Code Size | 3/10 | ~20k lines of admin pages alone. Massive duplication. |
| Partner System | 7/10 | Works, somewhat underused |
| Product Catalog | 8/10 | Clean, well structured |
| Payments | 8/10 | Stripe working |

**The biggest lever:** Fix the follow-up scheduler (`budget_min` bug). Right now, every lead that comes in is orphaned — no automated follow-up goes out. That single fix immediately restores automated nurture across all leads.

**The highest ROI new feature:** Auto-create opportunities from Nexora pipeline pushes. Currently the engine does the hard work of finding qualified companies but a human has to manually create the CRM record. That friction kills the closed loop.
