import { db } from "../../db";
import { portfolioAllocationLogs } from "@shared/schema";
import { calculatePortfolioState, type PortfolioState } from "./portfolioState";
import { getClusterForSymbol, getCorrelationAdjustedExposure } from "./correlationModel";
import { evaluateRiskThrottle } from "./portfolioRiskThrottle";
import { getActiveConfig, type TradingParameters } from "./tradingConfig";

export interface AllocationRequest {
  decisionId: string;
  symbol: string;
  strategy: string;
  side: "long" | "short";
  confidence: number;
  requestedRisk: number;
  regime?: string;
}

export interface AllocationResult {
  approved: boolean;
  approvedSize: number;
  approvedRisk: number;
  reason: string;
  reductions: string[];
  cluster: string;
  portfolioState: PortfolioState;
}

export interface PortfolioLimits {
  maxExposurePerAsset: number;
  maxExposurePerStrategy: number;
  maxCorrelatedClusterExposure: number;
  maxGrossExposure: number;
  maxOpenPositions: number;
  drawdownRiskThrottle: number;
  maxNetLongExposure: number;
  maxNetShortExposure: number;
}

const DEFAULT_LIMITS: PortfolioLimits = {
  maxExposurePerAsset: 25000,
  maxExposurePerStrategy: 30000,
  maxCorrelatedClusterExposure: 40000,
  maxGrossExposure: 80000,
  maxOpenPositions: 8,
  drawdownRiskThrottle: 15,
  maxNetLongExposure: 60000,
  maxNetShortExposure: 40000,
};

export function getPortfolioLimits(config?: TradingParameters): PortfolioLimits {
  const portfolioLimits = (config as any)?.portfolioLimits;
  if (portfolioLimits) {
    return { ...DEFAULT_LIMITS, ...portfolioLimits };
  }
  return { ...DEFAULT_LIMITS };
}

export async function evaluateAllocation(request: AllocationRequest): Promise<AllocationResult> {
  const portfolioState = await calculatePortfolioState();
  const { config } = await getActiveConfig();
  const limits = getPortfolioLimits(config);
  const cluster = getClusterForSymbol(request.symbol);
  const reductions: string[] = [];

  let approvedSize = request.requestedRisk;

  const throttle = evaluateRiskThrottle(portfolioState);
  if (throttle.blockNewTrades) {
    await logAllocation(request, 0, 0, true, throttle.blockReason || "risk_throttle_block", cluster, portfolioState);
    return {
      approved: false,
      approvedSize: 0,
      approvedRisk: 0,
      reason: throttle.blockReason || "risk throttle active",
      reductions: throttle.flags,
      cluster,
      portfolioState,
    };
  }

  if (throttle.sizeMultiplier < 1.0) {
    approvedSize = Math.round(approvedSize * throttle.sizeMultiplier * 100) / 100;
    reductions.push(`risk_throttle_${throttle.throttleLevel}: size reduced to ${(throttle.sizeMultiplier * 100).toFixed(0)}%`);
  }

  if (portfolioState.openPositionsCount >= limits.maxOpenPositions) {
    await logAllocation(request, 0, 0, true, `max_open_positions (${limits.maxOpenPositions}) reached`, cluster, portfolioState);
    return {
      approved: false,
      approvedSize: 0,
      approvedRisk: 0,
      reason: `max open positions (${limits.maxOpenPositions}) reached`,
      reductions,
      cluster,
      portfolioState,
    };
  }

  const currentAssetExposure = portfolioState.exposureBySymbol[request.symbol] || 0;
  if (currentAssetExposure + approvedSize > limits.maxExposurePerAsset) {
    const remaining = Math.max(0, limits.maxExposurePerAsset - currentAssetExposure);
    if (remaining <= 0) {
      await logAllocation(request, 0, 0, true, `asset_exposure_cap: ${request.symbol} at ${currentAssetExposure}/${limits.maxExposurePerAsset}`, cluster, portfolioState);
      return {
        approved: false,
        approvedSize: 0,
        approvedRisk: 0,
        reason: `${request.symbol} exposure cap reached (${currentAssetExposure}/${limits.maxExposurePerAsset})`,
        reductions,
        cluster,
        portfolioState,
      };
    }
    approvedSize = Math.min(approvedSize, remaining);
    reductions.push(`asset_cap: ${request.symbol} reduced to ${approvedSize}`);
  }

  const currentStrategyExposure = portfolioState.exposureByStrategy[request.strategy] || 0;
  if (currentStrategyExposure + approvedSize > limits.maxExposurePerStrategy) {
    const remaining = Math.max(0, limits.maxExposurePerStrategy - currentStrategyExposure);
    if (remaining <= 0) {
      await logAllocation(request, 0, 0, true, `strategy_exposure_cap: ${request.strategy} at ${currentStrategyExposure}/${limits.maxExposurePerStrategy}`, cluster, portfolioState);
      return {
        approved: false,
        approvedSize: 0,
        approvedRisk: 0,
        reason: `${request.strategy} strategy cap reached (${currentStrategyExposure}/${limits.maxExposurePerStrategy})`,
        reductions,
        cluster,
        portfolioState,
      };
    }
    approvedSize = Math.min(approvedSize, remaining);
    reductions.push(`strategy_cap: ${request.strategy} reduced to ${approvedSize}`);
  }

  const currentClusterExposure = portfolioState.exposureByCluster[cluster] || 0;
  if (currentClusterExposure + approvedSize > limits.maxCorrelatedClusterExposure) {
    const remaining = Math.max(0, limits.maxCorrelatedClusterExposure - currentClusterExposure);
    if (remaining <= 0) {
      await logAllocation(request, 0, 0, true, `cluster_exposure_cap: ${cluster} at ${currentClusterExposure}/${limits.maxCorrelatedClusterExposure}`, cluster, portfolioState);
      return {
        approved: false,
        approvedSize: 0,
        approvedRisk: 0,
        reason: `${cluster} cluster cap reached (${currentClusterExposure}/${limits.maxCorrelatedClusterExposure})`,
        reductions,
        cluster,
        portfolioState,
      };
    }
    approvedSize = Math.min(approvedSize, remaining);
    reductions.push(`cluster_cap: ${cluster} cluster reduced to ${approvedSize}`);
  }

  if (portfolioState.grossExposure + approvedSize > limits.maxGrossExposure) {
    const remaining = Math.max(0, limits.maxGrossExposure - portfolioState.grossExposure);
    if (remaining <= 0) {
      await logAllocation(request, 0, 0, true, `gross_exposure_cap: ${portfolioState.grossExposure}/${limits.maxGrossExposure}`, cluster, portfolioState);
      return {
        approved: false,
        approvedSize: 0,
        approvedRisk: 0,
        reason: `gross exposure cap reached (${portfolioState.grossExposure}/${limits.maxGrossExposure})`,
        reductions,
        cluster,
        portfolioState,
      };
    }
    approvedSize = Math.min(approvedSize, remaining);
    reductions.push(`gross_exposure_cap: reduced to ${approvedSize}`);
  }

  const netDirection = request.side === "long" ? portfolioState.netExposure + approvedSize : portfolioState.netExposure - approvedSize;
  if (netDirection > limits.maxNetLongExposure) {
    const remaining = Math.max(0, limits.maxNetLongExposure - portfolioState.netExposure);
    approvedSize = Math.min(approvedSize, remaining);
    reductions.push(`net_long_cap: reduced to ${approvedSize}`);
  }
  if (netDirection < -limits.maxNetShortExposure) {
    const remaining = Math.max(0, limits.maxNetShortExposure + portfolioState.netExposure);
    approvedSize = Math.min(approvedSize, remaining);
    reductions.push(`net_short_cap: reduced to ${approvedSize}`);
  }

  if (request.confidence < 70) {
    approvedSize = Math.round(approvedSize * 0.75 * 100) / 100;
    reductions.push("low_confidence: size reduced 25%");
  }

  approvedSize = Math.round(approvedSize * 100) / 100;

  if (approvedSize <= 0) {
    await logAllocation(request, 0, 0, true, "approved_size_zero_after_reductions", cluster, portfolioState);
    return {
      approved: false,
      approvedSize: 0,
      approvedRisk: 0,
      reason: "approved size reduced to zero after all caps applied",
      reductions,
      cluster,
      portfolioState,
    };
  }

  const approvedRisk = approvedSize;
  await logAllocation(request, approvedRisk, approvedSize, false, null, cluster, portfolioState);

  return {
    approved: true,
    approvedSize,
    approvedRisk,
    reason: reductions.length > 0 ? `approved with reductions: ${reductions.join(", ")}` : "full size approved",
    reductions,
    cluster,
    portfolioState,
  };
}

async function logAllocation(
  request: AllocationRequest,
  approvedRisk: number,
  approvedSize: number,
  wasBlocked: boolean,
  blockReason: string | null,
  cluster: string,
  portfolioState: PortfolioState,
): Promise<void> {
  try {
    await db.insert(portfolioAllocationLogs).values({
      decisionId: request.decisionId,
      symbol: request.symbol,
      strategy: request.strategy,
      requestedRisk: request.requestedRisk,
      approvedRisk,
      requestedSize: request.requestedRisk,
      approvedSize,
      wasBlocked,
      blockReason,
      correlatedCluster: cluster,
      portfolioStateJson: {
        totalEquity: portfolioState.totalEquity,
        grossExposure: portfolioState.grossExposure,
        netExposure: portfolioState.netExposure,
        openPositionsCount: portfolioState.openPositionsCount,
        drawdown: portfolioState.drawdownState.currentDrawdown,
        throttle: portfolioState.riskThrottleState,
      },
    });
  } catch (err: any) {
    console.error(`[PortfolioAllocator] Failed to log allocation:`, err?.message);
  }
}

export async function getRecentAllocationLogs(limit = 30): Promise<any[]> {
  return db.select().from(portfolioAllocationLogs).orderBy(portfolioAllocationLogs.createdAt).limit(limit);
}

export async function getBlockedAllocations(limit = 20): Promise<any[]> {
  const { eq, desc: dsc } = await import("drizzle-orm");
  return db.select().from(portfolioAllocationLogs)
    .where(eq(portfolioAllocationLogs.wasBlocked, true))
    .orderBy(dsc(portfolioAllocationLogs.createdAt))
    .limit(limit);
}
