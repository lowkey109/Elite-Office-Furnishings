#!/bin/bash

FILE="server/routes.ts"

echo "🧹 Fixing broken function brace..."

cp $FILE $FILE.backup

# 1. Insert missing brace AFTER loadProductCatalog()
awk '
/function loadProductCatalog/ {infunc=1}
infunc && /return \{ products: \[\] \};/ {
  print $0
  print "}"
  infunc=0
  next
}
{ print }
' $FILE > tmp.ts && mv tmp.ts $FILE

echo "✅ Brace fix applied"
