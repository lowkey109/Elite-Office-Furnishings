# Binance Paper Learning Engine

Installed:
- Paper wallet with fake USDT balance
- Paper open/close/evaluate APIs
- Stop-loss and take-profit logic
- Daily loss limit
- Max paper trade size
- Strategy runner:
  - trend_follow
  - breakout
  - rsi_reversal
  - volatility_guard
- Strategy stats and win/loss tracking
- Persistent JSON state at data/nexora/binance-paper-learning-state.json

Safety:
- Binance live trading remains disabled.
- No live orders.
- No withdrawals.
- No private keys in code.
- This engine learns on paper trades only.
