import { db } from "../../db";
import { complianceRules, complianceAuditLogs, paperPositions } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

const HARD_LIMITS = {
  maxPositionNotional: 25000,
  maxDailyLoss: -5000,
  maxGrossExposure: 80000,
  maxOpenPositions: 8,
  maxCorrelatedExposure: 40000,
  maxSingleAssetPct: 35,
  minConfidence: 0.6,
  maxFeedStaleness: 120,
};

export interface ComplianceCheckResult {
  approved: boolean;
  violations: { rule: string; severity: string; detail: string }[];
  warnings: { rule: string; detail: string }[];
}

export async function validateTradeCompliance(params: {
  symbol: string;
  side: string;
  notional: number;
  confidence: number;
  decisionId?: string;
}): Promise<ComplianceCheckResult> {
  const violations: { rule: string; severity: string; detail: string }[] = [];
  const warnings: { rule: string; detail: string }[] = [];

  if (params.notional > HARD_LIMITS.maxPositionNotional) {
    violations.push({ rule: "max_position_size", severity: "critical", detail: `Notional $${params.notional} exceeds limit $${HARD_LIMITS.maxPositionNotional}` });
  }

  if (params.confidence < HARD_LIMITS.minConfidence) {
    warnings.push({ rule: "min_confidence", detail: `Confidence ${params.confidence} below threshold ${HARD_LIMITS.minConfidence}` });
  }

  const openPositions = await db.select().from(paperPositions).where(eq(paperPositions.status, "open"));
  if (openPositions.length >= HARD_LIMITS.maxOpenPositions) {
    violations.push({ rule: "max_open_positions", severity: "critical", detail: `${openPositions.length} open positions at limit ${HARD_LIMITS.maxOpenPositions}` });
  }

  const grossExposure = openPositions.reduce((sum, p) => sum + (p.paperCapitalAllocated || 0), 0) + params.notional;
  if (grossExposure > HARD_LIMITS.maxGrossExposure) {
    violations.push({ rule: "max_gross_exposure", severity: "critical", detail: `Gross exposure $${grossExposure.toFixed(0)} exceeds $${HARD_LIMITS.maxGrossExposure}` });
  }

  const symbolExposure = openPositions.filter(p => p.symbol === params.symbol).reduce((s, p) => s + (p.paperCapitalAllocated || 0), 0) + params.notional;
  const singleAssetPct = (symbolExposure / HARD_LIMITS.maxGrossExposure) * 100;
  if (singleAssetPct > HARD_LIMITS.maxSingleAssetPct) {
    violations.push({ rule: "max_single_asset_pct", severity: "high", detail: `${params.symbol} at ${singleAssetPct.toFixed(1)}% exceeds ${HARD_LIMITS.maxSingleAssetPct}%` });
  }

  const approved = violations.length === 0;

  if (!approved && params.decisionId) {
    await logComplianceEvent("trade_blocked", "warning", params.decisionId, params.symbol, `Trade blocked: ${violations.map(v => v.rule).join(", ")}`, violations[0]?.rule);
  }

  return { approved, violations, warnings };
}

export async function logComplianceEvent(
  eventType: string, severity: string, decisionId: string | null,
  symbol: string | null, details: string, ruleTriggered?: string,
): Promise<void> {
  try {
    await db.insert(complianceAuditLogs).values({
      eventType, severity, decisionId, symbol, details,
      ruleTriggered: ruleTriggered || null, actionTaken: severity === "critical" ? "blocked" : "logged",
    });
  } catch (err) {
    console.error("[compliance] Failed to write audit log:", err instanceof Error ? err.message : err);
  }
}

export async function getComplianceStatus(): Promise<{
  rules: any[];
  recentAuditLogs: any[];
  hardLimits: typeof HARD_LIMITS;
  currentExposure: { grossExposure: number; openPositions: number; bySymbol: Record<string, number> };
}> {
  const [rules, logs, positions] = await Promise.all([
    db.select().from(complianceRules).where(eq(complianceRules.isActive, true)),
    db.select().from(complianceAuditLogs).orderBy(desc(complianceAuditLogs.createdAt)).limit(30),
    db.select().from(paperPositions).where(eq(paperPositions.status, "open")),
  ]);

  const bySymbol: Record<string, number> = {};
  let grossExposure = 0;
  for (const p of positions) {
    bySymbol[p.symbol] = (bySymbol[p.symbol] || 0) + (p.paperCapitalAllocated || 0);
    grossExposure += p.paperCapitalAllocated || 0;
  }

  return {
    rules,
    recentAuditLogs: logs,
    hardLimits: HARD_LIMITS,
    currentExposure: { grossExposure, openPositions: positions.length, bySymbol },
  };
}
