#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
OUT_DIR="${OUT_DIR:-/tmp/nexora-bash2}"
mkdir -p "$OUT_DIR"
PAYLOAD="$OUT_DIR/payload.json"

python3 - "$PAYLOAD" <<'PY'
import json, sys
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump({
        "mode": "paper_learning_to_real_money",
        "drawdownPct": 12,
        "losingStreak": 6,
        "exposurePct": 28,
        "liveTrading": False,
        "externalSignerRequired": True,
        "humanApprovalRequired": True
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

echo "== Bash2 status =="
get_route "/api/nexora/poly-builds/bash2/status"

echo "== Bash2 risk =="
post_payload "/api/nexora/poly-builds/bash2/risk/run"

echo "== Bash2 operator summary =="
post_payload "/api/nexora/poly-builds/bash2/operator-summary"

echo "== Bash2 loop =="
post_payload "/api/nexora/poly-builds/bash2/loop/run"

echo "== Bash2 latest loop =="
get_route "/api/nexora/poly-builds/bash2/loop/latest"
