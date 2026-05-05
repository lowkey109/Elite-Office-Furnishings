# Binance Live Readiness Phase

This phase prepares supervised live execution safely.

Enabled:
- Signed account validation
- Exchange filter validation
- Dry-run order payload generation
- Trade intent creation
- Human approval workflow
- Audit logging
- Kill-switch architecture

Not enabled:
- Autonomous live trading
- Withdrawals
- Unattended money movement
- Background live execution loops

Required before any future live enablement:
1. Read-only API key testing
2. IP whitelist
3. Position sizing limits
4. Manual approval gate
5. Balance/risk verification
6. Full logging
7. Real-world paper validation period
