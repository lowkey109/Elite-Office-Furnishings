#!/bin/bash

FILE="server/routes.ts"

echo "🧹 Fixing corrupted catalog builder block..."

awk '
BEGIN { inFunc=0 }

/function loadProductCatalog/ { inFunc=1 }

/function buildCatalogueForAI/ { inFunc=1 }

# detect broken mid-block garbage patterns
/in interface ChatMessage/ { inFunc=0 }

/^[[:space:]]*return \{ products: \[\] \};/ { print; next }

/^[[:space:]]*\}/ {
  if (inFunc == 1) {
    # skip excessive stray braces caused by corruption
    next
  }
}

{
  print
}
' "$FILE" > tmp.ts

mv tmp.ts "$FILE"

echo "✅ Catalog block cleaned"
