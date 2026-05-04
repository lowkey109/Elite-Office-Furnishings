import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import {
  exportNexoraProductCatalogue,
  getNexoraProduct,
  listNexoraProducts,
  listNexoraSupplierCosts,
  upsertNexoraProduct,
  upsertNexoraSupplierCost,
} from "../productcatalogue/nexoraProductCatalogueEngine";
import {
  createNexoraCustomerQuoteDraft,
  createNexoraQuotePack,
  listNexoraQuotePackApprovals,
  listNexoraQuotePacks,
} from "../quotepack/nexoraQuotePackGenerator";

function now() {
  return new Date().toISOString();
}

function safe(value: string) {
  return String(value || "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function parseCsvLine(line: string) {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current.trim());
  return out;
}

function parseCsv(csv: string) {
  const lines = csv.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((x) => x.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function toNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const IMPORT_LOG = nexoraLocalPath("product-import-export", "imports", "import-log.jsonl");
const EXPORT_LOG = nexoraLocalPath("product-import-export", "exports", "export-log.jsonl");
const VALIDATION_LOG = nexoraLocalPath("product-import-export", "validation", "validation-log.jsonl");
const DUPLICATE_LOG = nexoraLocalPath("product-import-export", "duplicates", "duplicate-log.jsonl");
const JOURNAL = nexoraLocalPath("product-import-export", "journal", "product-import-export-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

export function importNexoraProductsFromCsv(input: any = {}) {
  const importId = String(input.importId || nexoraLocalId("product_csv_import"));
  const csv = String(input.csv || "");

  const rows = parseCsv(csv);
  const imported = [];
  const failed = [];

  for (const row of rows) {
    try {
      const product = upsertNexoraProduct({
        sku: row.sku || row.SKU || row.code,
        name: row.name || row.Name || row.productName,
        category: row.category || row.Category || "office furniture",
        subcategory: row.subcategory || row.Subcategory || null,
        description: row.description || row.Description || "",
        unitCost: toNumber(row.unitCost || row.cost || row.Cost, 0),
        unitSell: toNumber(row.unitSell || row.sell || row.price || row.Price, 0),
        leadTimeDays: row.leadTimeDays || row.leadTime || null,
        warranty: row.warranty || null,
        tags: row.tags ? String(row.tags).split("|").map((x) => x.trim()).filter(Boolean) : [],
      });
      imported.push(product.product);
    } catch (error) {
      failed.push({
        row,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const result = {
    ok: failed.length === 0,
    nexoraBrain: true,
    service: "nexora_product_csv_import",
    importId,
    createdAt: now(),
    rows: rows.length,
    imported: imported.length,
    failed: failed.length,
    failedRows: failed,
  };

  writeNexoraJson(nexoraLocalPath("product-import-export", "imports", `${importId}.json`), result);
  appendNexoraJsonl(IMPORT_LOG, { event: "products.csv_import", result, createdAt: now() });
  journal("products.csv_import", result);

  return { ok: true, nexoraBrain: true, result };
}

export function importNexoraSupplierCostsFromJson(input: any = {}) {
  const importId = String(input.importId || nexoraLocalId("supplier_cost_import"));
  const rows = Array.isArray(input.rows) ? input.rows : Array.isArray(input.supplierCosts) ? input.supplierCosts : [];

  const imported = [];
  const failed = [];

  for (const row of rows) {
    try {
      const cost = upsertNexoraSupplierCost(row);
      imported.push(cost.record);
    } catch (error) {
      failed.push({
        row,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const result = {
    ok: failed.length === 0,
    nexoraBrain: true,
    service: "nexora_supplier_cost_json_import",
    importId,
    createdAt: now(),
    rows: rows.length,
    imported: imported.length,
    failed: failed.length,
    failedRows: failed,
  };

  writeNexoraJson(nexoraLocalPath("product-import-export", "imports", `${importId}.json`), result);
  appendNexoraJsonl(IMPORT_LOG, { event: "supplier_costs.json_import", result, createdAt: now() });
  journal("supplier_costs.json_import", result);

  return { ok: true, nexoraBrain: true, result };
}

export function validateNexoraProductCatalogue(input: any = {}) {
  const products = listNexoraProducts({ limit: 10000 }).rows;
  const supplierCosts = listNexoraSupplierCosts({ limit: 10000 }).rows;

  const issues = [];

  for (const product of products) {
    if (!product.sku) issues.push({ type: "missing_sku", product });
    if (!product.name) issues.push({ type: "missing_name", sku: product.sku });
    if (!product.category) issues.push({ type: "missing_category", sku: product.sku });
    if (Number(product.unitCost || 0) <= 0) issues.push({ type: "missing_or_zero_cost", sku: product.sku });
    if (Number(product.unitSell || 0) <= 0) issues.push({ type: "missing_or_zero_sell", sku: product.sku });
    if (Number(product.marginPercent || 0) < 22) issues.push({ type: "low_margin", sku: product.sku, marginPercent: product.marginPercent });
  }

  const supplierSkus = new Set(supplierCosts.map((x: any) => x.sku));
  for (const product of products) {
    if (!supplierSkus.has(product.sku)) {
      issues.push({ type: "no_supplier_cost", sku: product.sku });
    }
  }

  const result = {
    ok: issues.length === 0,
    nexoraBrain: true,
    service: "nexora_product_catalogue_validation",
    validationId: nexoraLocalId("product_validation"),
    createdAt: now(),
    productCount: products.length,
    supplierCostCount: supplierCosts.length,
    issueCount: issues.length,
    issues,
  };

  writeNexoraJson(nexoraLocalPath("product-import-export", "validation", `${result.validationId}.json`), result);
  appendNexoraJsonl(VALIDATION_LOG, { event: "catalogue.validation", result, createdAt: now() });
  journal("catalogue.validation", result);

  return { ok: true, nexoraBrain: true, result };
}

export function detectNexoraDuplicateSkus() {
  const rows = readNexoraJsonl(nexoraLocalPath("product-catalogue", "products", "product-log.jsonl"))
    .filter((row: any) => row.event === "product.upserted")
    .map((row: any) => row.product);

  const grouped: Record<string, any[]> = {};
  for (const product of rows) {
    grouped[product.sku] = grouped[product.sku] || [];
    grouped[product.sku].push(product);
  }

  const duplicates = Object.entries(grouped)
    .filter(([, items]) => items.length > 1)
    .map(([sku, items]) => ({
      sku,
      count: items.length,
      latest: items[items.length - 1],
      history: items,
    }));

  const result = {
    ok: duplicates.length === 0,
    nexoraBrain: true,
    service: "nexora_duplicate_sku_report",
    reportId: nexoraLocalId("duplicate_sku_report"),
    createdAt: now(),
    duplicates: duplicates.length,
    rows: duplicates,
  };

  writeNexoraJson(nexoraLocalPath("product-import-export", "duplicates", `${result.reportId}.json`), result);
  appendNexoraJsonl(DUPLICATE_LOG, { event: "sku.duplicates", result, createdAt: now() });
  journal("sku.duplicates", result);

  return { ok: true, nexoraBrain: true, result };
}

export function exportNexoraQuotePackMarkdown(input: any = {}) {
  const exportId = String(input.exportId || nexoraLocalId("quote_export"));
  const packs = listNexoraQuotePacks({ limit: 1000 }).rows;
  const selected = input.quotePackId
    ? packs.find((pack: any) => pack.quotePackId === input.quotePackId)
    : packs[0];

  if (!selected) {
    return { ok: false, nexoraBrain: true, error: "No quote pack found." };
  }

  const lines = [
    `# The Corporate Desk — Draft Quote Pack`,
    ``,
    `Quote Pack: ${selected.quotePackId}`,
    `Customer: ${selected.customer?.customerName || ""}`,
    `Company: ${selected.customer?.companyName || ""}`,
    `Created: ${selected.createdAt}`,
    ``,
    `## Items`,
    ``,
    `| SKU | Name | Qty | Unit Sell | Line Sell |`,
    `|---|---|---:|---:|---:|`,
    ...(selected.bundle?.items || []).map((item: any) =>
      `| ${item.sku} | ${item.name} | ${item.quantity} | $${Number(item.unitSell || 0).toFixed(2)} | $${Number(item.lineSell || 0).toFixed(2)} |`
    ),
    ``,
    `## Totals`,
    ``,
    `Subtotal: $${Number(selected.bundle?.totals?.subtotal || 0).toFixed(2)}`,
    `GST: $${Number(selected.bundle?.totals?.gst || 0).toFixed(2)}`,
    `Total: $${Number(selected.bundle?.totals?.total || 0).toFixed(2)}`,
    ``,
    `## Notes`,
    ``,
    `Draft only. No binding customer commitment until human commit.`,
  ];

  const markdown = lines.join("\n");
  const file = nexoraLocalPath("product-import-export", "exports", `${exportId}.md`);
  fs.writeFileSync(file, markdown, "utf8");

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_quote_pack_markdown_export",
    exportId,
    file,
    quotePackId: selected.quotePackId,
    createdAt: now(),
  };

  appendNexoraJsonl(EXPORT_LOG, { event: "quote_pack.markdown_export", result, createdAt: now() });
  journal("quote_pack.markdown_export", result);

  return { ok: true, nexoraBrain: true, result };
}

export function exportNexoraInternalMarginCsv(input: any = {}) {
  const exportId = String(input.exportId || nexoraLocalId("margin_export"));
  const packs = listNexoraQuotePacks({ limit: 1000 }).rows;

  const header = [
    "quotePackId",
    "companyName",
    "subtotal",
    "costTotal",
    "marginAmount",
    "marginPercent",
    "approvalRequired",
  ];

  const rows = packs.map((pack: any) => [
    pack.quotePackId,
    pack.customer?.companyName || "",
    pack.bundle?.totals?.subtotal || 0,
    pack.bundle?.totals?.costTotal || 0,
    pack.bundle?.totals?.marginAmount || 0,
    pack.bundle?.totals?.marginPercent || 0,
    pack.safety?.approvalRequired || false,
  ]);

  const csv = [header, ...rows].map((row) => row.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
  const file = nexoraLocalPath("product-import-export", "exports", `${exportId}.csv`);
  fs.writeFileSync(file, csv, "utf8");

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_internal_margin_csv_export",
    exportId,
    file,
    rows: rows.length,
    createdAt: now(),
  };

  appendNexoraJsonl(EXPORT_LOG, { event: "margin.csv_export", result, createdAt: now() });
  journal("margin.csv_export", result);

  return { ok: true, nexoraBrain: true, result };
}

export function exportNexoraSupplierRfqMarkdown(input: any = {}) {
  const exportId = String(input.exportId || nexoraLocalId("supplier_rfq_export"));
  const items = Array.isArray(input.items) ? input.items : [];
  const supplierName = String(input.supplierName || "Preferred Supplier Pool");

  const markdown = [
    `# Non-binding Supplier RFQ`,
    ``,
    `Supplier: ${supplierName}`,
    `Created: ${new Date().toISOString()}`,
    ``,
    `Please confirm unit cost, stock, lead time, delivery cost, warranty, and equivalent alternatives.`,
    ``,
    `| SKU | Name | Qty |`,
    `|---|---|---:|`,
    ...items.map((item: any) => `| ${item.sku || ""} | ${item.name || ""} | ${item.quantity || 1} |`),
    ``,
    `This is an information request only and is not a purchase order or supplier commitment.`,
  ].join("\n");

  const file = nexoraLocalPath("product-import-export", "exports", `${exportId}.supplier-rfq.md`);
  fs.writeFileSync(file, markdown, "utf8");

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_supplier_rfq_markdown_export",
    exportId,
    file,
    supplierName,
    itemCount: items.length,
    createdAt: now(),
    safety: {
      nonBinding: true,
      noPurchaseOrder: true,
    },
  };

  appendNexoraJsonl(EXPORT_LOG, { event: "supplier_rfq.markdown_export", result, createdAt: now() });
  journal("supplier_rfq.markdown_export", result);

  return { ok: true, nexoraBrain: true, result };
}

export function getNexoraProductImportExportStatus() {
  const imports = readNexoraJsonl(IMPORT_LOG);
  const exports = readNexoraJsonl(EXPORT_LOG);
  const validations = readNexoraJsonl(VALIDATION_LOG);
  const duplicates = readNexoraJsonl(DUPLICATE_LOG);
  const catalogue = exportNexoraProductCatalogue().pack;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_product_import_export",
    generatedAt: new Date().toISOString(),
    counts: {
      imports: imports.length,
      exports: exports.length,
      validations: validations.length,
      duplicateReports: duplicates.length,
      products: catalogue.counts.products,
      supplierCosts: catalogue.counts.supplierCosts,
      bundles: catalogue.counts.bundles,
    },
    safety: {
      localOnly: true,
      noPostgres: true,
      noBindingQuotes: true,
    },
  };
}
