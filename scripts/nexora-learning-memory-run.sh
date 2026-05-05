#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
PAYLOAD="/tmp/nexora-learning-memory-payload.json"

post_payload() {
  local route="$1"
  python3 - "$PAYLOAD" "$route" <<'PY'
import json, sys
path, route = sys.argv[1], sys.argv[2]
domain = "polymarket" if "polymarket" in route or "learning-memory" in route else "general"
payload = {
  "domain": domain,
  "product": "Phantom X / Polymarket",
  "action": "paper_replay_strategy_tournament_and_risk_gate",
  "result": "success",
  "pnl": 3,
  "margin": 0,
  "riskTriggered": False,
  "humanApproved": True,
  "liveTrading": False
}
json.dump(payload, open(path, "w"), separators=(",", ":"))
PY
  curl -sS -H "Content-Type: application/json" --data-binary @"$PAYLOAD" "$BASE_URL$route"
  echo
}

echo "== status =="
curl -sS "$BASE_URL/api/nexora/learning-memory/status"
echo

echo "== cycle =="
post_payload "/api/nexora/learning-memory/cycle"

echo "== playbook =="
post_payload "/api/nexora/learning-memory/playbook"

echo "== recommend next =="
post_payload "/api/nexora/learning-memory/recommend-next"

echo "== final status =="
curl -sS "$BASE_URL/api/nexora/learning-memory/status"
echo
