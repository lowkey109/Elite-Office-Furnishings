# Money Mode Audit — Stage 1 Foundation Check
**Date**: 2026-03-17  
**Method**: Direct codebase inspection — no assumptions

---

## STAGE 1 — GLOBAL INTELLIGENCE GRAPH

| Sub-stage | Item | Status | Notes |
|-----------|------|--------|-------|
| 1.1 | `graph_edges` table | PARTIAL | Exists as `intelligence_graph_edges` — different field names (sourceType/targetType/edgeType vs from_entity_type/to_entity_type/relationship_type). No unique constraint — uses update-on-conflict query logic instead. No `confidence_score` field. |
| 1.2 | `GraphWriteService.upsertEdge()` | PARTIAL | Exists inside `intelligenceGraphService.ts` as local function, not exported class. Idempotent via select-then-update. Works. |
| 1.3 | Event-driven graph enrichment hooks | MISSING | No hooks exist on SIGNAL_CREATED, TENANT_CREATED, OPPORTUNITY_CREATED, etc. Only batch `buildGraphEdges()` called manually. |
| 1.4 | Graph Query Engine methods | MISSING | None of `getNeighbors`, `getSecondDegreeConnections`, `getCompanyNetwork`, `getConnectedOpportunities`, `getCompaniesInSameBuilding`, `getCompaniesInSameSuburb`, `getCompaniesInSameIndustry`, `getGraphPaths` exist. |
| 1.5 | `clusters` table | MISSING | Not in schema.ts. |
| 1.5 | Cluster Engine (compute job) | MISSING | `CLUSTERS_GENERATE` queue name defined but NO handler in jobOrchestrator.ts. No cluster detection logic exists. |
| 1.5 | CLUSTER_MEMBER edges | MISSING | No cluster-to-member edge creation anywhere. |
| 1.6 | `graph.enrich` job | MISSING | Not in QUEUES map. |
| 1.6 | `graph.rebuild_partial` job | MISSING | Not in QUEUES map. |
| 1.6 | `clusters.compute` job | MISSING | `CLUSTERS_GENERATE` name exists but no handler. |
| 1.6 | `graph.cleanup` job | MISSING | Not in QUEUES map. |
| 1.6 | `graph.refresh` job handler | PARTIAL | Queue name `GRAPH_REFRESH` defined. No case handler found in orchestrator's job dispatch switch. |
| 1.7 | Graph-derived weights in opportunity scoring | MISSING | `getTopOpportunities()` in opportunityEngine.ts does not call any graph functions. `clusterScoreWeight`, `networkSignalWeight`, `buildingInstabilityWeight`, `industryDensityWeight` do not exist. |
| 1.8 | `/api/map/layers/graph-connections` | MISSING | Route does not exist. |
| 1.8 | `/api/map/layers/clusters` | PARTIAL | Route exists but returns city-aggregated signal counts, NOT real cluster detection results. |
| 1.8 | `/api/map/layers/industry-density` | MISSING | Route does not exist. |
| 1.9 | ACC panel: Network Opportunities | MISSING | Not in AdminCommandCentre.tsx. |
| 1.9 | ACC panel: Cluster Alerts | MISSING | Not in AdminCommandCentre.tsx. |
| 1.9 | ACC panel: Graph-Based Building Risk | MISSING | Not in AdminCommandCentre.tsx. |
| 1.9 | ACC panel: Strategic Account Networks | MISSING | Not in AdminCommandCentre.tsx. |
| 1.9 | ACC panel: `panel-graph-stats` | IMPLEMENTED | Exists, shows totalEdges, edgesByType, topConnectedCompanies. |
| 1.10 | Alex tools: `getGraphConnections`, `getClusterInsights`, `getNetworkRisk`, `getAccountNetwork` | MISSING | Not in systemPrompt.ts, not in any Alex service. |
| 1.11 | Pagination on graph queries | N/A | No graph query engine to paginate yet. |
| 1.12 | SAFE_MODE on graph | IMPLEMENTED | `buildGraphEdges()` skips when SAFE_MODE=true. |

---

## STAGE 2 — ALEX v2 CORE SYSTEM

| Item | Status | Notes |
|------|--------|-------|
| `AlexAutonomousAgent` class/service | MISSING | Does not exist anywhere in codebase. Alex is a chat AI via systemPrompt, not an autonomous agent. |
| Opportunity detection loop | MISSING | No autonomous detection cycle. |
| Outreach trigger logic | MISSING | Outreach is triggered manually or via admin, not by Alex autonomously. |
| Follow-up automation | IMPLEMENTED | `followUpScheduler.ts` handles follow-up sequences via job. |
| Meeting booking automation | IMPLEMENTED | bookingService.ts exists. Not triggered by Alex. |
| Deal progress tracking | MISSING | `deal_execution` table does not exist. |
| Human escalation logic | MISSING | No escalation path defined. |

---

## STAGE 3 — DECISION ENGINE

| Item | Status | Notes |
|------|--------|-------|
| `AlexDecisionEngine` | MISSING | Does not exist. |
| Decision outputs: IGNORE, MONITOR, OUTREACH, PRIORITY_OUTREACH, BOOK_MEETING, ESCALATE_TO_HUMAN | MISSING | No such decision classification anywhere. |
| Input signals to decision | MISSING | No combined input layer (opportunity_score + graph + cluster + signals). |

---

## STAGE 4 — OUTREACH ENGINE INTEGRATION

| Item | Status | Notes |
|------|--------|-------|
| OutreachEngine (core) | IMPLEMENTED | `outreachEngine.ts` — 374 lines. createOutreachThread, processSequences, send, follow-up, dedup, cooldown. |
| OutreachGenerationService | IMPLEMENTED | Uses OpenAI to personalise messages with signal/graph context. |
| Alex triggering outreach | MISSING | Alex doesn't exist as autonomous agent to trigger it. |

---

## STAGE 5 — AUTO BOOKING ENGINE

| Item | Status | Notes |
|------|--------|-------|
| `bookingService.ts` | IMPLEMENTED | createBookingLink, recordBookingClick, confirmMeeting, getBookingStats. Provider-abstracted (Google/Calendly/manual). SAFE_MODE aware. |
| Trigger from Alex | MISSING | Alex doesn't exist as autonomous agent. |

---

## STAGE 6 — DEAL TRACKING SYSTEM

| Item | Status | Notes |
|------|--------|-------|
| `deal_execution` table | MISSING | Not in schema.ts. |
| Status flow: NEW → CONTACTED → ENGAGED → MEETING_BOOKED → PROPOSAL_SENT → NEGOTIATION → WON → LOST | MISSING | No such table or service. |

---

## STAGE 7 — STRIPE REVENUE INTEGRATION

| Item | Status | Notes |
|------|--------|-------|
| Stripe config service | IMPLEMENTED | stripeConfigService.ts — reads STRIPE_SECRET_KEY. |
| Payment link generation | IMPLEMENTED | paymentLinkService.ts — createPaymentLink, 159 lines. |
| Stripe webhooks | IMPLEMENTED | webhookService.ts — signature verification, idempotent processing, 271 lines. |
| Revenue logging | IMPLEMENTED | revenueService.ts, revenueEvents table. |
| Invoice generation | IMPLEMENTED | invoiceService.ts — 159 lines. |
| Deal → WON on payment | MISSING | Webhook handler doesn't update deal_execution (table doesn't exist). |
| Commission calculation on payment | MISSING | CommissionService exists but not wired to Stripe webhook. |

---

## STAGE 8 — GRAPH + ALEX CONNECTION

| Item | Status | Notes |
|------|--------|-------|
| Alex prioritises companies in high-growth clusters | MISSING | Alex doesn't exist as decision agent. |
| Alex targets buildings with at-risk tenants | MISSING | Same. |
| Alex surfaces second-degree opportunities | MISSING | Same. |
| Graph data feeding Alex decisions | MISSING | Same. |

---

## STAGE 9 — COMMAND CENTRE UPGRADE (Alex panels)

| Item | Status | Notes |
|------|--------|-------|
| Autonomous Deals Pipeline panel | MISSING | Not in AdminCommandCentre.tsx. |
| Alex Actions Feed panel | MISSING | Not in AdminCommandCentre.tsx. |
| High-Probability Deals panel | MISSING | Not in AdminCommandCentre.tsx. |
| Meetings Booked (Auto) panel | MISSING | Not in AdminCommandCentre.tsx (booking panel exists but not an "auto" Alex panel). |
| Revenue Forecast (AI-driven) panel | MISSING | Not in AdminCommandCentre.tsx. |

---

## STAGE 10 — ALEX ACTION LOGGING

| Item | Status | Notes |
|------|--------|-------|
| `alex_actions` table | MISSING | Not in schema.ts. |
| Action log service | MISSING | Does not exist. |

---

## STAGE 11 — SAFE MODE

| Item | Status | Notes |
|------|--------|-------|
| SAFE_MODE blocks email/LinkedIn | IMPLEMENTED | Checked in outreachEngine.ts, signalIngestionService.ts, intelligenceGraphService.ts, bookingService.ts. |
| SAFE_MODE labels simulated data | IMPLEMENTED | "SIMULATED" labels in booking/outreach. |
| SAFE_MODE blocks payments | PARTIAL | Stripe webhooks don't check SAFE_MODE. bookingService.ts does. |

---

## EXISTING SIGNAL + DATA INFRASTRUCTURE

| Item | Status | Notes |
|------|--------|-------|
| Signal ingestion pipeline | IMPLEMENTED | Full RSS → raw_signals → classify → intelligenceSignals. OpenAI classification. |
| rawSignals table | IMPLEMENTED | |
| intelligenceSignals table | IMPLEMENTED | |
| Opportunity Engine | IMPLEMENTED | `getTopOpportunities` aggregates from intelligenceSignals + officeMovRadar + dealHunterSignals. |
| Company Intelligence | IMPLEMENTED | companyIntelligence, companyContacts, companyBuildingEdges tables. |
| Lease records + expiry predictions | IMPLEMENTED | leaseRecords, leaseExpiryPredictions, leaseExpiryService.ts. |
| Buildings (Upgrade 9) | IMPLEMENTED | 10 AU buildings seeded, buildings/tenants/leases tables. |
| Proposals (Upgrade 9) | IMPLEMENTED | proposals, approvals, commissions tables. proposalService.ts. |
| Outreach threads + sequences | IMPLEMENTED | Full tables + outreachEngine.ts. |
| Meeting booking events | IMPLEMENTED | meetingBookingEvents table + bookingService.ts. |
| Partner network | IMPLEMENTED | partners, partnerOpportunities, partnerReferrals, commissions tables. |
| Stripe payment infrastructure | IMPLEMENTED | paymentCustomers, paymentLinks, paymentIntentsLog, invoicesLog, revenueEvents, webhookEvents. |

---

## SUMMARY FOR MONEY MODE ACTIVATION

### MUST BUILD (blocking Money Mode revenue loop)

1. **`deal_execution` + `alex_actions` tables** in schema + db:push
2. **`clusters` table** in schema + db:push
3. **Graph Query Engine** — 8 query methods (`getNeighbors`, `getSecondDegreeConnections`, `getCompanyNetwork`, `getConnectedOpportunities`, `getCompaniesInSameBuilding`, `getCompaniesInSameSuburb`, `getCompaniesInSameIndustry`, `getGraphPaths`)
4. **Cluster Engine** — cluster detection logic + `CLUSTER_MEMBER` edges + job handler for `clusters.generate`
5. **Graph weights in opportunity scoring** — `clusterScoreWeight`, `networkSignalWeight`, `buildingInstabilityWeight`, `industryDensityWeight`
6. **`AlexDecisionEngine`** — decision classification (IGNORE → ESCALATE_TO_HUMAN) from combined signals
7. **`AlexAutonomousAgent`** — job-based autonomous loop: opportunity scan → decision → outreach trigger → booking trigger → deal tracking
8. **`deal_execution` service** — track status NEW → WON, link to outreach/proposals/payments
9. **Job handlers** for `graph.refresh` and `clusters.generate` in jobOrchestrator
10. **Map layers** — `/api/map/layers/graph-connections` and `/api/map/layers/industry-density`
11. **Event hooks** — SIGNAL_CREATED, TENANT_CREATED, OPPORTUNITY_CREATED → graph enrichment
12. **ACC panels** — Autonomous Deals Pipeline, Alex Actions Feed, High-Probability Deals, Revenue Forecast
13. **Stripe → deal WON** wire — webhook updates deal_execution on payment success

### ALREADY SOLID (do not rebuild)
- Signal ingestion pipeline
- Outreach Engine (createOutreachThread, send, follow-up)
- Booking Engine (createBookingLink, confirmMeeting)
- Stripe infrastructure (payment links, webhooks, revenue events)
- Proposals/Approvals system (Upgrade 9)
- Building/Tenant database (Upgrade 9)
- Intelligence graph write engine (upsertEdge, buildGraphEdges)
- Safe Mode (outreach, signals, graph)
