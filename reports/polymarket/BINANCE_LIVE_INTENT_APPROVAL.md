# Binance Live Intent Approval Layer

Added:
- `/api/nexora/binance/live/intent`
- `/api/nexora/binance/live/intents`
- Saves proposed live orders as pending approval records
- Validates max position size via `BINANCE_MAX_POSITION_USDT`
- Does not place live orders

Purpose:
- Prepare the live execution workflow without accidental real orders.
