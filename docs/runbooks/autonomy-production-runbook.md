# Autonomy Production Runbook

## Runtime model

Nexora is the central execution authority. Workers are controlled through pg-boss. No production module should own an independent business loop.

## Required env vars

- DATABASE_URL
- SAFE_MODE
- TCD_AUTONOMY_OVERRIDE_TOKEN
- TCD_ALLOW_REAL_OUTREACH
- RESEND_API_KEY
- TCD_EMAIL_FROM_PLAIN

## Optional controlled-worker env vars

- NEXORA_LOOP_ENABLED
- PHANTOM_X_MARKET_LOOP_ENABLED
- PHANTOM_X_LIVE_PREAUTHORISED

## Kill switches

- TCD_AUTONOMY_EMERGENCY_STOP=true
- TCD_OUTBOUND_KILL_SWITCH=true
- PHANTOM_X_LIVE_KILL_SWITCH=true

## Deployment flow

1. Commit locally.
2. Push to GitHub.
3. Railway deploys from GitHub.
4. Confirm npm run check passed before push.
5. Confirm pg-boss health.
6. Confirm Nexora loop state says pg-boss.
7. Confirm SAFE_MODE and sender env vars are intentional.

## Rollback

Use GitHub/Railway rollback to last known good commit.

Recommended checkpoint before Phase 3F:

36f2cb5 Add durable decision memory learning foundation
