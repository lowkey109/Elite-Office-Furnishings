#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
OUT_DIR="${OUT_DIR:-/tmp/nexora-poly-final}"
mkdir -p "$OUT_DIR"
PAYLOAD="$OUT_DIR/payload.json"

python3 - "$PAYLOAD" <<'PY'
import json, sys
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump({
        "mode": "paper_learning_to_real_money",
        "market": "example_polymarket_market",
        "side": "YES",
        "maxStakeUsd": 0,
        "reason": "Final readiness scaffold only. Not executable.",
        "liveTrading": False,
        "humanApprovalRequired": True,
        "externalSignerRequired": True
    }, f, separators=(",", ":"))
PY

get_route() {
  curl -sS -L --max-time 20 "$BASE_URL$1"
  echo
}

post_payload() {
  curl -sS -L --max-time 30 \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -X POST \
    --data-binary @"$PAYLOAD" \
    "$BASE_URL$1"
  echo
}

echo "== Final status =="
get_route "/api/nexora/poly-builds/final/status"

echo "== Final readiness =="
post_payload "/api/nexora/poly-builds/final/readiness"

echo "== Promotion gate =="
post_payload "/api/nexora/poly-builds/final/promotion-gate"

echo "== Trade intent draft =="
post_payload "/api/nexora/poly-builds/final/trade-intent-draft"

echo "== Final run =="
post_payload "/api/nexora/poly-builds/final/run"

echo "== Final latest =="
get_route "/api/nexora/poly-builds/final/latest"
