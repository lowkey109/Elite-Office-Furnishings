# Scheduler Job Inventory — Workspace Intelligence Platform
_Generated: 2026-03-17_

## Current Jobs (In-Process Timers)

| Job Name | Interval | First Delay | Service | Tables Written |
|----------|----------|-------------|---------|---------------|
| system_health | 12h | 30s | intelligenceEngine | intelligence_reports |
| spending_trends | 24h | 5min | intelligenceEngine | spending_trends |
| website_issues | 24h | 10min | intelligenceEngine | website_issues |
| seo_content | 7d | 15min | intelligenceEngine | generated_blog_articles |
| weekly_report | 7d | 20min | intelligenceEngine | intelligence_reports |
| radar_scan | 24h | 35min | officeMovRadarService | office_move_radar |
| deal_hunter | 24h | 45min | dealHunter | deal_hunter_signals |
| news_rss_scan | 12h | 60min | newsFeedScanner | office_move_radar |
| job_signal_scan | 12h | 90min | officeMovRadarService | office_move_radar |
| predictive_scan | 12h | 120min | officeMovRadarService | office_move_radar |
| global_radar_scan | 24h | 150min | officeMovRadarService | office_move_radar |
| company_intel_sync | 6h | 180min | companyIntelligenceService | company_intelligence |

## Issues

| Issue | Tag | Resolution |
|-------|-----|-----------|
| Jobs lost on process crash | PERFORMANCE_RISK | Migrate to pg-boss |
| No job deduplication | DATA_INTEGRITY_RISK | pg-boss singleton jobs |
| No distributed lock | DATA_INTEGRITY_RISK | pg-boss job locking |
| No retry logic | PERFORMANCE_RISK | pg-boss retry config |
| No dead letter queue | PERFORMANCE_RISK | pg-boss failure queue |
| No manual trigger history | — | pg-boss job_runs table |

## pg-boss Queue Mapping (Stage 5)

| Old Timer | pg-boss Queue | Singleton | Retry |
|-----------|--------------|-----------|-------|
| system_health | scan.all | yes | 2 |
| news_rss_scan | scan.news | yes | 3 |
| job_signal_scan | scan.jobs | yes | 3 |
| predictive_scan | scan.predictive | yes | 2 |
| radar_scan | scan.all | yes | 2 |
| deal_hunter | scan.all | yes | 2 |
| global_radar_scan | scan.all | yes | 2 |
| company_intel_sync | company.sync | yes | 3 |
| followup emails | followups.send | no | 3 |
| building risk | building-risk.refresh | yes | 2 |
| demand aggregate | demand.aggregate | yes | 2 |
| cluster generation | clusters.generate | yes | 2 |
| alert generation | alerts.generate | yes | 2 |
