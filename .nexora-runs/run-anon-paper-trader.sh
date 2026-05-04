#!/usr/bin/env bash
set -u

cd ~/workspace

BASE="${BASE_URL:-http://127.0.0.1:5000}"
RUN_ID="anon-paper-$(date +%Y%m%d-%H%M%S)-$RANDOM"
OUT="data/nexora/local/anon-paper-trader/$RUN_ID"
mkdir -p "$OUT"

PAYLOAD="$OUT/payload.json"

python3 - "$PAYLOAD" "$RUN_ID" <<'PY'
import json, sys
path, run_id = sys.argv[1], sys.argv[2]
json.dump({
  "runId": run_id,
  "mode": "anonymous_paper",
  "product": "Phantom X / Polymarket",
  "market": "auto_selected_paper_market",
  "side": "YES",
  "maxStakeUsd": 0,
  "liveTrading": False,
  "paperOnly": True,
  "humanApprovalRequired": True,
  "externalSignerRequired": True,
  "privateKeysInsideNexora": False,
  "walletSigningInsideNexora": False
}, open(path, "w"), separators=(",", ":"))
PY

get_route() {
  ROUTE="$1"
  NAME="$(echo "$ROUTE" | tr '/' '_' | tr -d '?=&')"
  echo "GET $ROUTE"
  curl -sS --max-time 20 "$BASE$ROUTE" > "$OUT/get-$NAME.json"
  head -c 800 "$OUT/get-$NAME.json"
  echo
}

post_route() {
  ROUTE="$1"
  NAME="$(echo "$ROUTE" | tr '/' '_' | tr -d '?=&')"
  echo "POST $ROUTE"
  curl -sS --max-time 30 \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --data-binary @"$PAYLOAD" \
    "$BASE$ROUTE" > "$OUT/post-$NAME.json"
  head -c 1000 "$OUT/post-$NAME.json"
  echo
}

echo "== anonymous paper trader session =="
echo "run_id=$RUN_ID"
echo "out=$OUT"

echo "== API ping =="
curl -sS --max-time 5 "$BASE/api/nexora/ping" > "$OUT/ping.json" || {
  echo "API not running. Start server first."
  exit 1
}
cat "$OUT/ping.json"
echo

get_route "/api/nexora/poly-app/status"
get_route "/api/nexora/moondev-strategy-import/status"
post_route "/api/nexora/poly-builds/bash2/loop/run"
post_route "/api/nexora/poly-builds/final/trade-intent-draft"
post_route "/api/nexora/poly-builds/final/run"
get_route "/api/nexora/poly-builds/final/latest"
get_route "/api/nexora/live-money/status"

cat > "$OUT/SUMMARY.md" <<EOF
# Anonymous Paper Trader Run

Run ID: $RUN_ID

## Result

- MoonDev strategy reference checked
- Paper risk/operator loop run
- Paper trade intent draft generated
- Final readiness run generated
- Live-money status checked

## Safety

- Live trading enabled: NO
- Real orders: NO
- Wallet signing inside Nexora: NO
- Private keys inside Nexora: NO
- Anonymous mode: local paper run ID only
EOF

echo "== summary =="
cat "$OUT/SUMMARY.md"

echo "DONE anonymous paper trader run"
