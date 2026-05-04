#!/usr/bin/env bash
set -euo pipefail
BASE="${NEXORA_BASE_URL:-http://127.0.0.1:5000}"
for r in \
  /api/nexora/polymarket/status \
  /api/nexora/polymarket/batch1/status \
  /api/nexora/polymarket/batch1/routes/audit \
  /api/nexora/polymarket/batch1/evidence \
  /api/nexora/polymarket/batch1/moondev/adapter-plan
do
  body="$(curl -sS -L --max-time 8 "$BASE$r" || true)"
  if printf '%s' "$body" | grep -qi '<html\|<!doctype'; then
    echo "FAIL html fallback: $r"
    exit 1
  fi
  echo "checked $r"
done
