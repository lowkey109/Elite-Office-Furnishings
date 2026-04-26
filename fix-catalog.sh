#!/bin/bash

FILE="server/routes.ts"

echo "🧹 Rebuilding product catalog functions cleanly..."

cp $FILE $FILE.backup

awk '
/function loadProductCatalog/ {skip=1}
/function buildCatalogueForAI/ {skip=1}

skip && /}/ {
  skip=0
  next
}

skip { next }

{ print }
' $FILE > tmp.ts && mv tmp.ts $FILE

cat >> $FILE << 'CODE'

// ===============================
// CLEAN CATALOG IMPLEMENTATION
// ===============================

const CATALOG_PATH = path.join(process.cwd(), "server/data/productCatalog.json");

function loadProductCatalog() {
  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  } catch (e) {
    console.error("[Catalog] Failed to load productCatalog.json:", e);
    return { products: [] };
  }
}

function buildCatalogueForAI(): string {
  const catalog = loadProductCatalog();

  const lines: string[] = [
    "SKU | Category | Product Name | Dimensions | Supplier",
  ];

  for (const p of catalog.products || []) {
    lines.push(
      `${p.sku} | ${p.category} | ${p.product_name} | ${p.dimensions || "Custom"} | ${p.supplier || "Unknown"}`
    );
  }

  return lines.join("\n");
}
CODE

echo "✅ Catalog system rebuilt cleanly"
