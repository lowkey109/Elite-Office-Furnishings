# Nexora PolyEdge Final Phase Lock

## Finished

- Admin login works
- Admin sidebar works
- PolyEdge dashboard route is live
- PolyEdge terminal v2 is live
- Paper summary sync is live
- Paper practice control API is live
- Binance paper system is live
- Binance live intent scaffold is live but locked
- Live-money safety is locked

## Main URLs

- `/admin/polyedge-aetherforge`
- `/nexora/polyedge-terminal-v2`
- `/admin/binance-paper`

## Core APIs

- `/api/nexora/poly-edge-fixed/state`
- `/api/nexora/poly-paper-summary/latest`
- `/api/nexora/paper-practice/control/status`
- `/api/nexora/binance/status`
- `/api/nexora/binance/paper/summary`
- `/api/nexora/binance/live/intents`
- `/api/nexora/live-money/status`

## Safety

- Live trading enabled: NO
- Private keys inside Nexora: NO
- Wallet signing inside Nexora: NO
- Bank transfers enabled: NO
- Postgres replay executed: NO

## Current Performance

- Current paper summary is real/synced data.
- 95% is a target, not faked.
- Dashboard must show actual measured performance only.

## Next Later

- Let paper practice collect more data.
- Improve Binance strategies beyond `trend_follow`.
- Add real wallet observation later, read-only first.
- Do not enable live trading until explicitly approved.
