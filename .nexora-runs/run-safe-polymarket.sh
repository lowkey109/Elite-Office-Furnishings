#!/usr/bin/env bash
set -euo pipefail

cd ~/workspace

echo "== Nexora safe Polymarket runner =="

echo ""
echo "== 1. TypeScript =="
npm run check

echo ""
echo "== 2. Restart API =="
pkill -f "tsx server/index.ts" || true
nohup npm run dev > /tmp/nexora-dev.log 2>&1 &
sleep 8

echo ""
echo "== 3. Smoke =="
if [ -x scripts/nexora-polymarket-all-smoke.sh ]; then
  OUT_DIR=/tmp/nexora-smoke scripts/nexora-polymarket-all-smoke.sh
fi

echo ""
echo "== 4. Bash1 =="
if [ -x scripts/nexora-poly-7builds-bash1.sh ]; then
  OUT_DIR=/tmp/nexora-bash1 scripts/nexora-poly-7builds-bash1.sh | head -c 2500
  echo
fi

echo ""
echo "== 5. Bash2 =="
if [ -x scripts/nexora-poly-7builds-bash2-loop.sh ]; then
  OUT_DIR=/tmp/nexora-bash2 scripts/nexora-poly-7builds-bash2-loop.sh | head -c 2500
  echo
fi

echo ""
echo "== 6. Final readiness =="
if [ -x scripts/nexora-poly-final-run.sh ]; then
  OUT_DIR=/tmp/nexora-poly-final scripts/nexora-poly-final-run.sh | head -c 3000
  echo
fi

echo ""
echo "== 7. Final TypeScript =="
npm run check

echo ""
echo "DONE safe Polymarket runner"
