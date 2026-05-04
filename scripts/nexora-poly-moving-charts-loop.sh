#!/usr/bin/env bash
set -u

BASE="${BASE_URL:-http://127.0.0.1:5000}"
OUT="${OUT_DIR:-/tmp/nexora-poly-moving-charts}"
mkdir -p "$OUT"

PAYLOAD="$OUT/payload.json"

python3 - "$PAYLOAD" <<'PY'
import json
json.dump({
  "symbol": "BTC / Polymarket",
  "basePrice": 77499,
  "mode": "paper_visualization",
  "liveTrading": False
}, open("/tmp/nexora-poly-moving-payload.json","w"), separators=(",",":"))
PY

PAYLOAD="/tmp/nexora-poly-moving-payload.json"

echo "== charts status =="
curl -sS "$BASE/api/nexora/poly-charts/status"
echo

for i in 1 2 3 4 5
do
  echo "== tick $i =="
  curl -sS \
    -H "Content-Type: application/json" \
    --data-binary @"$PAYLOAD" \
    "$BASE/api/nexora/poly-charts/tick" > "$OUT/tick-$i.json"
  python3 - "$OUT/tick-$i.json" <<'PY'
import json, sys
data=json.load(open(sys.argv[1]))
print({
  "tick": data.get("tick"),
  "paperSignal": data.get("paperSignal"),
  "price": data.get("terminal", {}).get("price"),
  "confidence": data.get("terminal", {}).get("confidence"),
})
PY
done

echo "== latest =="
curl -sS "$BASE/api/nexora/poly-charts/latest" > "$OUT/latest.json"
python3 - "$OUT/latest.json" <<'PY'
import json, sys
data=json.load(open(sys.argv[1]))
print("terminal:", data.get("terminal", {}).get("title"), data.get("terminal", {}).get("signal"))
print("forceGraph:", data.get("forceGraph", {}).get("title"), "nodes", len(data.get("forceGraph", {}).get("nodes", [])))
PY

echo "DONE moving charts loop"
