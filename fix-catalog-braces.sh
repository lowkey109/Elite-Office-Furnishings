#!/bin/bash

FILE="server/routes.ts"

echo "🧹 Fixing broken catalog function structure..."

awk '
BEGIN { inBroken=0 }

/function loadProductCatalog/ { inBroken=1 }

/function buildCatalogueForAI/ { inBroken=1 }

/interface ChatMessage/ { inBroken=0 }

{
  if (inBroken == 1) {
    # drop corrupted mid-function fragments
    if ($0 ~ /^[[:space:]]*\}/ && length($0) < 3) next
    if ($0 ~ /^[[:space:]]*return lines\.join/) inBroken=0
  }
  print
}
' "$FILE" > tmp.ts

mv tmp.ts "$FILE"

echo "✅ Structure repair applied"
