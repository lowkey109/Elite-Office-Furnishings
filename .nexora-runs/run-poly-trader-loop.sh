#!/usr/bin/env bash
set -u

cd ~/workspace

OUT="${OUT_DIR:-/tmp/nexora-poly-trader-loop}"
mkdir -p "$OUT"

echo "== Nexora Poly Trader Loop =="
echo "out=$OUT"

echo ""
echo "== API check =="
curl -sS --max-time 5 http://127.0.0.1:5000/api/nexora/ping > "$OUT/ping.json"
if [ "$?" != "0" ]; then
  echo "API not running. Start npm run dev in another shell or run no-kill starter."
  exit 1
fi
cat "$OUT/ping.json"
echo

post_json() {
  ROUTE="$1"
  BODY="$2"
  FILE="$OUT/payload.json"
  RESP="$OUT/response-$(echo "$ROUTE" | tr '/' '_' | tr -d '?=&').json"

  python3 - "$FILE" "$BODY" <<'PY'
import json, sys
path, raw = sys.argv[1], sys.argv[2]
with open(path, "w", encoding="utf-8") as f:
    json.dump(json.loads(raw), f, separators=(",", ":"))
PY

  curl -sS --max-time 30 \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --data-binary @"$FILE" \
    "http://127.0.0.1:5000$ROUTE" > "$RESP"

  echo ""
  echo "POST $ROUTE"
  python3 - "$RESP" <<'PY'
import json, sys
try:
    data=json.load(open(sys.argv[1]))
    print(json.dumps(data, indent=2)[:1800])
except Exception:
    print(open(sys.argv[1]).read()[:1800])
PY
}

get_json() {
  ROUTE="$1"
  RESP="$OUT/get-$(echo "$ROUTE" | tr '/' '_' | tr -d '?=&').json"

  curl -sS --max-time 30 "http://127.0.0.1:5000$ROUTE" > "$RESP"

  echo ""
  echo "GET $ROUTE"
  python3 - "$RESP" <<'PY'
import json, sys
try:
    data=json.load(open(sys.argv[1]))
    print(json.dumps(data, indent=2)[:1800])
except Exception:
    print(open(sys.argv[1]).read()[:1800])
PY
}

PAYLOAD='{"mode":"paper_learning_to_supervised_real_money","market":"example_polymarket_market","side":"YES","maxStakeUsd":0,"liveTrading":false,"humanApprovalRequired":true,"externalSignerRequired":true}'

get_json "/api/nexora/poly-app/status"
get_json "/api/nexora/poly-builds/bash1/status"
get_json "/api/nexora/poly-builds/bash2/status"
post_json "/api/nexora/poly-builds/bash2/loop/run" "$PAYLOAD"
post_json "/api/nexora/poly-builds/final/run" "$PAYLOAD"
get_json "/api/nexora/poly-builds/final/latest"
get_json "/api/nexora/trading-readiness/status"
get_json "/api/nexora/live-money/status"

echo ""
echo "== Trader loop complete =="
echo "Live trading enabled: NO"
echo "Private keys inside Nexora: NO"
echo "Wallet signing inside Nexora: NO"
