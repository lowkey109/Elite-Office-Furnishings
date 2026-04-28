#!/usr/bin/env bash
set -euo pipefail

echo "| Asset | Size KB | Gzip KB approx | Status |"
echo "|---|---:|---:|---|"

fail=0

find dist/public/assets -type f \( -name "*.js" -o -name "*.css" \) | sort | while read -r file; do
  size_kb="$(du -k "$file" | awk '{print $1}')"
  gzip_kb="$(gzip -c "$file" | wc -c | awk '{printf "%.0f", $1/1024}')"

  status="PASS"
  if [[ "$file" == *.js ]] && [ "$size_kb" -gt 1800 ]; then
    status="TOO_BIG"
    fail=1
  fi

  echo "| $file | $size_kb | $gzip_kb | $status |"
done
