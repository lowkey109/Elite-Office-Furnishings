# MoonDev Import Notes

Imported from public fork:
MrFadiAi/ai-agents-for-trading

Useful source logic:
- Risk override prompt
- Strategy validation prompt
- Trading decision prompt
- Allocation prompt
- Base strategy signal interface

Current limits:
- Sentiment agent is not implemented.
- No direct Coinbase adapter found.
- No direct Polymarket adapter found.
- Treat as strategy/prompt/reference logic, not production execution code.

Nexora should adapt the ideas into existing TypeScript trading modules rather than run these Python files directly in production.
