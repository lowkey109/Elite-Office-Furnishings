#!/usr/bin/env bash
set +e

BASE="http://localhost:5000"

echo "=================================================="
echo "LIVE AI / NEXORA STATUS CHECK"
echo "=================================================="

echo ""
echo "1) Server health"
curl -s "$BASE/api/health" || true
echo ""

echo ""
echo "2) Nexora background status"
curl -s "$BASE/api/nexora/background-status" || true
echo ""

echo ""
echo "3) Nexora loop status"
curl -s "$BASE/api/nexora/loop/status" || true
echo ""

echo ""
echo "4) Nexora history"
curl -s "$BASE/api/nexora/history" || true
echo ""

echo ""
echo "5) Nexora top opportunities"
curl -s "$BASE/api/nexora/opportunities/top" || true
echo ""

echo ""
echo "6) Nexora pending outreach"
curl -s "$BASE/api/nexora/outreach/pending" || true
echo ""

echo ""
echo "7) Nexora priority actions"
curl -s "$BASE/api/nexora/priority-actions" || true
echo ""

echo ""
echo "8) Office Move Radar stats"
curl -s "$BASE/api/admin/office-move-radar/stats" || true
echo ""

echo ""
echo "9) Deal Hunter stats"
curl -s "$BASE/api/admin/deal-hunter/stats" || true
echo ""

echo ""
echo "10) Intelligence health"
curl -s "$BASE/api/admin/intelligence/health" || true
echo ""

echo ""
echo "11) Approval queue stats"
curl -s "$BASE/api/approvals/stats" || true
echo ""

echo ""
echo "12) Trading monitor"
curl -s "$BASE/api/admin/trading/monitor" || true
echo ""

echo ""
echo "=================================================="
echo "DONE"
echo "=================================================="
