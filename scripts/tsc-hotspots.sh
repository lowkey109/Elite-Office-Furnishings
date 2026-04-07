#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${1:-.tsc-errors.log}"

if [[ ! -f "$LOG_FILE" ]]; then
  echo "Missing $LOG_FILE"
  echo "Run: npm run tsc -- --noEmit > .tsc-errors.log 2>&1"
  exit 1
fi

echo "===== Top files ====="
python3 - "$LOG_FILE" <<'PY'
import re, sys, collections
p = re.compile(r'^(.+?\.(?:ts|tsx))\(\d+,\d+\): error ')
c = collections.Counter()
with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        m = p.match(line)
        if m:
            c[m.group(1)] += 1
for file, count in c.most_common(60):
    print(f"{count:>4}  {file}")
PY

echo
echo "===== Top recurring messages ====="
python3 - "$LOG_FILE" <<'PY'
import re, sys, collections
c = collections.Counter()
with open(sys.argv[1], 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        s = line.rstrip()
        if not s:
            continue
        if "error TS" in s:
            c[s.split(": error ", 1)[-1]] += 1
        elif s.startswith("  ") or s.startswith("    "):
            c[s.strip()] += 1
for msg, count in c.most_common(80):
    print(f"{count:>4}  {msg}")
PY

echo
echo "===== JSON column writes using JSON.stringify ====="
grep -RInE 'payloadJson:\s*JSON\.stringify|detailsJson:\s*JSON\.stringify|metadataJson:\s*JSON\.stringify|rawPayloadJson:\s*JSON\.stringify|signalsJson:\s*JSON\.stringify|config:\s*JSON\.stringify' server shared client 2>/dev/null || true

echo
echo "===== Likely renamed fields ====="
grep -RInE '\bofficeSize\b|\bbudget\b|\bestimatedValueRange\b|\bofficeSqm\b' server shared client 2>/dev/null || true

echo
echo "===== Missing symbols / imports ====="
grep -nE "Cannot find module|Cannot find name|has no exported member" "$LOG_FILE" || true
