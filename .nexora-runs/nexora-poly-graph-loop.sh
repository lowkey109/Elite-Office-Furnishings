#!/usr/bin/env bash
set -u
cd ~/workspace
BASE="${BASE_URL:-http://127.0.0.1:5000}"
PAYLOAD="/tmp/nexora-poly-graph-payload.json"
python3 - "$PAYLOAD" <<'PY'
import json, sys
json.dump({"mode":"paper_visualization","symbol":"BTC / Polymarket","basePrice":77500,"liveTrading":False},open(sys.argv[1],"w"),separators=(",",":"))
PY
for i in 1 2 3 4 5
do
  curl -sS -H "Content-Type: application/json" --data-binary @"$PAYLOAD" "$BASE/api/nexora/poly-charts/tick" >/tmp/nexora-poly-graph-tick.json
  python3 - <<'PY'
import json
d=json.load(open("/tmp/nexora-poly-graph-tick.json"))
print("tick",d.get("tick"),"signal",d.get("paperSignal"),"price",d.get("terminal",{}).get("price"))
PY
  sleep 1
done
