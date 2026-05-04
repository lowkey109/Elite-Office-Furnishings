#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"

echo "============================================================"
echo "NEXORA LOCAL TRADING SMOKE TEST"
echo "BASE_URL=$BASE_URL"
echo "NO LIVE TRADING — PAPER ONLY"
echo "============================================================"

json_get() {
  local route="$1"
  echo "---- GET $route ----"
  curl -sS "$BASE_URL$route" -o /tmp/nexora-trading-smoke.json
  node -e 'const fs=require("fs"); const raw=fs.readFileSync("/tmp/nexora-trading-smoke.json","utf8"); if(raw.trim().startsWith("<")){ console.error("HTML returned, route not mounted"); process.exit(1); } const j=JSON.parse(raw); console.log(JSON.stringify({ok:j.ok,nexoraBrain:j.nexoraBrain,service:j.service || null}, null, 2));'
}

json_post() {
  local route="$1"
  local body="$2"
  echo "---- POST $route ----"
  curl -sS -X POST "$BASE_URL$route" -H "Content-Type: application/json" -d "$body" -o /tmp/nexora-trading-smoke.json
  node -e 'const fs=require("fs"); const raw=fs.readFileSync("/tmp/nexora-trading-smoke.json","utf8"); if(raw.trim().startsWith("<")){ console.error("HTML returned, route not mounted"); process.exit(1); } const j=JSON.parse(raw); console.log(JSON.stringify({ok:j.ok,nexoraBrain:j.nexoraBrain,service:j.service || null, summary:j.summary || j.report?.results || j.counts || null}, null, 2));'
}

json_get "/api/nexora/paper-autopilot/status"
json_get "/api/nexora/trading-dashboard/status"
json_get "/api/nexora/trading-execution/status"
json_get "/api/nexora/trading-readiness/status"
json_get "/api/nexora/market-data/status"
json_get "/api/nexora/backtesting/status"

json_post "/api/nexora/paper-autopilot/cycle" '{"asset":"BTC","openPrice":65000,"currentPrice":65200,"finalPrice":65300,"yesPrice":0.52,"secondsToExpiry":300}'
json_post "/api/nexora/paper-autopilot/batch" '{"count":3,"asset":"BTC","openPrice":65000}'
json_post "/api/nexora/trading-readiness/gate" '{}'
json_post "/api/nexora/trading-dashboard/snapshot" '{}'

echo "============================================================"
echo "NEXORA LOCAL TRADING SMOKE TEST PASSED"
echo "============================================================"
