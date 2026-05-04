#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
OUT_DIR="${OUT_DIR:-reports/nexora-audit/polymarket-paper-full-suite}"
mkdir -p "$OUT_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
REPORT="$OUT_DIR/full-suite-$TS.log"
SUMMARY="$OUT_DIR/full-suite-summary-$TS.json"

get_route() {
  local route="$1"
  local tmp code html
  tmp="$(mktemp)"
  code="$(curl -sS -L --max-time 20 -o "$tmp" -w "%{http_code}" "${BASE_URL}${route}" || echo "000")"
  html=0
  if grep -qiE '<!doctype html|<html|vite|root' "$tmp"; then html=1; fi
  echo "GET $route code=$code html=$html body=$(head -c 500 "$tmp" | tr '\n' ' ')" | tee -a "$REPORT"
  rm -f "$tmp"
  [ "$code" = "200" ] && [ "$html" = "0" ]
}

post_json() {
  local route="$1"
  local body="$2"
  local tmp body_file code html
  tmp="$(mktemp)"
  body_file="$(mktemp)"
  printf '%s' "$body" > "$body_file"
  code="$(curl -sS -L --max-time 40 \
    -H 'Content-Type: application/json' \
    -X POST \
    --data-binary @"$body_file" \
    -o "$tmp" \
    -w "%{http_code}" \
    "${BASE_URL}${route}" || echo "000")"
  html=0
  if grep -qiE '<!doctype html|<html|vite|root' "$tmp"; then html=1; fi
  echo "POST $route code=$code html=$html body=$(head -c 700 "$tmp" | tr '\n' ' ')" | tee -a "$REPORT"
  rm -f "$tmp" "$body_file"
  [ "$code" = "200" ] && [ "$html" = "0" ]
}

echo "Nexora Polymarket Paper Full Suite"
echo "base=$BASE_URL"
echo "report=$REPORT"

fail=0

get_route "/api/nexora/poly-app/status" || fail=1
get_route "/api/nexora/poly-app/operator-summary" || fail=1
post_json "/api/nexora/poly-app/paper-seed" '{"source":"full-suite-script","mode":"paper","liveTrading":false}' || fail=1
post_json "/api/nexora/poly-app/evidence-pack" '{"source":"full-suite-script","mode":"paper","liveTrading":false,"externalSigner":false}' || fail=1
post_json "/api/nexora/poly-app/readiness-report" '{"source":"full-suite-script","mode":"paper","liveTrading":false}' || fail=1
post_json "/api/nexora/poly-app/full-suite" '{"source":"full-suite-script","mode":"paper","liveTrading":false,"deploy":false,"postgresReplay":false}' || fail=1
get_route "/api/nexora/poly-app/full-suite/status" || fail=1

python3 - "$SUMMARY" "$fail" "$REPORT" <<'PY'
import json, sys, datetime
summary, fail, report = sys.argv[1:]
with open(summary, "w", encoding="utf-8") as f:
    json.dump({
        "ts": datetime.datetime.utcnow().isoformat() + "Z",
        "suite": "nexora-polymarket-paper-full-suite",
        "mode": "paper",
        "fail": fail != "0",
        "report": report,
        "safety": {
            "deploy": False,
            "postgresReplay": False,
            "privateKeys": False,
            "walletSigning": False,
            "liveTrading": False,
            "liveOrders": False
        }
    }, f, indent=2)
PY

echo "summary=$SUMMARY" | tee -a "$REPORT"
exit "$fail"
