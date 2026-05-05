# PolyEdge Master Reference

## Chosen Reference

Use the first uploaded POLY/EDGE blue/cyan terminal image as the master target.

## Required Page

/admin/polyedge-aetherforge

## Required Layout

1. Left vertical sidebar
2. Top system status strip
3. Hyperdimensional equity / real candle panel
4. Quantum market sentiment matrix
5. Alpha signals feed
6. Sentient agent mesh
7. Capital allocation / hyperstructure
8. Multiverse simulation
9. Hyper liquidity depth
10. Real-time smart money flow
11. Holographic universe view
12. Risk fortress status
13. Decision stream / live log
14. System alerts
15. Bottom market ticker

## Data Rules

No fake data.

- No fake candles
- No fake orderbook
- No fake wallet flow
- No fake PnL
- No fake win rate
- No fake 95%

If real data is missing, show:

WAITING FOR REAL DATA

## Data Sources

- MoonDev strategy status:
  /api/nexora/moondev-strategy-import/status

- Paper summary:
  /api/nexora/poly-paper-summary/latest

- PolyEdge fixed state:
  /api/nexora/poly-edge-fixed/state

- Binance candles:
  /api/nexora/binance/candles?symbol=BTCUSDT&interval=5m&limit=100

- Binance paper summary:
  /api/nexora/binance/paper/summary

- Live money lock:
  /api/nexora/live-money/status

- Bank connect:
  /api/nexora/bank-connect/status

## Wiring Rule

The page must be part of the admin dashboard and must keep the left admin menu.

Main route:

/admin/polyedge-aetherforge

Fullscreen route can exist, but it must not be the primary route:

/nexora/polyedge-terminal-v2

## Safety

- Live trading enabled: NO
- Private keys inside Nexora: NO
- Wallet signing inside Nexora: NO
- Bank automatic transfers: NO
