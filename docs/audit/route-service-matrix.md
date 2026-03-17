# Route-Service Matrix — Workspace Intelligence Platform
_Generated: 2026-03-17_

## Public Routes

| Method | Route | Service | DB Tables |
|--------|-------|---------|-----------|
| GET | /api/health | inline | — |
| GET | /api/leads | storage | leads |
| POST | /api/leads | storage + email | leads |
| POST | /api/chat | OpenAI | leads |
| GET | /api/products | productCatalog.json | — |
| GET | /api/products/curated | productCatalog.json | — |
| GET | /api/products/curated/:sku | productCatalog.json | — |
| GET | /api/products/categories | productCatalog.json | — |
| GET | /api/products/grouped | productCatalog.json | — |
| GET | /api/products/search | productCatalog.json | — |
| GET | /api/products/series/:series | productCatalog.json | — |
| GET | /api/products/sku/:sku | productCatalog.json | — |
| GET | /api/products/:sku/reviews | storage | product_reviews |
| POST | /api/products/:sku/reviews | storage | product_reviews |
| GET | /api/products/by-supplier/:supplierId | productCatalog.json | — |
| GET | /api/products/:sku/size-variants | productCatalog.json | — |
| GET | /api/suppliers | productCatalog.json | — |
| GET | /api/manufacturers | productCatalog.json | — |
| GET | /api/manufacturer-messages | storage | manufacturer_messages |
| POST | /api/ai/draft-manufacturer-message | OpenAI | manufacturer_messages |
| GET | /api/market-map | storage | office_move_radar |
| GET | /api/catalog/metadata | productCatalog.json | — |
| POST | /api/estimate | inline | — |
| POST | /api/finance-lead | email | leads |
| POST | /api/planning-requests | storage + email | planning_requests |
| GET | /api/planning-requests/:id/layout | floorPlanParser | planning_requests |
| GET | /api/planning-requests/:id/verify-payment | Stripe | planning_requests |
| POST | /api/planning-requests/:id/checkout | Stripe | planning_requests |
| POST | /api/track/pageview | storage | site_visits |
| POST | /api/track/visitor-session | storage | visitor_sessions |
| POST | /api/partners | storage | partners |
| GET | /api/partner-dashboard/:email | storage | partners, partner_opportunities |
| POST | /api/partner-opportunities/:id/respond | storage | partner_opportunities |
| POST | /api/whatsapp/send | whatsapp | — |
| POST | /webhook/whatsapp | whatsapp | leads |
| GET | /sitemap.xml | inline | — |

## Admin Routes (selected)

| Method | Route | Service | DB Tables |
|--------|-------|---------|-----------|
| GET | /api/admin/office-move-radar | storage | office_move_radar |
| POST | /api/admin/office-move-radar/scan | officeMovRadarService | office_move_radar |
| POST | /api/admin/office-move-radar/scan-all | officeMovRadarService | office_move_radar |
| GET | /api/admin/deal-hunter/signals | storage | deal_hunter_signals |
| POST | /api/admin/deal-hunter/run | dealHunter | deal_hunter_signals |
| GET | /api/admin/company-intelligence | storage | company_intelligence |
| POST | /api/admin/company-intelligence/sync | companyIntelligenceService | company_intelligence |
| GET | /api/admin/intelligence/jobs | storage | scheduled_jobs |
| POST | /api/admin/intelligence/jobs/trigger | intelligenceScheduler | scheduled_jobs |
| GET | /api/admin/heatmap-data | storage | company_intelligence |
| GET | /api/admin/analytics | storage | (aggregate) |

## Missing Routes (to be added in Stage 6)

| Method | Route | Status |
|--------|-------|--------|
| GET | /api/map/layers/buildings | ❌ Missing |
| GET | /api/map/layers/tenants | ❌ Missing |
| GET | /api/map/layers/signals | ❌ Missing |
| GET | /api/map/layers/movements | ❌ Missing |
| GET | /api/map/layers/demand | ❌ Missing |
| GET | /api/map/layers/building-risk | ❌ Missing |
| GET | /api/map/layers/opportunities | ❌ Missing |
| GET | /api/map/layers/zones | ❌ Missing |
| GET | /api/map/layers/clusters | ❌ Missing |
