#!/usr/bin/env bash
set -euo pipefail

cd ~/workspace

echo "== Polymarket core runner =="

npm run check

pkill -f "tsx server/index.ts" || true
nohup npm run dev > /tmp/nexora-dev.log 2>&1 &
sleep 8

echo "== ping =="
curl -sS http://127.0.0.1:5000/api/nexora/ping | head -c 300
echo

echo "== final latest =="
curl -sS http://127.0.0.1:5000/api/nexora/poly-builds/final/latest | head -c 1000
echo

echo "== smoke =="
if [ -x scripts/nexora-polymarket-all-smoke.sh ]; then
  OUT_DIR=/tmp/nexora-smoke scripts/nexora-polymarket-all-smoke.sh
else
  echo "missing smoke script"
fi

npm run check

echo "DONE core runner"
