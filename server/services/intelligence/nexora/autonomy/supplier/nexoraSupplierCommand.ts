import {
  createNexoraDelegation,
  createNexoraDivisionObjective,
  createNexoraDurableTask,
  createNexoraMemoryGraphEdge,
  ensureNexoraDurableKernel,
  getNexoraDurableCommandSnapshot,
  sendNexoraWorkerMessage,
  upsertNexoraWorker,
  writeNexoraOperatingReport,
} from "../persistence/nexoraDurableKernel";
import { governAndQueueNexoraAction } from "../governor/nexoraAutonomyGovernor";
import { createNexoraAuditVaultEntry } from "../strategy/nexoraStrategyCompiler";

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function num(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function registerNexoraSupplierWorkers() {
  await ensureNexoraDurableKernel();

  const workers = [
    {
      worker: "nexora_supplier_command",
      area: "procurement",
      capabilities: ["supplier_matrix", "rfq_generation", "supplier_risk", "no_commitment_negotiation"],
    },
    {
      worker: "nexora_supplier_risk_engine",
      area: "procurement",
      capabilities: ["lead_time_risk", "warranty_risk", "stock_risk", "price_volatility_risk"],
    },
    {
      worker: "nexora_rfq_writer",
      area: "procurement",
      capabilities: ["rfq_draft", "supplier_email_draft", "non_binding_request"],
    },
  ];

  for (const worker of workers) {
    await upsertNexoraWorker({
      worker: worker.worker,
      area: worker.area,
      status: "idle",
      capabilities: worker.capabilities,
      metadata: {
        seededBy: "nexora_mega_build_15",
        nexoraBrain: true,
        registeredAt: now(),
      },
    });
  }

  await writeNexoraOperatingReport(
    "supplier_workers",
    "info",
    "Nexora supplier workers registered",
    `Registered ${workers.length} supplier command workers.`,
    { workers }
  );

  return { ok: true, nexoraBrain: true, workers };
}

export function buildNexoraSupplierMatrix(input: any = {}) {
  const matrixId = String(input.matrixId || id("supplier_matrix"));
  const suppliers = Array.isArray(input.suppliers) ? input.suppliers : [
    { name: "Preferred Supplier Pool", leadTimeDays: 10, priceScore: 8, stockScore: 7, warrantyScore: 8 },
    { name: "Alternate Supplier A", leadTimeDays: 16, priceScore: 7, stockScore: 8, warrantyScore: 7 },
    { name: "Alternate Supplier B", leadTimeDays: 7, priceScore: 6, stockScore: 6, warrantyScore: 6 },
  ];

  const ranked = suppliers.map((s: any) => {
    const leadTimeDays = num(s.leadTimeDays, 14);
    const priceScore = num(s.priceScore, 5);
    const stockScore = num(s.stockScore, 5);
    const warrantyScore = num(s.warrantyScore, 5);
    const leadTimeScore = Math.max(0, 10 - Math.min(10, leadTimeDays / 3));
    const totalScore = Math.round((priceScore * 0.35 + stockScore * 0.3 + warrantyScore * 0.2 + leadTimeScore * 0.15) * 100) / 100;

    return {
      name: String(s.name || "Unnamed supplier"),
      leadTimeDays,
      priceScore,
      stockScore,
      warrantyScore,
      leadTimeScore,
      totalScore,
      risk: totalScore >= 7.5 ? "low" : totalScore >= 6 ? "medium" : "high",
    };
  }).sort((a: any, b: any) => b.totalScore - a.totalScore);

  return {
    ok: true,
    nexoraBrain: true,
    matrixId,
    createdAt: now(),
    ranked,
    recommendedSupplier: ranked[0],
    rules: {
      noPurchaseOrder: true,
      noBindingCommitment: true,
      approvalRequiredForPurchaseOrder: true,
    },
  };
}

export function draftNexoraSupplierRfq(input: any = {}) {
  const rfqId = String(input.rfqId || id("rfq"));
  const companyName = String(input.companyName || "The Corporate Desk");
  const project = String(input.project || "office furniture and fitout quote");
  const items = Array.isArray(input.items) ? input.items : [
    { name: "Workstation desk", quantity: 20 },
    { name: "Ergonomic task chair", quantity: 20 },
  ];

  const message = [
    "Hello,",
    "",
    `We are preparing a non-binding supplier confirmation for ${project}.`,
    "Please confirm the following:",
    "",
    ...items.map((item: any) => `- ${item.quantity || 1} x ${item.name || "item"}: unit cost, stock, lead time, delivery cost, warranty, and equivalent alternatives.`),
    "",
    "This is an information request only and is not a purchase order or supplier commitment.",
    "",
    `Regards,`,
    companyName,
  ].join("\n");

  return {
    ok: true,
    nexoraBrain: true,
    rfqId,
    createdAt: now(),
    project,
    items,
    message,
    safety: {
      nonBinding: true,
      noPurchaseOrder: true,
      supplierCommitmentApprovalGated: true,
    },
  };
}

export async function queueNexoraSupplierSweep(input: any = {}) {
  await ensureNexoraDurableKernel();
  await registerNexoraSupplierWorkers();

  const matrix = buildNexoraSupplierMatrix(input);
  const rfq = draftNexoraSupplierRfq(input);

  const governed = await governAndQueueNexoraAction({
    area: "procurement",
    action: "run_supplier_sweep_without_commitment",
    risk: "medium",
    priority: Number(input.priority || 88),
    payload: {
      matrix,
      rfq,
      bindingCommitment: false,
      purchaseOrder: false,
    },
  });

  const highRiskHold = await governAndQueueNexoraAction({
    area: "procurement",
    action: "review_supplier_purchase_order_or_commitment",
    risk: "high",
    priority: 98,
    payload: {
      matrix,
      rfq,
      bindingCommitment: true,
      purchaseOrder: true,
    },
  });

  await createNexoraDelegation({
    parentWorker: "nexora_supplier_command",
    childWorker: "nexora_rfq_writer",
    mission: "Prepare non-binding RFQ drafts and supplier intelligence requests.",
    authorityScope: "Information request only. No purchase order. No supplier commitment.",
    risk: "medium",
    payload: { matrix, rfq },
  });

  await createNexoraMemoryGraphEdge({
    sourceType: "supplier_matrix",
    sourceId: matrix.matrixId,
    relation: "supplies",
    targetType: "division",
    targetId: "office",
    weight: 1.5,
    payload: matrix,
  });

  await createNexoraAuditVaultEntry({
    auditType: "supplier_sweep",
    subject: matrix.matrixId,
    summary: `Supplier matrix ${matrix.matrixId} and RFQ ${rfq.rfqId} created.`,
    payload: { matrix, rfq },
    includeSnapshot: false,
  });

  await writeNexoraOperatingReport(
    "supplier_sweep",
    "warning",
    "Nexora supplier sweep queued",
    `Supplier sweep ${matrix.matrixId} queued. Purchase order path approval-gated.`,
    { matrix, rfq, governed, highRiskHold }
  );

  return { ok: true, nexoraBrain: true, matrix, rfq, governed, highRiskHold };
}

export async function getNexoraSupplierStatus() {
  await ensureNexoraDurableKernel();
  const snapshot = await getNexoraDurableCommandSnapshot();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_supplier_command",
    capabilities: [
      "Supplier matrix",
      "RFQ draft",
      "Supplier risk ranking",
      "Purchase order approval gate",
    ],
    snapshot,
  };
}
