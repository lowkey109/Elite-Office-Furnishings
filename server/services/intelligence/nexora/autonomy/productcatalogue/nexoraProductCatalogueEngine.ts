import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

function safeSku(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const JOURNAL = nexoraLocalPath("product-catalogue", "journal", "product-catalogue-journal.jsonl");
const PRODUCT_LOG = nexoraLocalPath("product-catalogue", "products", "product-log.jsonl");
const SUPPLIER_LOG = nexoraLocalPath("product-catalogue", "suppliers", "supplier-cost-log.jsonl");
const BUNDLE_LOG = nexoraLocalPath("product-catalogue", "bundles", "bundle-log.jsonl");
const IMPORT_LOG = nexoraLocalPath("product-catalogue", "imports", "import-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

export interface NexoraProductRecord {
  ok: true;
  nexoraBrain: true;
  sku: string;
  productId: string;
  name: string;
  category: string;
  subcategory: string | null;
  description: string;
  defaultSupplierId: string | null;
  unitCost: number;
  unitSell: number;
  marginAmount: number;
  marginPercent: number;
  gstRate: number;
  leadTimeDays: number | null;
  warranty: string | null;
  tags: string[];
  status: "active" | "draft" | "retired";
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export function upsertNexoraProduct(input: any = {}) {
  const sku = safeSku(String(input.sku || input.code || input.name || nexoraLocalId("SKU")));
  const existing = readNexoraJson(
    nexoraLocalPath("product-catalogue", "products", `${sku}.json`),
    null,
  ) as NexoraProductRecord | null;

  const unitCost = toNumber(input.unitCost ?? input.cost ?? existing?.unitCost, 0);
  const unitSell = toNumber(input.unitSell ?? input.sell ?? input.price ?? existing?.unitSell, unitCost > 0 ? unitCost / 0.62 : 0);
  const marginAmount = roundMoney(unitSell - unitCost);
  const marginPercent = unitSell > 0 ? roundMoney((marginAmount / unitSell) * 100) : 0;

  const product: NexoraProductRecord = {
    ok: true,
    nexoraBrain: true,
    sku,
    productId: existing?.productId || String(input.productId || nexoraLocalId("product")),
    name: String(input.name || existing?.name || sku),
    category: String(input.category || existing?.category || "office furniture"),
    subcategory: input.subcategory ?? existing?.subcategory ?? null,
    description: String(input.description || existing?.description || ""),
    defaultSupplierId: input.defaultSupplierId ?? existing?.defaultSupplierId ?? null,
    unitCost,
    unitSell,
    marginAmount,
    marginPercent,
    gstRate: toNumber(input.gstRate ?? existing?.gstRate, 0.1),
    leadTimeDays: input.leadTimeDays !== undefined ? Number(input.leadTimeDays) : existing?.leadTimeDays ?? null,
    warranty: input.warranty ?? existing?.warranty ?? null,
    tags: Array.isArray(input.tags) ? input.tags : existing?.tags || [],
    status: input.status || existing?.status || "active",
    createdAt: existing?.createdAt || now(),
    updatedAt: now(),
    metadata: input.metadata || existing?.metadata || {},
  };

  writeNexoraJson(nexoraLocalPath("product-catalogue", "products", `${sku}.json`), product);
  appendNexoraJsonl(PRODUCT_LOG, { event: "product.upserted", product, createdAt: now() });

  recordNexoraMetric({
    name: "product_catalogue_upsert",
    value: 1,
    unit: "product",
    dimensions: { category: product.category, status: product.status },
  });

  journal("product.upserted", product);

  return { ok: true, nexoraBrain: true, product };
}

export function getNexoraProduct(input: any = {}) {
  const sku = safeSku(String(input.sku || ""));
  const product = readNexoraJson(
    nexoraLocalPath("product-catalogue", "products", `${sku}.json`),
    null,
  ) as NexoraProductRecord | null;

  return { ok: Boolean(product), nexoraBrain: true, sku, product };
}

export function listNexoraProducts(input: any = {}) {
  const category = input.category ? String(input.category).toLowerCase() : "";
  const status = input.status ? String(input.status) : "";
  const q = input.q ? String(input.q).toLowerCase() : "";
  const limit = Number(input.limit || 200);

  const rows = readNexoraJsonl(PRODUCT_LOG)
    .filter((row: any) => row.event === "product.upserted")
    .map((row: any) => row.product)
    .filter((product: any) => !category || String(product.category || "").toLowerCase() === category)
    .filter((product: any) => !status || product.status === status)
    .filter((product: any) => !q || JSON.stringify(product).toLowerCase().includes(q))
    .slice(-limit)
    .reverse();

  const bySku = new Map<string, any>();
  for (const row of rows) {
    if (!bySku.has(row.sku)) bySku.set(row.sku, row);
  }

  return { ok: true, nexoraBrain: true, count: bySku.size, rows: [...bySku.values()] };
}

export function upsertNexoraSupplierCost(input: any = {}) {
  const supplierId = String(input.supplierId || input.supplier || "preferred_supplier_pool").replace(/[^a-zA-Z0-9._-]+/g, "_");
  const sku = safeSku(String(input.sku || input.productSku || "UNKNOWN-SKU"));
  const costId = String(input.costId || `${supplierId}_${sku}`);

  const record = {
    ok: true,
    nexoraBrain: true,
    costId,
    supplierId,
    supplierName: String(input.supplierName || input.name || supplierId),
    sku,
    unitCost: toNumber(input.unitCost ?? input.cost, 0),
    minOrderQty: toNumber(input.minOrderQty, 1),
    leadTimeDays: input.leadTimeDays !== undefined ? Number(input.leadTimeDays) : null,
    deliveryCost: input.deliveryCost !== undefined ? Number(input.deliveryCost) : null,
    warranty: input.warranty || null,
    stockStatus: String(input.stockStatus || "unknown"),
    lastConfirmedAt: input.lastConfirmedAt || now(),
    notes: input.notes || "",
    createdAt: now(),
    updatedAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("product-catalogue", "suppliers", `${costId}.json`), record);
  appendNexoraJsonl(SUPPLIER_LOG, { event: "supplier_cost.upserted", record, createdAt: now() });

  journal("supplier_cost.upserted", record);

  return { ok: true, nexoraBrain: true, record };
}

export function listNexoraSupplierCosts(input: any = {}) {
  const sku = input.sku ? safeSku(String(input.sku)) : "";
  const supplierId = input.supplierId ? String(input.supplierId) : "";
  const limit = Number(input.limit || 200);

  const rows = readNexoraJsonl(SUPPLIER_LOG)
    .filter((row: any) => row.event === "supplier_cost.upserted")
    .map((row: any) => row.record)
    .filter((record: any) => !sku || record.sku === sku)
    .filter((record: any) => !supplierId || record.supplierId === supplierId)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function createNexoraProductBundle(input: any = {}) {
  const bundleId = String(input.bundleId || nexoraLocalId("bundle"));
  const items = Array.isArray(input.items) ? input.items : [];

  const resolved = items.map((item: any) => {
    const sku = safeSku(String(item.sku || ""));
    const product = getNexoraProduct({ sku }).product;
    const quantity = toNumber(item.quantity, 1);
    const unitCost = toNumber(item.unitCost ?? product?.unitCost, 0);
    const unitSell = toNumber(item.unitSell ?? product?.unitSell, unitCost > 0 ? unitCost / 0.62 : 0);

    return {
      sku,
      name: product?.name || item.name || sku,
      quantity,
      unitCost,
      unitSell,
      lineCost: roundMoney(unitCost * quantity),
      lineSell: roundMoney(unitSell * quantity),
      marginAmount: roundMoney((unitSell - unitCost) * quantity),
      marginPercent: unitSell > 0 ? roundMoney(((unitSell - unitCost) / unitSell) * 100) : 0,
      found: Boolean(product),
    };
  });

  const subtotal = roundMoney(resolved.reduce((sum: number, row: any) => sum + row.lineSell, 0));
  const costTotal = roundMoney(resolved.reduce((sum: number, row: any) => sum + row.lineCost, 0));
  const marginAmount = roundMoney(subtotal - costTotal);
  const marginPercent = subtotal > 0 ? roundMoney((marginAmount / subtotal) * 100) : 0;
  const gst = roundMoney(subtotal * 0.1);
  const total = roundMoney(subtotal + gst);

  const bundle = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_product_bundle",
    bundleId,
    name: String(input.name || "Office furniture bundle"),
    createdAt: now(),
    items: resolved,
    totals: {
      subtotal,
      costTotal,
      marginAmount,
      marginPercent,
      gst,
      total,
    },
    approvalRequired: total >= 25000 || marginPercent < 22,
    assumptions: [
      "Draft bundle only.",
      "Supplier costs must be confirmed before binding quote.",
      "Delivery, install, access, and after-hours costs may change final pricing.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("product-catalogue", "bundles", `${bundleId}.json`), bundle);
  appendNexoraJsonl(BUNDLE_LOG, { event: "bundle.created", bundle, createdAt: now() });

  journal("bundle.created", bundle);

  return { ok: true, nexoraBrain: true, bundle };
}

export function seedNexoraDefaultProductCatalogue() {
  const products = [
    {
      sku: "DESK-WORK-1600",
      name: "1600mm Workstation Desk",
      category: "desks",
      subcategory: "workstation",
      unitCost: 320,
      unitSell: 520,
      leadTimeDays: 14,
      warranty: "5 years",
      tags: ["workstation", "desk", "office"],
    },
    {
      sku: "CHAIR-ERG-TASK",
      name: "Ergonomic Task Chair",
      category: "chairs",
      subcategory: "task",
      unitCost: 210,
      unitSell: 380,
      leadTimeDays: 10,
      warranty: "5 years",
      tags: ["chair", "ergonomic", "task"],
    },
    {
      sku: "BOARD-TABLE-2400",
      name: "2400mm Boardroom Table",
      category: "boardroom",
      subcategory: "table",
      unitCost: 850,
      unitSell: 1450,
      leadTimeDays: 21,
      warranty: "5 years",
      tags: ["boardroom", "table"],
    },
    {
      sku: "STORAGE-CRED-1800",
      name: "1800mm Credenza Storage",
      category: "storage",
      subcategory: "credenza",
      unitCost: 420,
      unitSell: 760,
      leadTimeDays: 14,
      warranty: "5 years",
      tags: ["storage", "credenza"],
    },
    {
      sku: "INSTALL-BASIC",
      name: "Basic Delivery and Installation Allowance",
      category: "services",
      subcategory: "install",
      unitCost: 180,
      unitSell: 320,
      leadTimeDays: 0,
      warranty: "service",
      tags: ["install", "delivery", "service"],
    },
  ];

  const created = products.map((product) => upsertNexoraProduct(product));

  const supplierCosts = products.map((product) => upsertNexoraSupplierCost({
    supplierId: "preferred_supplier_pool",
    supplierName: "Preferred Supplier Pool",
    sku: product.sku,
    unitCost: product.unitCost,
    leadTimeDays: product.leadTimeDays,
    warranty: product.warranty,
    stockStatus: "unknown",
  }));

  const workstationBundle = createNexoraProductBundle({
    name: "20 Person Workstation Starter Pack",
    items: [
      { sku: "DESK-WORK-1600", quantity: 20 },
      { sku: "CHAIR-ERG-TASK", quantity: 20 },
      { sku: "INSTALL-BASIC", quantity: 20 },
    ],
  });

  const boardroomBundle = createNexoraProductBundle({
    name: "Boardroom Starter Pack",
    items: [
      { sku: "BOARD-TABLE-2400", quantity: 1 },
      { sku: "CHAIR-ERG-TASK", quantity: 8 },
      { sku: "INSTALL-BASIC", quantity: 1 },
    ],
  });

  const seed = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_product_catalogue_seed",
    createdAt: now(),
    products: created.length,
    supplierCosts: supplierCosts.length,
    bundles: [workstationBundle.bundle, boardroomBundle.bundle],
  };

  appendNexoraJsonl(IMPORT_LOG, { event: "catalogue.seeded", seed, createdAt: now() });
  journal("catalogue.seeded", seed);

  return seed;
}

export function importNexoraProductsFromJson(input: any = {}) {
  const rows = Array.isArray(input.products) ? input.products : [];
  const imported = rows.map((row: any) => upsertNexoraProduct(row));

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_product_json_import",
    imported: imported.length,
    createdAt: now(),
  };

  appendNexoraJsonl(IMPORT_LOG, { event: "products.imported", result, createdAt: now() });
  journal("products.imported", result);

  return result;
}

export function exportNexoraProductCatalogue() {
  const products = listNexoraProducts({ limit: 5000 }).rows;
  const supplierCosts = listNexoraSupplierCosts({ limit: 5000 }).rows;
  const bundles = readNexoraJsonl(BUNDLE_LOG)
    .filter((row: any) => row.event === "bundle.created")
    .map((row: any) => row.bundle);

  const pack = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_product_catalogue_export",
    exportedAt: now(),
    products,
    supplierCosts,
    bundles,
    counts: {
      products: products.length,
      supplierCosts: supplierCosts.length,
      bundles: bundles.length,
    },
  };

  const file = nexoraLocalPath("product-catalogue", "exports", `product-catalogue-export-${Date.now()}.json`);
  writeNexoraJson(file, pack);

  return { ok: true, nexoraBrain: true, file, pack };
}

export function getNexoraProductCatalogueStatus() {
  const products = listNexoraProducts({ limit: 5000 });
  const supplierCosts = listNexoraSupplierCosts({ limit: 5000 });
  const bundles = readNexoraJsonl(BUNDLE_LOG).filter((row: any) => row.event === "bundle.created");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_product_catalogue",
    generatedAt: now(),
    counts: {
      products: products.count,
      supplierCosts: supplierCosts.count,
      bundles: bundles.length,
    },
    safety: {
      noSupplierPurchaseOrder: true,
      noBindingCustomerQuote: true,
      localOnly: true,
    },
  };
}
