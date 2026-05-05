# Auth Hardening Ready

## Purpose

Document and expose production auth hardening plan.

## Rules

- Admin login uses server API
- ADMIN_EMAIL from Railway variables
- ADMIN_PASSWORD from Railway variables
- No hardcoded production password
- Bank/live-money routes must be protected
- Live trading remains separately locked

## Routes

- /api/nexora/auth-hardening/status
- /api/nexora/auth-hardening/checklist
- /api/nexora/auth-hardening/route-map
