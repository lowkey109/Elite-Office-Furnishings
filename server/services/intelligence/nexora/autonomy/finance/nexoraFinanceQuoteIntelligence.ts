import {
  claimAndRunNexoraSafeTasks,
  createNexoraDivisionObjective,
  createNexoraDurableTask,
  createNexoraMemoryGraphEdge,
  ensureNexoraDurableKernel,
  getNexoraDurableCommandSnapshot,
  upsertNexoraWorker,
  writeNexoraOperatingReport,
} from "../persistence/nexoraDurableKernel";
import { classifyNexoraRisk, governAndQueueNexoraAction } from "../governor/nexoraAutonomyGovernor";
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

export async function registerNexoraFinanceWorkers() {
  await ensureNexoraDurableKernel();

  const workers = [
    {
      worker: "nexora_margin_guardian",
      area: "finance",
      capabilities: ["margin_guardrails", "quote_profitability", "approval_thresholds"],
    },
    {
      worker: "nexora_quote_intelligence_engine",
      area: "finance",
      capabilities: ["quote_scenario_analysis", "gst_estimation", "discount_control"],
    },
    {
      worker: "nexora_revenue_forecaster",
      area: "finance",
      capabilities: ["pipeline_forecast", "weighted_revenue", "margin_forecast"],
    },
  ];

  for (const worker of workers) {
    await upsertNexoraWorker({
      worker: worker.worker,
      area: worker.area,
      status: "idle",
      capabilities: worker.capabilities,
      metadata: {
        seededBy: "nexora_mega_build_14",
        nexoraBrain: true,
        registeredAt: now(),
      },
    });
  }

  await writeNexoraOperatingReport(
    "finance_workers",
    "info",
    "Nexora finance workers registered",
    `Registered ${workers.length} finance workers.`,
    { workers }
  );

  return { ok: true, nexoraBrain: true, workers };
}

export function analyseNexoraQuote(input: any = {}) {
  const quoteId = String(input.quoteId || id("quote_analysis"));
  const subtotal = num(input.subtotal ?? input.budget ?? input.quoteTotal, 15000);
  const estimatedCost = num(input.estimatedCost, subtotal * 0.62);
  const discountPercent = num(input.discountPercent, 0);
  const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
  const netSubtotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const gst = Math.round(netSubtotal * 0.1 * 100) / 100;
  const total = Math.round((netSubtotal + gst) * 100) / 100;
  const marginAmount = Math.round((netSubtotal - estimatedCost) * 100) / 100;
  const marginPercent = netSubtotal > 0 ? Math.round((marginAmount / netSubtotal) * 10000) / 100 : 0;
  const highValue = total >= 25000;
  const lowMargin = marginPercent < 22;
  const approvalRequired = highValue || lowMargin || discountPercent >= 10;

  const risk = approvalRequired ? "high" : total >= 15000 ? "medium" : "low";

  return {
    ok: true,
    nexoraBrain: true,
    quoteId,
    createdAt: now(),
    input,
    subtotal,
    estimatedCost,
    discountPercent,
    discountAmount,
    netSubtotal,
    gst,
    total,
    marginAmount,
    marginPercent,
    risk,
    approvalRequired,
    flags: {
      highValue,
      lowMargin,
      heavyDiscount: discountPercent >= 10,
    },
    recommendations: [
      lowMargin ? "Review margin before customer-facing release." : "Margin is within current draft threshold.",
      highValue ? "High-value quote requires approval gate." : "Quote value below high-value threshold.",
      discountPercent >= 10 ? "Discount level requires approval." : "Discount level does not trigger approval.",
      "Confirm supplier cost and lead time before final quote release.",
    ],
  };
}

export async function queueNexoraQuoteAnalysis(input: any = {}) {
  await ensureNexoraDurableKernel();
  await registerNexoraFinanceWorkers();

  const analysis = analyseNexoraQuote(input);

  const governed = await governAndQueueNexoraAction({
    area: "finance",
    action: "review_quote_profitability_and_release_gate",
    risk: analysis.risk,
    priority: analysis.approvalRequired ? 96 : 82,
    payload: {
      analysis,
      customerFacing: true,
      quoteTotal: analysis.total,
      bindingCommitment: analysis.approvalRequired,
    },
  });

  await createNexoraMemoryGraphEdge({
    sourceType: "quote",
    sourceId: analysis.quoteId,
    relation: analysis.approvalRequired ? "escalates_to" : "reports_to",
    targetType: "worker",
    targetId: analysis.approvalRequired ? "nexora_execution_gate" : "nexora_margin_guardian",
    weight: analysis.approvalRequired ? 3 : 1,
    payload: analysis,
  });

  await createNexoraAuditVaultEntry({
    auditType: "quote_finance_analysis",
    subject: analysis.quoteId,
    summary: `Quote ${analysis.quoteId} analysed. Margin ${analysis.marginPercent}%. Approval required: ${analysis.approvalRequired}.`,
    payload: analysis,
    includeSnapshot: false,
  });

  await writeNexoraOperatingReport(
    "quote_finance_analysis",
    analysis.approvalRequired ? "warning" : "info",
    "Nexora quote finance analysis completed",
    `Quote ${analysis.quoteId}: total ${analysis.total}, margin ${analysis.marginPercent}%, approval ${analysis.approvalRequired}.`,
    { analysis, governed }
  );

  return { ok: true, nexoraBrain: true, analysis, governed };
}

export async function forecastNexoraRevenue(input: any = {}) {
  await ensureNexoraDurableKernel();

  const opportunities = Array.isArray(input.opportunities) ? input.opportunities : [
    { name: "Default workstation package", value: 18000, probability: 0.55, marginPercent: 34 },
    { name: "Default fitout refresh", value: 32000, probability: 0.35, marginPercent: 30 },
    { name: "Default boardroom package", value: 9500, probability: 0.65, marginPercent: 38 },
  ];

  const rows = opportunities.map((o: any) => {
    const value = num(o.value, 0);
    const probability = Math.max(0, Math.min(1, num(o.probability, 0.5)));
    const marginPercent = num(o.marginPercent, 30);
    const weightedRevenue = Math.round(value * probability * 100) / 100;
    const weightedMargin = Math.round(weightedRevenue * (marginPercent / 100) * 100) / 100;
    return {
      name: String(o.name || "opportunity"),
      value,
      probability,
      marginPercent,
      weightedRevenue,
      weightedMargin,
    };
  });

  const totals = {
    pipelineValue: Math.round(rows.reduce((s: number, r: any) => s + r.value, 0) * 100) / 100,
    weightedRevenue: Math.round(rows.reduce((s: number, r: any) => s + r.weightedRevenue, 0) * 100) / 100,
    weightedMargin: Math.round(rows.reduce((s: number, r: any) => s + r.weightedMargin, 0) * 100) / 100,
  };

  await createNexoraDurableTask({
    worker: "nexora_revenue_forecaster",
    area: "finance",
    action: "record_revenue_forecast",
    risk: "safe",
    priority: 74,
    payload: { rows, totals },
    source: "nexora.finance.forecast",
  });

  await writeNexoraOperatingReport(
    "revenue_forecast",
    "info",
    "Nexora revenue forecast created",
    `Weighted revenue ${totals.weightedRevenue}, weighted margin ${totals.weightedMargin}.`,
    { rows, totals }
  );

  return { ok: true, nexoraBrain: true, rows, totals };
}

export async function getNexoraFinanceStatus() {
  await ensureNexoraDurableKernel();
  const snapshot = await getNexoraDurableCommandSnapshot();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_finance_quote_intelligence",
    generatedAt: now(),
    capabilities: [
      "Quote margin analysis",
      "GST and discount modelling",
      "Approval gate prediction",
      "Revenue forecasting",
      "Audit vault recording",
    ],
    snapshot,
  };
}
