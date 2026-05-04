# Nexora NB — After Paper Autopilot Fix

## Current Mode
- Local only
- No deploy
- No Postgres
- No live trading
- No private keys

## Best Next Build
**Paper Autopilot Direct Mount + Trading Smoke Expansion**

## Why
The paper autopilot evidence generator is now expected to compile cleanly. The next step is ensuring:
- `/api/nexora/paper-autopilot/*` is direct-mounted in `server/index.ts`
- batch paper evidence can run through localhost
- evidence updates trading readiness
- trading dashboard reflects the new evidence

## Next Build Should Add
- Direct mount paper autopilot routes in `server/index.ts`
- Add paper autopilot to local smoke test
- Add trading smoke test script
- Add a single command to run paper batch + readiness + dashboard snapshot
- No live trading
- No private keys
- No deploy

## Do Not Build Yet
- Live CLOB execution
- Wallet/private key handling
- Postgres replay
- Railway deploy
