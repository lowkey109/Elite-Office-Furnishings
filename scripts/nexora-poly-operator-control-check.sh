#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5000}"

get_route() {
  echo ""
  echo "== $1 =="
  curl -sS -L --max-time 20 "$BASE_URL$1"
  echo
}

get_route "/api/nexora/poly-app/status"
get_route "/api/nexora/poly-builds/bash2/status"
get_route "/api/nexora/poly-builds/bash2/risk/latest"
get_route "/api/nexora/poly-builds/bash2/loop/latest"
get_route "/api/nexora/poly-builds/final/status"
get_route "/api/nexora/poly-builds/final/latest"
get_route "/api/nexora/trading-readiness/status"
get_route "/api/nexora/live-money/status"
