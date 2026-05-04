#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
OUT_DIR="${OUT_DIR:-reports/nexora-audit/polymarket-evidence}"
mkdir -p "$OUT_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
REPORT="$OUT_DIR/evidence-$TS.log"
SUMMARY="$OUT_DIR/evidence-summary-$TS.json"

echo "Nexora Polymarket paper evidence"
echo "base=$BASE_URL"
echo "report=$REPORT"

post_json() {
  local route="$1"
  local body="${2:-{}}"
  local tmp
  tmp="$(mktemp)"
  local code
  code="$(curl -sS -L --max-time 30 -H 'Content-Type: application/json' -X POST -d "$body" -o "$tmp" -w "%{http_code}" "${BASE_URL}${route}" || echo "000")"
  local html=0
  if grep -qiE '<!doctype html|<html|vite|root' "$tmp"; then html=1; fi
  echo "POST $route code=$code html=$html body=$(head -c 500 "$tmp" | tr '\n' ' ')" | tee -a "$REPORT"
  rm -f "$tmp"
  [ "$code" = "200" ] && [ "$html" = "0" ]
}

get_route() {
  local route="$1"
  local tmp
  tmp="$(mktemp)"
  local code
  code="$(curl -sS -L --max-time 20 -o "$tmp" -w "%{http_code}" "${BASE_URL}${route}" || echo "000")"
  local html=0
  if grep -qiE '<!doctype html|<html|vite|root' "$tmp"; then html=1; fi
  echo "GET $route code=$code html=$html body=$(head -c 500 "$tmp" | tr '\n' ' ')" | tee -a "$REPORT"
  rm -f "$tmp"
  [ "$code" = "200" ] && [ "$html" = "0" ]
}

fail=0

get_route "/api/nexora/poly-app/status" || fail=1
post_json "/api/nexora/poly-app/cycle" '{"mode":"paper","liveTrading":false,"externalSigner":false}' || true
post_json "/api/nexora/poly-app/batch" '{"mode":"paper","liveTrading":false,"externalSigner":false,"batch":"evidence"}' || true
get_route "/api/nexora/poly-app/readiness" || true
get_route "/api/nexora/trading-readiness/status" || true
get_route "/api/nexora/trading-execution/status" || true
get_route "/api/nexora/poly-final-five/status" || true

python3 - "$SUMMARY" "$fail" "$REPORT" <<'PY'
import json, sys, datetime
summary, fail, report = sys.argv[1:]
with open(summary, "w", encoding="utf-8") as f:
    json.dump({
        "ts": datetime.datetime.utcnow().isoformat() + "Z",
        "suite": "nexora-polymarket-paper-evidence",
        "mode": "paper",
        "liveTrading": False,
        "externalSigner": False,
        "fail": fail != "0",
        "report": report,
        "safety": {
            "deploy": False,
            "postgresMigration": False,
            "privateKeys": False,
            "walletSigning": False,
            "liveOrders": False
        }
    }, f, indent=2)
PY

echo "summary=$SUMMARY" | tee -a "$REPORT"
exit "$fail"
