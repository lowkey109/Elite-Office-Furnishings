#!/usr/bin/env bash
set -u

cd ~/workspace

BASE="${BASE_URL:-http://127.0.0.1:5000}"
ROOT="data/nexora/local/paper-practice"
mkdir -p "$ROOT"

LOG="$ROOT/paper-practice.log"
STATUS="$ROOT/status.json"
PIDFILE="$ROOT/paper-practice.pid"

INTERVAL="${NEXORA_PAPER_INTERVAL:-60}"
MAX_LOOPS="${NEXORA_PAPER_MAX_LOOPS:-0}"

echo $$ > "$PIDFILE"

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG"
}

write_status() {
  python3 - "$STATUS" "$1" "$2" "$3" <<'PY'
import json, sys, datetime
path, state, loop, note = sys.argv[1:]
with open(path, "w", encoding="utf-8") as f:
    json.dump({
        "ok": True,
        "service": "nexora_paper_practice_loop",
        "state": state,
        "loop": int(loop),
        "note": note,
        "updatedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "safety": {
            "paperOnly": True,
            "liveTradingEnabled": False,
            "privateKeysInsideNexora": False,
            "walletSigningInsideNexora": False
        }
    }, f, indent=2)
PY
}

post_json() {
  local route="$1"
  local payload="$2"
  local name
  name="$(echo "$route" | tr '/' '_' | tr -d '?=&')"
  local body="$ROOT/payload-$name.json"
  local out="$ROOT/response-$name.json"

  printf '%s' "$payload" > "$body"

  curl -sS --max-time 30 \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --data-binary @"$body" \
    "$BASE$route" > "$out" 2>>"$LOG"

  python3 - "$out" "$route" <<'PY' >> "$LOG" 2>&1
import json, sys
path, route = sys.argv[1:]
try:
    data = json.load(open(path, encoding="utf-8"))
    print(f"{route}: ok={data.get('ok')} service={data.get('service')} id={data.get('id')}")
except Exception:
    txt = open(path, encoding="utf-8", errors="ignore").read()[:200]
    print(f"{route}: non-json {txt!r}")
PY
}

get_json() {
  local route="$1"
  local name
  name="$(echo "$route" | tr '/' '_' | tr -d '?=&')"
  local out="$ROOT/get-$name.json"

  curl -sS --max-time 20 "$BASE$route" > "$out" 2>>"$LOG"

  python3 - "$out" "$route" <<'PY' >> "$LOG" 2>&1
import json, sys
path, route = sys.argv[1:]
try:
    data = json.load(open(path, encoding="utf-8"))
    print(f"{route}: ok={data.get('ok')} service={data.get('service')}")
except Exception:
    txt = open(path, encoding="utf-8", errors="ignore").read()[:200]
    print(f"{route}: non-json {txt!r}")
PY
}

log "Nexora paper practice loop starting"
log "interval=${INTERVAL}s max_loops=${MAX_LOOPS}"

LOOP=0

while true; do
  LOOP=$((LOOP + 1))
  write_status "running" "$LOOP" "paper practice loop active"

  TS="$(date -Iseconds)"
  PAYLOAD="$(python3 - <<PY
import json
print(json.dumps({
  "mode": "paper_learning",
  "source": "nexora_paper_practice_loop",
  "loop": $LOOP,
  "generatedAt": "$TS",
  "market": "auto_selected_paper_market",
  "symbol": "BTC / Polymarket",
  "side": "YES",
  "maxStakeUsd": 0,
  "liveTrading": False,
  "paperOnly": True,
  "humanApprovalRequired": True,
  "externalSignerRequired": True,
  "privateKeysInsideNexora": False,
  "walletSigningInsideNexora": False
}, separators=(",", ":")))
PY
)"

  log "loop=$LOOP start"

  get_json "/api/nexora/ping"
  get_json "/api/nexora/moondev-strategy-import/status"
  get_json "/api/nexora/poly-app/status"

  post_json "/api/nexora/poly-builds/bash2/loop/run" "$PAYLOAD"
  post_json "/api/nexora/poly-builds/final/trade-intent-draft" "$PAYLOAD"
  post_json "/api/nexora/poly-builds/final/run" "$PAYLOAD"

  if curl -sS --max-time 10 "$BASE/api/nexora/learning-memory/status" >/dev/null 2>&1; then
    post_json "/api/nexora/learning-memory/cycle" "$PAYLOAD"
  fi

  if curl -sS --max-time 10 "$BASE/api/nexora/poly-charts/status" >/dev/null 2>&1; then
    post_json "/api/nexora/poly-charts/tick" "$PAYLOAD"
  fi

  get_json "/api/nexora/poly-builds/final/latest"
  get_json "/api/nexora/live-money/status"

  log "loop=$LOOP complete"
  write_status "sleeping" "$LOOP" "last loop complete"

  if [ "$MAX_LOOPS" != "0" ] && [ "$LOOP" -ge "$MAX_LOOPS" ]; then
    log "max loops reached, stopping"
    write_status "stopped" "$LOOP" "max loops reached"
    rm -f "$PIDFILE"
    exit 0
  fi

  sleep "$INTERVAL"
done
