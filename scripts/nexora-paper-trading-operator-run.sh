#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"

echo "============================================================"
echo "NEXORA PAPER TRADING OPERATOR RUN"
echo "BASE_URL=$BASE_URL"
echo "============================================================"

curl -sS -X POST "$BASE_URL/api/nexora/market-data/cycle" \
  -H "Content-Type: application/json" \
  -d '{"asset":"BTC","symbol":"BTCUSDT","openPrice":65000,"currentPrice":65250,"yesPrice":0.52,"secondsToExpiry":300,"latencyMs":1200}' \
  -o /tmp/nexora-run-market.json

curl -sS -X POST "$BASE_URL/api/nexora/backtesting/run" \
  -H "Content-Type: application/json" \
  -d '{"asset":"BTC","count":120,"bankroll":1000,"startPrice":65000}' \
  -o /tmp/nexora-run-backtest.json

curl -sS -X POST "$BASE_URL/api/nexora/trading-execution/intent" \
  -H "Content-Type: application/json" \
  -d '{"marketId":"operator_market","asset":"BTC","side":"BUY_YES_PAPER","price":0.52,"sizeUsd":10}' \
  -o /tmp/nexora-run-intent.json

curl -sS -X POST "$BASE_URL/api/nexora/trading-readiness/evidence" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -o /tmp/nexora-run-evidence.json

curl -sS -X POST "$BASE_URL/api/nexora/trading-readiness/gate" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -o /tmp/nexora-run-gate.json

node - <<'NODE'
const fs = require("fs");
function read(file){ try { return JSON.parse(fs.readFileSync(file,"utf8")); } catch { return null; } }
const out = {
  market: read("/tmp/nexora-run-market.json")?.service || null,
  backtest: read("/tmp/nexora-run-backtest.json")?.report?.results || null,
  intent: read("/tmp/nexora-run-intent.json")?.intent?.status || null,
  evidence: read("/tmp/nexora-run-evidence.json")?.evidence?.summary || null,
  gate: read("/tmp/nexora-run-gate.json")?.gate?.decision || null,
};
console.log(JSON.stringify(out, null, 2));
NODE

echo "============================================================"
echo "NEXORA PAPER TRADING OPERATOR RUN COMPLETE"
echo "============================================================"
