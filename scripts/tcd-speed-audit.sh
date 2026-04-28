#!/usr/bin/env bash
set -euo pipefail

PORT_TO_USE="${PORT_TO_USE:-5055}"
ADMIN_TOKEN="${ADMIN_TOKEN:-stage-test-token}"

BASE="http://localhost:${PORT_TO_USE}"

routes=(
  "/api/health"
  "/api/admin/customer-competitor-quotes"
  "/api/admin/procurement/quote-requests"
  "/api/admin/procurement/whatsapp-outbox"
  "/api/admin/procurement/send-audit"
  "/api/admin/sales-psychology/playbook"
  "/api/admin/autonomy-readiness"
  "/api/admin/outreach/stats"
  "/api/admin/outreach/safety-stats"
  "/api/admin/nexora/monitor"
  "/api/admin/trading/monitor"
  "/api/admin/office-move-radar"
  "/api/admin/deal-hunter/stats"
  "/api/admin/quotes"
  "/api/admin/follow-up-sequences"
  "/api/admin/revenue/stats"
)

mkdir -p /tmp/tcd-speed-bodies

echo "| Route | HTTP | Seconds | Bytes | Result |"
echo "|---|---:|---:|---:|---|"

fail=0

for route in "${routes[@]}"; do
  safe="$(echo "$route" | sed 's#/#_#g' | sed 's#__#_#g')"
  body="/tmp/tcd-speed-bodies/${safe}.json"

  if [ "$route" = "/api/health" ]; then
    result="$(curl -sS --connect-timeout 2 --max-time 6 -o "$body" -w "%{http_code} %{time_total} %{size_download}" "$BASE$route" || true)"
  else
    result="$(curl -sS --connect-timeout 2 --max-time 6 -H "x-tcd-admin-token: ${ADMIN_TOKEN}" -o "$body" -w "%{http_code} %{time_total} %{size_download}" "$BASE$route" || true)"
  fi

  code="$(echo "$result" | awk '{print $1}')"
  secs="$(echo "$result" | awk '{print $2}')"
  bytes="$(echo "$result" | awk '{print $3}')"

  status="PASS"
  if [ "$code" != "200" ]; then
    status="FAIL"
    fail=1
  fi

  awk_result="$(awk -v s="$secs" 'BEGIN { if (s+0 > 2.0) print "SLOW"; else print "OK" }')"
  if [ "$awk_result" = "SLOW" ]; then
    status="SLOW"
    fail=1
  fi

  echo "| $route | $code | $secs | $bytes | $status |"
done

exit "$fail"
