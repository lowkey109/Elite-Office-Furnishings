#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"

echo "============================================================"
echo "NEXORA RUN PAPER EVIDENCE ONCE"
echo "BASE_URL=$BASE_URL"
echo "============================================================"

curl -sS -X POST "$BASE_URL/api/nexora/paper-autopilot/batch" \
  -H "Content-Type: application/json" \
  -d '{"count":5,"asset":"BTC","openPrice":65000}' \
  -o /tmp/nexora-paper-batch.json

node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync("/tmp/nexora-paper-batch.json","utf8")); console.log(JSON.stringify({ok:j.ok, service:j.service || null, report:j.report || null}, null, 2));'

curl -sS -X POST "$BASE_URL/api/nexora/trading-readiness/evidence" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -o /tmp/nexora-paper-evidence.json

node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync("/tmp/nexora-paper-evidence.json","utf8")); console.log(JSON.stringify({ok:j.ok, service:j.service || null, summary:j.evidence?.summary || null}, null, 2));'

curl -sS -X POST "$BASE_URL/api/nexora/trading-readiness/gate" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -o /tmp/nexora-paper-gate.json

node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync("/tmp/nexora-paper-gate.json","utf8")); console.log(JSON.stringify({ok:j.ok, decision:j.gate?.decision || null, failed:j.gate?.failed?.length ?? null}, null, 2));'

curl -sS -X POST "$BASE_URL/api/nexora/trading-dashboard/snapshot" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -o /tmp/nexora-trading-dashboard.json

node -e 'const fs=require("fs"); const j=JSON.parse(fs.readFileSync("/tmp/nexora-trading-dashboard.json","utf8")); console.log(JSON.stringify({ok:j.ok, service:j.service || null, counts:j.snapshot?.counts || null, performance:j.snapshot?.performance || null}, null, 2));'

echo "============================================================"
echo "NEXORA PAPER EVIDENCE RUN COMPLETE"
echo "============================================================"
