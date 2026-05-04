#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-5000}"
BASE_URL="${BASE_URL:-http://127.0.0.1:$PORT}"

echo "============================================================"
echo "NEXORA LOCAL SMOKE TEST"
echo "BASE_URL=$BASE_URL"
echo "============================================================"

test_get() {
  local path="$1"
  echo "---- GET $path ----"
  curl -sS "$BASE_URL$path" | head -c 800
  echo
}

test_post() {
  local path="$1"
  local body="$2"
  echo "---- POST $path ----"
  curl -sS -X POST "$BASE_URL$path" \
    -H "Content-Type: application/json" \
    -d "$body" | head -c 1200
  echo
}

test_get "/api/nexora/ping"
test_get "/api/nexora/active-loop/status"
test_get "/api/nexora/loop-coverage/status"
test_get "/api/nexora/office-agents/status"
test_get "/api/nexora/human-boundary/status"
test_get "/api/nexora/teaching/status"
test_get "/api/nexora/rewards/status"
test_get "/api/nexora/final-local-v1/status"

test_post "/api/nexora/office-agents/lead/intake" '{"customerName":"Smoke Test","companyName":"Smoke Test Pty Ltd","email":"smoke@example.com","location":"Brisbane","need":"10 workstation package","budget":12000,"timeline":"4 weeks"}'
test_post "/api/nexora/product-catalogue/seed" '{}'
test_post "/api/nexora/quote-pack/create" '{"companyName":"Smoke Test Pty Ltd","customerName":"Smoke Test","items":[{"sku":"DESK-WORK-1600","quantity":10},{"sku":"CHAIR-ERG-TASK","quantity":10}]}'
test_post "/api/nexora/active-loop/tick" '{"forceHourly":true,"forceDaily":true}'

echo "============================================================"
echo "NEXORA LOCAL SMOKE TEST COMPLETE"
echo "============================================================"
