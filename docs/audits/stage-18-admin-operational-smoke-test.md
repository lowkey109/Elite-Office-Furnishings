# Stage 18 Admin Operational Smoke Test

## Admin page route checks

| Route | HTTP | Result |
|---|---:|---|
| `/admin` | 200 | PASS |
| `/admin/dashboard` | 200 | PASS |
| `/admin/competitor-quotes` | 200 | PASS |
| `/admin/nexora-monitor` | 200 | PASS |
| `/admin/trading-monitor` | 200 | PASS |
| `/admin/office-move-radar` | 200 | PASS |
| `/admin/deal-hunter` | 200 | PASS |
| `/admin/quotes` | 200 | PASS |
| `/admin/procurement` | 200 | PASS |
| `/admin/follow-up-sequences` | 200 | PASS |

## Admin API checks

| Endpoint | HTTP | Result |
|---|---:|---|
| `/api/health` | 200 | PASS |
| `/api/admin/customer-competitor-quotes` | 200 | PASS |
| `/api/admin/procurement/quote-requests` | 401 | PASS |
| `/api/admin/procurement/whatsapp-outbox` | 401 | PASS |
| `/api/admin/procurement/send-audit` | 401 | PASS |
| `/api/admin/sales-psychology/playbook` | 401 | PASS |
| `/api/admin/autonomy-readiness` | 401 | PASS |
| `/api/admin/outreach/stats` | 401 | PASS |
| `/api/admin/outreach/safety-stats` | 401 | PASS |
| `/api/admin/nexora/monitor` | 401 | PASS |
| `/api/admin/trading/monitor` | 401 | PASS |
| `/api/admin/office-move-radar` | 401 | PASS |
| `/api/admin/deal-hunter/stats` | 401 | PASS |
| `/api/admin/quotes` | 401 | PASS |
| `/api/admin/follow-up-sequences` | 401 | PASS |
| `/api/admin/revenue/stats` | 401 | PASS |

## Uploaded competitor quote workflow

- Upload API: PASS
- Nexora decision record: PASS
- Admin list visibility: PASS
- Admin file download: PASS
- Submission ID: `competitor-quote-1777402125895`
