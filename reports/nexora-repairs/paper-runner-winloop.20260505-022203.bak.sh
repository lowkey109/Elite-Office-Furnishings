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

post() {
  route="$1"
  body="$2"
  out="$ROOT/response-$(echo "$route" | tr '/' '_').json"
  curl -sS --max-time 30 -H "Content-Type: application/json" --data-binary @"$body" "$BASE$route" > "$out"
  python3 - "$out" "$route" <<'PY' >> "$LOG" 2>&1
import json,sys
p,route=sys.argv[1:]
try:
 d=json.load(open(p))
 print(f"{route}: ok={d.get('ok')} service={d.get('service')} id={d.get('id')}")
except Exception:
 print(f"{route}: non-json")
PY
}

loop=0
while true; do
  loop=$((loop+1))
  payload="$ROOT/payload-loop-$loop.json"
  python3 .nexora-runs/nexora-make-paper-payload.py "$loop" "$payload"

  python3 - "$STATUS" "$loop" <<'PY'
import json,sys,datetime
path,loop=sys.argv[1:]
json.dump({"ok":True,"service":"nexora_paper_practice_loop","state":"running","loop":int(loop),"updatedAt":datetime.datetime.utcnow().isoformat()+"Z","safety":{"paperOnly":True,"liveTradingEnabled":False,"privateKeysInsideNexora":False,"walletSigningInsideNexora":False}},open(path,"w"),indent=2)
PY

  echo "[$(date -Iseconds)] loop=$loop payload=$(cat "$payload")" >> "$LOG"

  post "/api/nexora/poly-builds/bash2/loop/run" "$payload"
  post "/api/nexora/poly-builds/final/trade-intent-draft" "$payload"
  post "/api/nexora/poly-builds/final/run" "$payload"
  post "/api/nexora/learning-memory/cycle" "$payload"

  python3 - "$STATUS" "$loop" <<'PY'
import json,sys,datetime
path,loop=sys.argv[1:]
json.dump({"ok":True,"service":"nexora_paper_practice_loop","state":"sleeping","loop":int(loop),"note":"last loop complete","updatedAt":datetime.datetime.utcnow().isoformat()+"Z","safety":{"paperOnly":True,"liveTradingEnabled":False,"privateKeysInsideNexora":False,"walletSigningInsideNexora":False}},open(path,"w"),indent=2)
PY

  echo "[$(date -Iseconds)] loop=$loop complete" >> "$LOG"

  if [ "$MAX_LOOPS" != "0" ] && [ "$loop" -ge "$MAX_LOOPS" ]; then
    rm -f "$PIDFILE"
    exit 0
  fi

  sleep "$INTERVAL"
done
