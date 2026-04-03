import { db } from "../../db";
import { tradingConfigVersions, tradingConfigChanges } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface TradingParameters {
  minConfidence: number;
  minVolumeRatio: number;
  maxHoldMinutes: number;
  maxRiskPerTrade: number;
  maxOpenPositions: number;
  enabledStrategies: string[];
  symbolRiskMultipliers: Record<string, number>;
  regimeFilters: Record<string, string[]>;
  minDataQualityScore: number;
}

const DEFAULT_CONFIG: TradingParameters = {
  minConfidence: 60,
  minVolumeRatio: 1.0,
  maxHoldMinutes: 1440,
  maxRiskPerTrade: 5000,
  maxOpenPositions: 5,
  enabledStrategies: ["momentum_breakout", "mean_reversion", "trend_follow", "volatility_squeeze", "regime_shift"],
  symbolRiskMultipliers: { BTC: 1.0, ETH: 1.0, SOL: 1.2 },
  regimeFilters: {
    momentum_breakout: ["trending", "breakout"],
    mean_reversion: ["ranging"],
    trend_follow: ["trending"],
    volatility_squeeze: ["low_volatility"],
    regime_shift: ["transition"],
  },
  minDataQualityScore: 40,
};

export async function getActiveConfig(): Promise<{ version: any; config: TradingParameters }> {
  const active = await db
    .select()
    .from(tradingConfigVersions)
    .where(eq(tradingConfigVersions.isActive, true))
    .limit(1);

  if (active.length > 0) {
    return { version: active[0], config: active[0].configJson as TradingParameters };
  }

  return { version: null, config: { ...DEFAULT_CONFIG } };
}

export async function createConfigVersion(
  config: TradingParameters,
  changeSummary: string,
  sourceRecommendationIds: string[] = [],
  createdBy: string = "system",
): Promise<string> {
  const existing = await db.select().from(tradingConfigVersions).where(eq(tradingConfigVersions.isActive, true));

  const versionNumber = existing.length > 0
    ? parseInt(existing[0].versionName.replace("v", "")) + 1
    : 1;

  const [inserted] = await db.insert(tradingConfigVersions).values({
    versionName: `v${versionNumber}`,
    configJson: config as any,
    isActive: false,
    sourceRecommendationIds,
    changeSummary,
    approvalStatus: "pending",
    createdBy,
  }).returning({ id: tradingConfigVersions.id });

  return inserted.id;
}

export async function activateConfigVersion(versionId: string): Promise<void> {
  await db.update(tradingConfigVersions).set({ isActive: false, deactivatedAt: new Date() });
  await db.update(tradingConfigVersions).set({
    isActive: true,
    activatedAt: new Date(),
    approvalStatus: "approved",
  }).where(eq(tradingConfigVersions.id, versionId));
}

export async function recordConfigChange(
  configVersionId: string,
  parameterKey: string,
  oldValue: string | null,
  newValue: string,
  reason: string,
  evidence: Record<string, any> = {},
): Promise<void> {
  await db.insert(tradingConfigChanges).values({
    configVersionId,
    parameterKey,
    oldValue,
    newValue,
    reason,
    evidenceJson: evidence,
  });
}

export async function getConfigHistory(limit: number = 10): Promise<any[]> {
  return db
    .select()
    .from(tradingConfigVersions)
    .orderBy(desc(tradingConfigVersions.createdAt))
    .limit(limit);
}

export async function getConfigChanges(configVersionId: string): Promise<any[]> {
  return db
    .select()
    .from(tradingConfigChanges)
    .where(eq(tradingConfigChanges.configVersionId, configVersionId));
}

export async function ensureBaselineConfig(): Promise<void> {
  const existing = await db.select().from(tradingConfigVersions).limit(1);
  if (existing.length === 0) {
    const [inserted] = await db.insert(tradingConfigVersions).values({
      versionName: "v1",
      configJson: DEFAULT_CONFIG as any,
      isActive: true,
      activatedAt: new Date(),
      changeSummary: "Initial baseline configuration",
      approvalStatus: "approved",
      createdBy: "system",
    }).returning({ id: tradingConfigVersions.id });

    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      await db.insert(tradingConfigChanges).values({
        configVersionId: inserted.id,
        parameterKey: key,
        oldValue: null,
        newValue: JSON.stringify(value),
        reason: "Initial baseline value",
      });
    }
  }
}

export { DEFAULT_CONFIG };
