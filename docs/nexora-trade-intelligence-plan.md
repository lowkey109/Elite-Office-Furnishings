# Nexora Trade Intelligence Layer

## Purpose

Nexora helps PolyEdge decide whether to open a paper trade by combining multiple trading systems into one voting layer.

PolyEdge should trade less, but better.

## Signal Groups

### Trend
- EMA Trend Filter
- MACD Momentum
- ADX Trend Strength

### Breakout
- Donchian Channel Breakout
- Bollinger Squeeze
- Volume Confirmation

### Mean Reversion
- RSI Filter
- VWAP Deviation
- Bollinger Reversion

### Market Structure
- Support / Resistance
- Fibonacci Retracement / Extension
- Elliott Wave Confirmation

### Risk / Smart Money
- Liquidity Sweep / Stop-Hunt Scanner
- Market Regime Classifier
- News / Event Risk Filter

## Approval Rules

A paper trade should only be approved when:

- At least 4 systems agree
- Confidence is 70+
- Reward/risk is 1.5+
- Regime is not risk-off
- Spread/slippage risk is not high
- Learning history has not blocked the pair
- Paper-only safety is active

## Promotion Rules

### Testing
Tiny paper size only.

### Candidate
50+ trades, 48%+ win rate, profit factor 0.9+.

### Promoted
100+ trades, 55%+ win rate, profit factor 1.2+, positive P&L.

### Elite
300+ trades, 60%+ win rate, profit factor 1.5+, positive P&L.

## Key Rule

If no safe setup exists, Nexora should return monitor-only. It should not force a weak trade.
