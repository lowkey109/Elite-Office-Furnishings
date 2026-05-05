#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
PAYLOAD="/tmp/nexora-poly-operator-payload.json"

python3 - "$PAYLOAD" <<'PY'
import json, sys
json.dump({
  "mode": "paper_learning_to_supervised_real_money",
  "market": "example_polymarket_market",
  "side": "YES",
  "maxStakeUsd": 0,
  "liveTrading": False,
  "humanApprovalRequired": True,
  "externalSignerRequired": True
}, open(sys.argv[1], "w"), separators=(",", ":"))
PY

echo "== production operator status =="
curl -sS "$BASE_URL/api/nexora/poly-operator/production/status"
echo

echo "== command center run =="
curl -sS -H "Content-Type: application/json" --data-binary @"$PAYLOAD" "$BASE_URL/api/nexora/poly-operator/production/run"
echo

echo "== trade intent review =="
curl -sS -H "Content-Type: application/json" --data-binary @"$PAYLOAD" "$BASE_URL/api/nexora/poly-operator/production/trade-intent-review"
echo

echo "== signer review =="
curl -sS -H "Content-Type: application/json" --data-binary @"$PAYLOAD" "$BASE_URL/api/nexora/poly-operator/production/signer-review"
echo

echo "== latest =="
curl -sS "$BASE_URL/api/nexora/poly-operator/production/latest"
echo
