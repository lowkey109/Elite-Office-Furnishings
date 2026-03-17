# Schema Usage Matrix — Workspace Intelligence Platform
_Generated: 2026-03-17_

## Existing Tables

| Table | Has API Routes | Has UI | Has Indexes | Notes |
|-------|---------------|--------|-------------|-------|
| users | ✅ | ✅ | unique(username) | Admin auth |
| leads | ✅ | ✅ | — | PERFORMANCE_RISK |
| prospected_leads | ✅ | ✅ | — | PERFORMANCE_RISK |
| territories | ✅ | ✅ | — | |
| supplier_quotes | ✅ | ✅ | — | |
| referrals | ✅ | ✅ | — | |
| planning_requests | ✅ | ✅ | — | |
| product_reviews | ✅ | ✅ | — | |
| follow_up_sequences | ✅ | ✅ | — | |
| workspace_learning_records | ✅ | ✅ | — | |
| manufacturer_messages | ✅ | ✅ | — | |
| scheduled_jobs | ✅ | ✅ | — | |
| intelligence_reports | ✅ | ✅ | — | |
| spending_trends | ✅ | ✅ | — | |
| website_issues | ✅ | ✅ | — | |
| profit_records | ✅ | ✅ | — | |
| quotes | ✅ | ✅ | — | |
| office_move_radar | ✅ | ✅ | — | DATA_INTEGRITY_RISK: no dedupe |
| building_signals | ✅ | ✅ | — | |
| deal_intelligence_records | ✅ | ✅ | — | |
| generated_blog_articles | ✅ | ✅ | — | |
| partners | ✅ | ✅ | — | |
| partner_opportunities | ✅ | ✅ | — | |
| partner_referrals | ✅ | ✅ | — | |
| revenue_share_records | ✅ | ✅ | — | |
| relocation_signals | ✅ | ✅ | — | |
| deal_hunter_signals | ✅ | ✅ | — | DATA_INTEGRITY_RISK: no dedupe |
| workspace_strategy_recommendations | ✅ | ✅ | — | |
| site_visits | ✅ | — | — | |
| supplier_profiles | ✅ | ✅ | unique(supplier_id) | |
| rfq_projects | ✅ | ✅ | — | |
| rfq_responses | ✅ | ✅ | — | |
| visitor_sessions | ✅ | ✅ | — | |
| company_intelligence | ✅ | ✅ | — | |
| company_contacts | ✅ | ✅ | — | |

## New Tables Required (Stage 2)

| Table | Purpose |
|-------|---------|
| intelligence_sources | Track data source connectors (RSS feeds, job boards, etc.) |
| raw_signals | Capture unprocessed signals before normalization |
| intelligence_signals | Normalized, classified, scored signals |
| signal_evidence | Supporting evidence for signals |
| job_runs | pg-boss job execution history |
| job_locks | pg-boss distributed locks |
| company_building_edges | Company-to-building relationship graph |
| company_zone_scores | Zone-level demand scores per company |
| building_risk_snapshots | Point-in-time building risk scores |
| suburb_demand_snapshots | Point-in-time suburb demand scores |
