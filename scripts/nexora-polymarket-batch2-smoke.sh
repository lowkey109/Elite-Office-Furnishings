#!/usr/bin/env bash
set -euo pipefail
BASE="${NEXORA_BASE_URL:-http://127.0.0.1:5000}"

for r in \
  /api/nexora/polymarket/batch2/status \
  /api/nexora/polymarket/batch2/moondev/strategy-records \
  /api/nexora/polymarket/batch2/binance/ws/status \
  /api/nexora/polymarket/batch2/gamma/markets?limit=3
do
  body="$(curl -sS -L --max-time 12 "$BASE$r" || true)"
  if printf '%s' "$body" | grep -qi '<html\|<!doctype'; then
    echo "FAIL html fallback: $r"
    exit 1
  fi
  echo "checked $r"
done
