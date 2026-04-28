# Stage 19 Authenticated Admin API Test

| Endpoint | HTTP | Result |
|---|---:|---|
| `/api/admin/customer-competitor-quotes` | 200 | PASS |
| `/api/admin/procurement/quote-requests` | 200 | PASS |
| `/api/admin/procurement/whatsapp-outbox` | 200 | PASS |
| `/api/admin/procurement/send-audit` | 200 | PASS |
| `/api/admin/sales-psychology/playbook` | 200 | PASS |
| `/api/admin/autonomy-readiness` | 200 | PASS |
| `/api/admin/outreach/stats` | 200 | PASS |
| `/api/admin/outreach/safety-stats` | 200 | PASS |
| `/api/admin/nexora/monitor` | 000 | FAIL |
| `/api/admin/trading/monitor` | 200 | PASS |
| `/api/admin/office-move-radar` | 000 | FAIL |
| `/api/admin/deal-hunter/stats` | 000 | FAIL |
| `/api/admin/quotes` | 000 | FAIL |
| `/api/admin/follow-up-sequences` | 000 | FAIL |
| `/api/admin/revenue/stats` | 000 | FAIL |

## Guard result

- No-token request: HTTP 401
- Valid-token request header: `x-tcd-admin-token`
- Railway deployment was not run.
