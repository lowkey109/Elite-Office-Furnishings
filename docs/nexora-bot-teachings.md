# Nexora Bot Teaching Layer

Nexora now has a structured teaching layer for the 15 core lessons used by serious bot builders.

## The 15 Teachings

1. Market regime recognition
2. Risk management before entries
3. Profit factor over win rate
4. Adaptive position sizing
5. Multi-signal agreement
6. Trade filtering
7. Backtesting required
8. Walk-forward validation
9. Real candle data required
10. Volatility-aware stops
11. Drawdown control
12. Symbol personality
13. News/event awareness
14. Trade journal memory
15. Promotion/blocking system

## Purpose

The teaching layer does not randomly open trades.

It adds trade-aware rules and teaching signals into Nexora's voting process.

## Core Rule

Nexora should trade less, but better.

Weak learning means:
- micro paper risk
- more blocking
- monitor-only when needed

Strong evidence means:
- candidate
- promoted
- elite

## Future Extension

Add more teachings to:

server/services/trading/knowledge/nexoraBotTeachingRegistry.ts

Each teaching should describe:
- lesson
- rule
- trade impact
- symbols
- strategies
