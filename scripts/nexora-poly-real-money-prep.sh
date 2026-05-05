#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
PAYLOAD="/tmp/nexora-real-money-prep-payload.json"

python3 - "$PAYLOAD" <<'PY'
import json, sys
json.dump({
  "mode": "paper_learning_to_supervised_real_money",
  "futureFirstTestStakeUsd": 0,
  "maxDrawdownPct": 10,
  "maxLosingStreak": 5,
  "maxExposurePct": 25,
  "liveTrading": False,
  "humanApprovalRequired": True,
  "externalSignerRequired": True
}, open(sys.argv[1], "w"), separators=(",", ":"))
PY

echo "== status =="
curl -sS "$BASE_URL/api/nexora/poly-real-money-prep/status"
echo

echo "== run =="
curl -sS -H "Content-Type: application/json" --data-binary @"$PAYLOAD" "$BASE_URL/api/nexora/poly-real-money-prep/run"
echo

echo "== latest =="
curl -sS "$BASE_URL/api/nexora/poly-real-money-prep/latest"
echo
