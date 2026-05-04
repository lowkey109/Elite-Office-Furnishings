#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"

echo "============================================================"
echo "NEXORA POLYMARKET SUPER SMOKE"
echo "BASE_URL=$BASE_URL"
echo "PAPER ONLY — NO LIVE TRADING"
echo "============================================================"

json_get() {
  local route="$1"
  echo "---- GET $route ----"
  curl -sS "$BASE_URL$route" -o /tmp/nexora-poly-smoke.json
  node -e 'const fs=require("fs"); const raw=fs.readFileSync("/tmp/nexora-poly-smoke.json","utf8"); if(raw.trim().startsWith("<")){ console.error("HTML returned"); process.exit(1); } const j=JSON.parse(raw); console.log(JSON.stringify({ok:j.ok,nexoraBrain:j.nexoraBrain,service:j.service || null}, null, 2));'
}

json_post() {
  local route="$1"
  local body="$2"
  echo "---- POST $route ----"
  curl -sS -X POST "$BASE_URL$route" -H "Content-Type: application/json" -d "$body" -o /tmp/nexora-poly-smoke.json
  node -e 'const fs=require("fs"); const raw=fs.readFileSync("/tmp/nexora-poly-smoke.json","utf8"); if(raw.trim().startsWith("<")){ console.error("HTML returned"); process.exit(1); } const j=JSON.parse(raw); console.log(JSON.stringify({ok:j.ok,nexoraBrain:j.nexoraBrain,service:j.service || null, decision:j.gate?.decision || j.readiness?.decision || null, summary:j.summary || j.report?.summary || j.snapshot?.counts || j.health?.status || null}, null, 2));'
}

json_get "/api/nexora/ping"
json_get "/api/nexora/market-data/status"
json_get "/api/nexora/backtesting/status"
json_get "/api/nexora/trading-execution/status"
json_get "/api/nexora/trading-readiness/status"
json_get "/api/nexora/polymarket-final/status"
json_get "/api/nexora/live-money/status"
json_get "/api/nexora/live-execution-design/status"

json_post "/api/nexora/market-data/cycle" '{"asset":"BTC","symbol":"BTCUSDT","openPrice":65000,"currentPrice":65250,"yesPrice":0.52,"secondsToExpiry":300,"latencyMs":1200}'
json_post "/api/nexora/backtesting/run" '{"asset":"BTC","count":120,"bankroll":1000,"startPrice":65000}'
json_post "/api/nexora/trading-execution/intent" '{"marketId":"smoke_market","asset":"BTC","side":"BUY_YES_PAPER","price":0.52,"sizeUsd":10}'
json_post "/api/nexora/trading-readiness/evidence" '{}'
json_post "/api/nexora/trading-readiness/gate" '{}'
json_post "/api/nexora/polymarket-final/audit" '{}'
json_post "/api/nexora/polymarket-final/readiness" '{}'
json_post "/api/nexora/live-money/readiness" '{}'
json_post "/api/nexora/live-execution-design/report" '{}'

if curl -sS "$BASE_URL/api/nexora/paper-autopilot/status" -o /tmp/nexora-poly-smoke.json; then
  if ! grep -q "<!DOCTYPE html>\|<!doctype html>" /tmp/nexora-poly-smoke.json; then
    echo "---- POST /api/nexora/paper-autopilot/batch ----"
    curl -sS -X POST "$BASE_URL/api/nexora/paper-autopilot/batch" -H "Content-Type: application/json" -d '{"count":3,"asset":"BTC","openPrice":65000}' -o /tmp/nexora-poly-smoke.json
    node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync("/tmp/nexora-poly-smoke.json","utf8")); console.log(JSON.stringify({ok:j.ok,nexoraBrain:j.nexoraBrain,service:j.service || null,totalPnl:j.report?.totalPnl || null}, null, 2));'
  else
    echo "paper-autopilot routes not mounted; skipping."
  fi
fi

echo "============================================================"
echo "NEXORA POLYMARKET SUPER SMOKE COMPLETE"
echo "============================================================"
