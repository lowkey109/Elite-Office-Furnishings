#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"
OUT_DIR="${OUT_DIR:-reports/nexora-audit/poly-7builds-bash1}"
mkdir -p "$OUT_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
REPORT="$OUT_DIR/bash1-$TS.log"
SUMMARY="$OUT_DIR/bash1-summary-$TS.json"

get_route() {
  local route="$1"
  local tmp code html
  tmp="$(mktemp)"
  code="$(curl -sS -L --max-time 20 -o "$tmp" -w "%{http_code}" "${BASE_URL}${route}" || echo "000")"
  html=0
  if grep -qiE '<!doctype html|<html|vite|root' "$tmp"; then html=1; fi
  echo "GET $route code=$code html=$html body=$(head -c 650 "$tmp" | tr '\n' ' ')" | tee -a "$REPORT"
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
  code="$(curl -sS -L --max-time 45 \
    -H 'Content-Type: application/json' \
    -X POST \
    --data-binary @"$body_file" \
    -o "$tmp" \
    -w "%{http_code}" \
    "${BASE_URL}${route}" || echo "000")"
  html=0
  if grep -qiE '<!doctype html|<html|vite|root' "$tmp"; then html=1; fi
  echo "POST $route code=$code html=$html body=$(head -c 900 "$tmp" | tr '\n' ' ')" | tee -a "$REPORT"
  rm -f "$tmp" "$body_file"
  [ "$code" = "200" ] && [ "$html" = "0" ]
}

echo "Nexora Poly 7 Builds - Bash 1"
echo "base=$BASE_URL"
echo "report=$REPORT"

fail=0

get_route "/api/nexora/poly-app/status" || fail=1
get_route "/api/nexora/poly-builds/bash1/status" || fail=1
post_json "/api/nexora/poly-builds/bash1/full-suite" '{"mode":"paper","source":"bash1","liveTrading":false,"deploy":false,"postgresReplay":false}' || fail=1
post_json "/api/nexora/poly-builds/bash1/replay/run" '{"mode":"paper","source":"bash1","seedPrice":65000,"liveTrading":false}' || fail=1
get_route "/api/nexora/poly-builds/bash1/replay/latest" || fail=1
post_json "/api/nexora/poly-builds/bash1/tournament/run" '{"mode":"paper","source":"bash1","seedPrice":65000,"liveTrading":false}' || fail=1
get_route "/api/nexora/poly-builds/bash1/tournament/latest" || fail=1
post_json "/api/nexora/poly-builds/bash1/run" '{"mode":"paper","source":"bash1-final-run","seedPrice":65000,"liveTrading":false,"deploy":false,"postgresReplay":false}' || fail=1
get_route "/api/nexora/poly-builds/bash1/status" || fail=1

python3 - "$SUMMARY" "$fail" "$REPORT" <<'PY'
import json, sys, datetime
summary, fail, report = sys.argv[1:]
with open(summary, "w", encoding="utf-8") as f:
    json.dump({
        "ts": datetime.datetime.utcnow().isoformat() + "Z",
        "suite": "nexora-poly-7builds-bash1",
        "buildsCompleted": [
            "1_full_suite_evidence",
            "2_paper_market_replay_pnl_timeline",
            "3_strategy_tournament_rankings"
        ],
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
