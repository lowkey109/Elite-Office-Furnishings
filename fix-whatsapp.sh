#!/bin/bash

FILE="server/routes.ts"

echo "🧹 Removing duplicate WhatsApp function declarations..."

# keep only FIRST occurrence blocks (safe dedupe by function name)
awk '
BEGIN { seen1=0; seen2=0 }

/function isWhatsAppConfigured/ {
  if (seen1++) next
}

/function sendWhatsAppTextMessage/ {
  if (seen2++) next
}

{ print }
' "$FILE" > tmp.ts && mv tmp.ts "$FILE"

echo "✅ WhatsApp duplicates removed"
