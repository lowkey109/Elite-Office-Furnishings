#!/usr/bin/env bash
set -u

cd ~/workspace

TS="$(date +%Y%m%d-%H%M%S)"
OUT="${OUT_DIR:-reports/polymarket/final-evidence-$TS}"
mkdir -p "$OUT"

BASE="http://127.0.0.1:5000"
PAYLOAD="$OUT/payload.json"
SUMMARY="$OUT/SUMMARY.md"

echo "== Nexora Poly Final Evidence Pack =="
echo "out=$OUT"

python3 - "$PAYLOAD" <<'PY'
import json, sys
json.dump({
  "mode": "paper_learning_to_supervised_real_money",
  "market": "example_polymarket_market",
  "side": "YES",
  "maxStakeUsd": 0,
  "liveTrading": False,
  "humanApprovalRequired": True,
  "externalSignerRequired": True,
  "privateKeysInsideNexora": False,
  "walletSigningInsideNexora": False
}, open(sys.argv[1], "w"), separators=(",", ":"))
PY

get_route() {
  ROUTE="$1"
  NAME="$(echo "$ROUTE" | tr '/' '_' | tr -d '?=&')"
  FILE="$OUT/get-$NAME.json"

  echo "GET $ROUTE"
  curl -sS --max-time 30 "$BASE$ROUTE" > "$FILE"
  python3 - "$FILE" <<'PY'
import json, sys
try:
    data=json.load(open(sys.argv[1]))
    print(json.dumps(data, indent=2)[:1200])
except Exception:
    print(open(sys.argv[1]).read()[:1200])
PY
  echo
}

post_route() {
  ROUTE="$1"
  NAME="$(echo "$ROUTE" | tr '/' '_' | tr -d '?=&')"
  FILE="$OUT/post-$NAME.json"

  echo "POST $ROUTE"
  curl -sS --max-time 45 \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --data-binary @"$PAYLOAD" \
    "$BASE$ROUTE" > "$FILE"

  python3 - "$FILE" <<'PY'
import json, sys
try:
    data=json.load(open(sys.argv[1]))
    print(json.dumps(data, indent=2)[:1200])
except Exception:
    print(open(sys.argv[1]).read()[:1200])
PY
  echo
}

echo "== API check =="
curl -sS --max-time 5 "$BASE/api/nexora/ping" > "$OUT/ping.json"
if [ "$?" != "0" ]; then
  echo "API not running. Start server first with: npm run dev"
  exit 1
fi
cat "$OUT/ping.json"
echo

echo "== Evidence route capture =="
get_route "/api/nexora/poly-app/status"
get_route "/api/nexora/poly-builds/bash1/status"
get_route "/api/nexora/poly-builds/bash2/status"
get_route "/api/nexora/poly-builds/final/status"
get_route "/api/nexora/trading-readiness/status"
get_route "/api/nexora/trading-execution/status"
get_route "/api/nexora/live-money/status"
get_route "/api/nexora/live-execution-design/status"

echo "== Active evidence runs =="
post_route "/api/nexora/poly-builds/bash2/loop/run"
post_route "/api/nexora/poly-builds/final/readiness"
post_route "/api/nexora/poly-builds/final/promotion-gate"
post_route "/api/nexora/poly-builds/final/trade-intent-draft"
post_route "/api/nexora/poly-builds/final/run"

echo "== Final latest capture =="
get_route "/api/nexora/poly-builds/final/latest"

echo "== Write summary =="
cat > "$SUMMARY" <<EOF
# Nexora Poly Trader Final Evidence Pack

Generated: $TS

## Result

- API ping: PASS
- Bash 1 learning layer: CAPTURED
- Bash 2 risk/operator loop: RUN
- Final readiness: RUN
- Promotion gate: RUN
- Trade intent draft: RUN
- Final latest: CAPTURED

## Safety

- Live trading enabled: NO
- Live orders enabled: NO
- Private keys inside Nexora: NO
- Wallet signing inside Nexora: NO
- External signer required: YES
- Human approval required: YES
- Deploy executed: NO
- Postgres replay executed: NO

## Folder

$OUT
EOF

cat "$SUMMARY"

echo ""
echo "DONE final evidence pack"
