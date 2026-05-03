import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

const SUPPLIER_LOG = nexoraLocalPath("suppliers", "supplier-log.jsonl");

function supplierFile(id: string) {
  return nexoraLocalPath("suppliers", `${id}.json`);
}

export function upsertNexoraLocalSupplier(input: any = {}) {
  const supplierId = String(input.supplierId || nexoraLocalId("supplier"));
  const existing = readNexoraJson(supplierFile(supplierId), {});

  const supplier = {
    ...existing,
    ok: true,
    nexoraBrain: true,
    supplierId,
    name: String(input.name || existing.name || "Unnamed supplier"),
    category: String(input.category || existing.category || "office furniture"),
    contact: input.contact || existing.contact || {},
    leadTimeDays: Number(input.leadTimeDays ?? existing.leadTimeDays ?? 14),
    rating: Number(input.rating ?? existing.rating ?? 5),
    status: input.status || existing.status || "active",
    noPurchaseOrderWithoutApproval: true,
    updatedAt: now(),
    createdAt: existing.createdAt || now(),
  };

  writeNexoraJson(supplierFile(supplierId), supplier);
  appendNexoraJsonl(SUPPLIER_LOG, {
    event: "supplier.upserted",
    supplier,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    supplier,
  };
}

export function listNexoraLocalSuppliers(input: any = {}) {
  const category = input.category ? String(input.category) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(SUPPLIER_LOG)
    .filter((row: any) => row.event === "supplier.upserted")
    .map((row: any) => row.supplier)
    .filter((supplier: any) => !category || supplier.category === category)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraLocalSupplierStatus() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_supplier_catalogue",
    totalSuppliers: listNexoraLocalSuppliers({ limit: 1000 }).count,
  };
}
