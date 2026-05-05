#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
OUT_DIR="${OUT_DIR:-reports/nexora-audit/polymarket-smoke}"
mkdir -p "$OUT_DIR"

REPORT="$OUT_DIR/smoke-$(date +%Y%m%d-%H%M%S).log"
JSONL="$OUT_DIR/smoke-results.jsonl"

routes=(
  "/api/nexora/ping"
  "/api/nexora/market-data/status"
  "/api/nexora/backtesting/status"
  "/api/nexora/trading-execution/status"
  "/api/nexora/trading-readiness/status"
  "/api/nexora/live-money/status"
  "/api/nexora/live-execution-design/status"
  "/api/nexora/polymarket-final/status"
  "/api/nexora/poly-five/status"
  "/api/nexora/poly-next-five/status"
  "/api/nexora/poly-final-five/status"
  "/api/nexora/poly-app/status"
  "/api/nexora/moondev-strategy-import/status"
  "/api/nexora/moondev-phase1/status"
)

echo "Nexora Polymarket smoke"
echo "base=$BASE_URL"
echo "report=$REPORT"

fail=0

for route in "${routes[@]}"; do
  url="${BASE_URL}${route}"
  tmp="$(mktemp)"
  code="$(curl -sS -L --max-time 12 -o "$tmp" -w "%{http_code}" "$url" || echo "000")"
  ctype="$(file -b --mime-type "$tmp" 2>/dev/null || true)"
  first="$(head -c 120 "$tmp" | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g')"

  html=0
  if grep -qiE '<!doctype html|<html|vite|root' "$tmp"; then
    html=1
  fi

  status="PASS"
  if [ "$code" != "200" ] || [ "$html" = "1" ]; then
    status="FAIL"
    fail=1
  fi

  line="$status code=$code html=$html ctype=$ctype route=$route first=${first}"
  echo "$line" | tee -a "$REPORT"

  python3 - "$JSONL" "$status" "$code" "$html" "$route" "$first" <<'PY'
import json, sys, datetime
path, status, code, html, route, first = sys.argv[1:]
with open(path, "a", encoding="utf-8") as f:
    f.write(json.dumps({
        "ts": datetime.datetime.utcnow().isoformat() + "Z",
        "status": status,
        "code": code,
        "html": html == "1",
        "route": route,
        "first": first[:250],
    }) + "\n")
PY

  rm -f "$tmp"
done

echo "smoke_fail=$fail" | tee -a "$REPORT"
exit "$fail"
