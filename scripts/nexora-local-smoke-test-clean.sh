#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"

echo "============================================================"
echo "NEXORA CLEAN LOCAL SMOKE TEST"
echo "BASE_URL=$BASE_URL"
echo "============================================================"

for ROUTE in \
  "/api/nexora/ping" \
  "/api/nexora/active-loop/status" \
  "/api/nexora/loop-coverage/status" \
  "/api/nexora/office-agents/status" \
  "/api/nexora/human-boundary/status" \
  "/api/nexora/final-local-v1/status"
do
  echo "---- GET $ROUTE ----"
  curl -sS "$BASE_URL$ROUTE" -o /tmp/nexora-smoke.json
  node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync("/tmp/nexora-smoke.json","utf8")); console.log(JSON.stringify({ok:j.ok,nexoraBrain:j.nexoraBrain,service:j.service || null}, null, 2));'
done

echo "============================================================"
echo "NEXORA CLEAN LOCAL SMOKE TEST PASSED"
echo "============================================================"
