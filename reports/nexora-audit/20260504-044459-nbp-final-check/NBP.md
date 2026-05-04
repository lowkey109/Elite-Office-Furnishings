# Nexora Next Best Plan

## Current Position

Local build mode is correct.

Do not deploy until:
- Postgres storage is upgraded.
- DB health check passes.
- Replay dry-runs are clean.

## Immediate Priority

1. Keep TypeScript healthy.
2. Keep routes wired and smoke-tested.
3. Finish local owner cockpit and operator workflows.
4. Keep Polymarket trading paper-only.
5. Build only missing modules, not duplicates.

## Next Best Build

**Nexora Local Operator Dashboard Polish Build**

Should add:
- HTML route for trading dashboard
- HTML route for office/company dashboard
- HTML route for approval/sign/commit queue
- HTML route for product/quote management
- Single `/nexora` local dashboard home
- No deploy
- No Postgres
- No live trading

## After That

- Product CSV import/export
- Quote PDF/download
- Paper trading evidence dashboard
- Final local v1 release report
- Postgres migration pack after storage upgrade
