# Binance Operational Paper-Ready Integration

Installed:
- Binance public market data endpoints
- Binance signed account-readiness endpoint
- Binance signed account snapshot endpoint
- Binance paper order endpoint
- Binance paper trade history endpoint
- Locked live order endpoint

Safety:
- Paper mode is enabled by default.
- Live trading is disabled unless BINANCE_LIVE_TRADING_ENABLED=true.
- Withdrawals are never enabled here.
- Secrets are only read from environment variables.
- No private keys are written to code.
- Live order adapter still returns blocked/not implemented even if kill-switch is enabled, requiring a final owner-approved patch later.
