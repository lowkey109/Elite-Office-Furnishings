import type { RiskDecision } from "./risk-governor";

/**
 * Capital Allocator V2
 *
 * Purpose:
 * - turn a trade opportunity into a capital sizing recommendation
 * - use wallet quality, conviction, market risk, and portfolio constraints
 * - stay explainable and deterministic
 * - never replace the risk-governor; only propose size
 */

export type TradeSide = "buy" | "sell";
export type AssetClass = "spot" | "perpetual" | "unknown";

export interface CopyabilityLike {
  approved?: boolean;
  confidenceScore?: number;
}

export interface CapitalAllocatorMarketContext {
  symbol: string;
  side: TradeSide;
  price: number;
  assetClass?: AssetClass;
  volatilityScore?: number; // 0..1
  liquidityScore?: number; // 0..1
}

export interface CapitalAllocatorWalletContext {
  walletAddress: string;
  walletScore?: number; // 0..100
  consistencyScore?: number; // 0..1
  convictionScore?: number; // 0..1
  recentWinRate?: number; // 0..1
  avgReturnPerTrade?: number;
  maxDrawdownScore?: number; // 0..1 where 1 = bad
}

export interface CapitalAllocatorPortfolioContext {
  totalEquity: number;
  availableCash: number;
  currentOpenPositions: number;
  maxOpenPositions?: number;
  currentPortfolioHeat?: number; // 0..1
  symbolExposure?: number;
  sideExposure?: number;
}

export interface CapitalAllocatorInput {
  market: CapitalAllocatorMarketContext;
  wallet: CapitalAllocatorWalletContext;
  portfolio: CapitalAllocatorPortfolioContext;
  copyability?: CopyabilityLike | null;
  priorRiskDecision?: RiskDecision | null;
}

export interface CapitalAllocatorDecision {
  approved: boolean;
  recommendedNotional: number;
  maxPermittedNotional: number;
  recommendedUnits: number;
  sizingFractionOfEquity: number;
  sizingFractionOfCash: number;
  convictionMultiplier: number;
  qualityMultiplier: number;
  riskDragMultiplier: number;
  portfolioDragMultiplier: number;
  explanation: string[];
  warnings: string[];
  metadata: {
    baseFraction: number;
    effectiveFraction: number;
    normalizedWalletScore: number;
    normalizedVolatility: number;
    normalizedLiquidity: number;
    normalizedPortfolioHeat: number;
  };
}

const DEFAULTS = {
  minEquity: 100,
  baseFractionOfEquity: 0.02,
  minFractionOfEquity: 0.0025,
  maxFractionOfEquity: 0.08,
  maxFractionOfCash: 0.4,
  maxSingleSymbolExposureFraction: 0.12,
  maxSideExposureFraction: 0.35,
  volatilityPenaltyWeight: 0.45,
  liquidityBonusWeight: 0.2,
  portfolioHeatPenaltyWeight: 0.5,
  openPositionPenaltyWeight: 0.25,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeWalletScore(score?: number): number {
  return clamp(safeNumber(score, 50) / 100, 0, 1);
}

function inferQualityMultiplier(wallet: CapitalAllocatorWalletContext): number {
  const walletScore = normalizeWalletScore(wallet.walletScore);
  const consistency = clamp(safeNumber(wallet.consistencyScore, 0.5), 0, 1);
  const recentWinRate = clamp(safeNumber(wallet.recentWinRate, 0.5), 0, 1);
  const drawdownPenalty = clamp(safeNumber(wallet.maxDrawdownScore, 0.3), 0, 1);

  const weighted =
    walletScore * 0.45 +
    consistency * 0.30 +
    recentWinRate * 0.20 +
    (1 - drawdownPenalty) * 0.05;

  return clamp(0.55 + weighted * 0.8, 0.4, 1.4);
}

function inferConvictionMultiplier(
  wallet: CapitalAllocatorWalletContext,
  copyability?: CopyabilityLike | null,
): number {
  const conviction = clamp(safeNumber(wallet.convictionScore, 0.5), 0, 1);
  const copyabilityConfidence = clamp(
    safeNumber(copyability?.confidenceScore, 0.5),
    0,
    1,
  );

  const weighted = conviction * 0.65 + copyabilityConfidence * 0.35;
  let result = 0.7 + weighted * 0.7;

  if (copyability?.approved === false) {
    result *= 0.75;
  }

  return clamp(result, 0.5, 1.5);
}

function inferRiskDragMultiplier(
  market: CapitalAllocatorMarketContext,
  priorRiskDecision?: RiskDecision | null,
): {
  multiplier: number;
  normalizedVolatility: number;
  normalizedLiquidity: number;
  warnings: string[];
} {
  const warnings: string[] = [];

  const volatility = clamp(safeNumber(market.volatilityScore, 0.5), 0, 1);
  const liquidity = clamp(safeNumber(market.liquidityScore, 0.5), 0, 1);

  let multiplier = 1;

  multiplier -= volatility * DEFAULTS.volatilityPenaltyWeight;
  multiplier += liquidity * DEFAULTS.liquidityBonusWeight;

  if (priorRiskDecision && priorRiskDecision.allowed === false) {
    multiplier *= 0.25;
    warnings.push(
      `Prior risk decision blocked or nearly blocked trade: ${priorRiskDecision.reason ?? "unknown_reason"}`,
    );
  }

  if (volatility > 0.8) {
    warnings.push("High volatility detected — sizing reduced.");
  }

  if (liquidity < 0.25) {
    warnings.push("Low liquidity detected — sizing reduced.");
  }

  return {
    multiplier: clamp(multiplier, 0.15, 1.1),
    normalizedVolatility: volatility,
    normalizedLiquidity: liquidity,
    warnings,
  };
}

function inferPortfolioDragMultiplier(
  portfolio: CapitalAllocatorPortfolioContext,
): {
  multiplier: number;
  normalizedPortfolioHeat: number;
  warnings: string[];
} {
  const warnings: string[] = [];

  const heat = clamp(safeNumber(portfolio.currentPortfolioHeat, 0), 0, 1);
  const maxOpenPositions = Math.max(1, safeNumber(portfolio.maxOpenPositions, 10));
  const currentOpenPositions = Math.max(0, safeNumber(portfolio.currentOpenPositions, 0));

  const positionLoad = clamp(currentOpenPositions / maxOpenPositions, 0, 1);

  let multiplier = 1;
  multiplier -= heat * DEFAULTS.portfolioHeatPenaltyWeight;
  multiplier -= positionLoad * DEFAULTS.openPositionPenaltyWeight;

  if (heat > 0.75) {
    warnings.push("Portfolio heat is elevated — sizing reduced.");
  }

  if (positionLoad > 0.85) {
    warnings.push("Open position count is near limit — sizing reduced.");
  }

  return {
    multiplier: clamp(multiplier, 0.2, 1),
    normalizedPortfolioHeat: heat,
    warnings,
  };
}

function computeExposureCap(
  portfolio: CapitalAllocatorPortfolioContext,
  totalEquity: number,
): number {
  const symbolExposure = Math.max(0, safeNumber(portfolio.symbolExposure, 0));
  const sideExposure = Math.max(0, safeNumber(portfolio.sideExposure, 0));

  const symbolCap = totalEquity * DEFAULTS.maxSingleSymbolExposureFraction;
  const sideCap = totalEquity * DEFAULTS.maxSideExposureFraction;

  const remainingSymbolRoom = Math.max(0, symbolCap - symbolExposure);
  const remainingSideRoom = Math.max(0, sideCap - sideExposure);

  return Math.max(0, Math.min(remainingSymbolRoom, remainingSideRoom));
}

export function allocateCapitalV2(
  input: CapitalAllocatorInput,
): CapitalAllocatorDecision {
  const explanation: string[] = [];
  const warnings: string[] = [];

  const totalEquity = safeNumber(input.portfolio.totalEquity, 0);
  const availableCash = safeNumber(input.portfolio.availableCash, 0);
  const price = safeNumber(input.market.price, 0);

  if (totalEquity < DEFAULTS.minEquity) {
    return {
      approved: false,
      recommendedNotional: 0,
      maxPermittedNotional: 0,
      recommendedUnits: 0,
      sizingFractionOfEquity: 0,
      sizingFractionOfCash: 0,
      convictionMultiplier: 0,
      qualityMultiplier: 0,
      riskDragMultiplier: 0,
      portfolioDragMultiplier: 0,
      explanation: ["Portfolio equity below allocator minimum threshold."],
      warnings: [],
      metadata: {
        baseFraction: 0,
        effectiveFraction: 0,
        normalizedWalletScore: normalizeWalletScore(input.wallet.walletScore),
        normalizedVolatility: clamp(safeNumber(input.market.volatilityScore, 0.5), 0, 1),
        normalizedLiquidity: clamp(safeNumber(input.market.liquidityScore, 0.5), 0, 1),
        normalizedPortfolioHeat: clamp(
          safeNumber(input.portfolio.currentPortfolioHeat, 0),
          0,
          1,
        ),
      },
    };
  }

  if (availableCash <= 0) {
    return {
      approved: false,
      recommendedNotional: 0,
      maxPermittedNotional: 0,
      recommendedUnits: 0,
      sizingFractionOfEquity: 0,
      sizingFractionOfCash: 0,
      convictionMultiplier: 0,
      qualityMultiplier: 0,
      riskDragMultiplier: 0,
      portfolioDragMultiplier: 0,
      explanation: ["No available cash for new position sizing."],
      warnings: [],
      metadata: {
        baseFraction: 0,
        effectiveFraction: 0,
        normalizedWalletScore: normalizeWalletScore(input.wallet.walletScore),
        normalizedVolatility: clamp(safeNumber(input.market.volatilityScore, 0.5), 0, 1),
        normalizedLiquidity: clamp(safeNumber(input.market.liquidityScore, 0.5), 0, 1),
        normalizedPortfolioHeat: clamp(
          safeNumber(input.portfolio.currentPortfolioHeat, 0),
          0,
          1,
        ),
      },
    };
  }

  if (price <= 0) {
    return {
      approved: false,
      recommendedNotional: 0,
      maxPermittedNotional: 0,
      recommendedUnits: 0,
      sizingFractionOfEquity: 0,
      sizingFractionOfCash: 0,
      convictionMultiplier: 0,
      qualityMultiplier: 0,
      riskDragMultiplier: 0,
      portfolioDragMultiplier: 0,
      explanation: ["Invalid market price — allocator cannot size units."],
      warnings: [],
      metadata: {
        baseFraction: 0,
        effectiveFraction: 0,
        normalizedWalletScore: normalizeWalletScore(input.wallet.walletScore),
        normalizedVolatility: clamp(safeNumber(input.market.volatilityScore, 0.5), 0, 1),
        normalizedLiquidity: clamp(safeNumber(input.market.liquidityScore, 0.5), 0, 1),
        normalizedPortfolioHeat: clamp(
          safeNumber(input.portfolio.currentPortfolioHeat, 0),
          0,
          1,
        ),
      },
    };
  }

  const baseFraction = DEFAULTS.baseFractionOfEquity;

  const qualityMultiplier = inferQualityMultiplier(input.wallet);
  const convictionMultiplier = inferConvictionMultiplier(input.wallet, input.copyability);
  const riskDrag = inferRiskDragMultiplier(input.market, input.priorRiskDecision);
  const portfolioDrag = inferPortfolioDragMultiplier(input.portfolio);

  warnings.push(...riskDrag.warnings, ...portfolioDrag.warnings);

  let effectiveFraction =
    baseFraction *
    qualityMultiplier *
    convictionMultiplier *
    riskDrag.multiplier *
    portfolioDrag.multiplier;

  effectiveFraction = clamp(
    effectiveFraction,
    DEFAULTS.minFractionOfEquity,
    DEFAULTS.maxFractionOfEquity,
  );

  const rawRecommendedNotional = totalEquity * effectiveFraction;

  const cashCap = availableCash * DEFAULTS.maxFractionOfCash;
  const exposureCap = computeExposureCap(input.portfolio, totalEquity);
  const hardCap = Math.max(0, Math.min(cashCap, exposureCap || cashCap));

  if (hardCap <= 0) {
    return {
      approved: false,
      recommendedNotional: 0,
      maxPermittedNotional: 0,
      recommendedUnits: 0,
      sizingFractionOfEquity: 0,
      sizingFractionOfCash: 0,
      convictionMultiplier,
      qualityMultiplier,
      riskDragMultiplier: riskDrag.multiplier,
      portfolioDragMultiplier: portfolioDrag.multiplier,
      explanation: [
        "Exposure caps prevent opening additional size on this symbol or directional side.",
      ],
      warnings,
      metadata: {
        baseFraction,
        effectiveFraction: 0,
        normalizedWalletScore: normalizeWalletScore(input.wallet.walletScore),
        normalizedVolatility: riskDrag.normalizedVolatility,
        normalizedLiquidity: riskDrag.normalizedLiquidity,
        normalizedPortfolioHeat: portfolioDrag.normalizedPortfolioHeat,
      },
    };
  }

  const finalRecommendedNotional = clamp(rawRecommendedNotional, 0, hardCap);
  const recommendedUnits = finalRecommendedNotional / price;

  if (finalRecommendedNotional <= 0 || recommendedUnits <= 0) {
    return {
      approved: false,
      recommendedNotional: 0,
      maxPermittedNotional: hardCap,
      recommendedUnits: 0,
      sizingFractionOfEquity: 0,
      sizingFractionOfCash: 0,
      convictionMultiplier,
      qualityMultiplier,
      riskDragMultiplier: riskDrag.multiplier,
      portfolioDragMultiplier: portfolioDrag.multiplier,
      explanation: ["Allocator computed zero viable position size."],
      warnings,
      metadata: {
        baseFraction,
        effectiveFraction: 0,
        normalizedWalletScore: normalizeWalletScore(input.wallet.walletScore),
        normalizedVolatility: riskDrag.normalizedVolatility,
        normalizedLiquidity: riskDrag.normalizedLiquidity,
        normalizedPortfolioHeat: portfolioDrag.normalizedPortfolioHeat,
      },
    };
  }

  explanation.push(
    `Base sizing started at ${(baseFraction * 100).toFixed(2)}% of equity.`,
    `Wallet quality multiplier applied: ${qualityMultiplier.toFixed(2)}x.`,
    `Signal conviction multiplier applied: ${convictionMultiplier.toFixed(2)}x.`,
    `Market/risk drag multiplier applied: ${riskDrag.multiplier.toFixed(2)}x.`,
    `Portfolio drag multiplier applied: ${portfolioDrag.multiplier.toFixed(2)}x.`,
  );

  if (finalRecommendedNotional < rawRecommendedNotional) {
    explanation.push("Final size was capped by cash availability or exposure limits.");
  }

  return {
    approved: true,
    recommendedNotional: Number(finalRecommendedNotional.toFixed(2)),
    maxPermittedNotional: Number(hardCap.toFixed(2)),
    recommendedUnits: Number(recommendedUnits.toFixed(8)),
    sizingFractionOfEquity: Number((finalRecommendedNotional / totalEquity).toFixed(6)),
    sizingFractionOfCash: Number((finalRecommendedNotional / availableCash).toFixed(6)),
    convictionMultiplier,
    qualityMultiplier,
    riskDragMultiplier: riskDrag.multiplier,
    portfolioDragMultiplier: portfolioDrag.multiplier,
    explanation,
    warnings,
    metadata: {
      baseFraction,
      effectiveFraction: Number(effectiveFraction.toFixed(6)),
      normalizedWalletScore: normalizeWalletScore(input.wallet.walletScore),
      normalizedVolatility: riskDrag.normalizedVolatility,
      normalizedLiquidity: riskDrag.normalizedLiquidity,
      normalizedPortfolioHeat: portfolioDrag.normalizedPortfolioHeat,
    },
  };
}

export default allocateCapitalV2;
