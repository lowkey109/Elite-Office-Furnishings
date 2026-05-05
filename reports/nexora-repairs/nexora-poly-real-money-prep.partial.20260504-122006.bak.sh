#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
OUT_DIR="${OUT_DIR:-/tmp/nexora-real-money-prep}"
mkdir -p "$OUT_DIR"
PAYLOAD="$OUT_DIR/payload.json"

python3 - "$PAYLOAD" <<'PY'
import json, sys
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump({
        "mode": "paper_learning_to_supervised_real_money",
        "futureFirstTestStakeUsd": 0,
        "maxDrawdownPct": 10,
        "maxLosingStreak": 5,
        "maxExposurePct": 25,
        "liveTrading": False,
        "humanApprovalRequired": True,
        "externalSignerRequired": True
    }, f, separators=(",", ":"))
PY

get_route() {
  echo ""
  echo "== GET $1 =="
  curl -sS -L --max-time 20 "$BASE_URL$1"
  echo
}

post_payload() {
  echo ""
  echo "== POST $1 =="
  curl -sS -L --max-time 30 \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -X POST \
    --data-binary @"$PAYLOAD" \
    "$BASE_URL$1"
  echo
}

get_route "/api/nexora/poly-real-money-prep/status"
post_payload "/api/nexora/poly-real-money-prep/learning-scorecard"
post_payload "/api/nexora/poly-real-money-prep/capital-policy"
post_payload "/api/nexora/poly-real-money-prep/approval-packet"
post_payload "/api/nexora/poly-real-money-prep/signer-handoff"
post_payload "/api/nexora/poly-real-money-prep/supervised-test-plan"
post_payload "/api/nexora/poly-real-money-prep/run"
get_route "/api/nexora/poly-real-money-prep/latest"
