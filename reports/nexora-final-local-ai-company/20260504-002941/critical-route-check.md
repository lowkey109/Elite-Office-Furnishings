# Critical Nexora Route Check

Required routes: **43**
Missing routes: **5**

| Present | Route |
|---|---|
| yes | `GET /api/nexora/ping` |
| yes | `GET /api/nexora/live/status` |
| yes | `GET /api/nexora/runtime/diagnostic` |
| yes | `GET /api/nexora/office-agents/status` |
| yes | `POST /api/nexora/office-agents/tick` |
| yes | `POST /api/nexora/office-agents/lead/intake` |
| yes | `POST /api/nexora/office-agents/quote/draft` |
| yes | `POST /api/nexora/office-agents/supplier/request` |
| yes | `POST /api/nexora/office-agents/followup/draft` |
| yes | `POST /api/nexora/office-agents/project/scope` |
| yes | `GET /api/nexora/human-boundary/status` |
| yes | `POST /api/nexora/human-boundary/approve/request` |
| yes | `POST /api/nexora/human-boundary/sign/request` |
| yes | `POST /api/nexora/human-boundary/commit/request` |
| yes | `GET /api/nexora/human-company/status` |
| yes | `GET /api/nexora/human-company/owner-cockpit` |
| yes | `POST /api/nexora/human-company/approval/request` |
| yes | `POST /api/nexora/human-company/approval/decide` |
| yes | `GET /api/nexora/human-ops/status` |
| yes | `POST /api/nexora/human-ops/customer-journey/create` |
| yes | `POST /api/nexora/human-ops/supplier-desk/request` |
| yes | `POST /api/nexora/human-ops/install/plan` |
| yes | `POST /api/nexora/human-ops/owner-decision/create` |
| yes | `GET /api/nexora/company-run/status` |
| yes | `POST /api/nexora/company-run/daily-cycle` |
| yes | `POST /api/nexora/company-run/executive-pack` |
| NO | `GET /api/nexora/company-v2/status` |
| NO | `POST /api/nexora/company-v2/daily-run` |
| NO | `POST /api/nexora/company-v2/operator-cockpit` |
| yes | `GET /api/nexora/company-completion/status` |
| yes | `GET /api/nexora/company-completion/owner-cockpit` |
| yes | `GET /api/nexora/company-completion/daily-briefing` |
| yes | `GET /api/nexora/company-completion/approval-board` |
| yes | `GET /api/nexora/company-completion/responsibility-map` |
| yes | `GET /api/nexora/teaching/status` |
| yes | `POST /api/nexora/teaching/capability/assess` |
| yes | `POST /api/nexora/teaching/gap/create` |
| yes | `POST /api/nexora/teaching/lesson/create` |
| yes | `GET /api/nexora/rewards/status` |
| yes | `POST /api/nexora/rewards/create` |
| yes | `POST /api/nexora/rewards/praise` |
| NO | `GET /api/nexora/polymarket-paper/status` |
| NO | `POST /api/nexora/polymarket-paper/cycle` |