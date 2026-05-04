#!/usr/bin/env bash
set -u

BASE="${BASE_URL:-http://127.0.0.1:5000}"
PAYLOAD="/tmp/nexora-poly-mode-payload.json"

echo "== mode status =="
curl -sS "$BASE/api/nexora/poly-mode/status"
echo

echo "== switch to paper =="
python3 - "$PAYLOAD" <<'PY'
import json, sys
json.dump({"mode":"paper"}, open(sys.argv[1],"w"), separators=(",",":"))
PY
curl -sS -H "Content-Type: application/json" --data-binary @"$PAYLOAD" "$BASE/api/nexora/poly-mode/set"
echo

echo "== switch to real prep with approval/signature readiness =="
python3 - "$PAYLOAD" <<'PY'
import json, sys
json.dump({
  "mode":"real",
  "humanApproved": True,
  "externalSignerReady": True
}, open(sys.argv[1],"w"), separators=(",",":"))
PY
curl -sS -H "Content-Type: application/json" --data-binary @"$PAYLOAD" "$BASE/api/nexora/poly-mode/set"
echo

echo "== button model =="
curl -sS "$BASE/api/nexora/poly-mode/button"
echo
