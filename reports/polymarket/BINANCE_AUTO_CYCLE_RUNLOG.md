# Binance Auto Cycle Run Logs

Added:
- Auto-cycle JSON logs saved to `data/nexora/binance-auto-cycles`
- History endpoint:
  - `/api/nexora/binance/paper/auto-cycle/history`
- Every run now returns `savedLog`

Purpose:
- Gives Nexora a paper-learning evidence trail.
- Lets us audit strategy runs, results, PnL, and win/loss history.
