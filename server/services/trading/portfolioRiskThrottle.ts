import type { PortfolioState } from "./portfolioState";

export interface ThrottleResult {
  sizeMultiplier: number;
  blockNewTrades: boolean;
  blockReason: string | null;
  throttleLevel: "normal" | "cautious" | "elevated" | "critical";
  flags: string[];
}

interface ThrottleConfig {
  drawdownCautionThreshold: number;
  drawdownElevatedThreshold: number;
  drawdownCriticalThreshold: number;
  cautiousSizeMultiplier: number;
  elevatedSizeMultiplier: number;
  maxConsecutiveClusterLosses: number;
  maxGrossExposurePct: number;
}

const DEFAULT_THROTTLE_CONFIG: ThrottleConfig = {
  drawdownCautionThreshold: 5,
  drawdownElevatedThreshold: 10,
  drawdownCriticalThreshold: 15,
  cautiousSizeMultiplier: 0.7,
  elevatedSizeMultiplier: 0.4,
  maxConsecutiveClusterLosses: 3,
  maxGrossExposurePct: 80,
};

export function evaluateRiskThrottle(
  portfolioState: PortfolioState,
  recentClusterLosses: Record<string, number> = {},
  config: Partial<ThrottleConfig> = {},
): ThrottleResult {
  const cfg = { ...DEFAULT_THROTTLE_CONFIG, ...config };
  const flags: string[] = [];
  let sizeMultiplier = 1.0;
  let blockNewTrades = false;
  let blockReason: string | null = null;
  let throttleLevel: ThrottleResult["throttleLevel"] = "normal";

  const dd = portfolioState.drawdownState.currentDrawdown;

  if (dd >= cfg.drawdownCriticalThreshold) {
    throttleLevel = "critical";
    blockNewTrades = true;
    blockReason = `drawdown ${dd.toFixed(1)}% exceeds critical threshold ${cfg.drawdownCriticalThreshold}%`;
    flags.push("drawdown_critical");
  } else if (dd >= cfg.drawdownElevatedThreshold) {
    throttleLevel = "elevated";
    sizeMultiplier = cfg.elevatedSizeMultiplier;
    flags.push("drawdown_elevated");
  } else if (dd >= cfg.drawdownCautionThreshold) {
    throttleLevel = "cautious";
    sizeMultiplier = cfg.cautiousSizeMultiplier;
    flags.push("drawdown_cautious");
  }

  const grossExposurePct = portfolioState.totalEquity > 0
    ? (portfolioState.grossExposure / portfolioState.totalEquity) * 100
    : 0;
  if (grossExposurePct >= cfg.maxGrossExposurePct) {
    blockNewTrades = true;
    blockReason = blockReason || `gross exposure ${grossExposurePct.toFixed(1)}% exceeds ${cfg.maxGrossExposurePct}%`;
    flags.push("gross_exposure_limit");
  }

  for (const [cluster, losses] of Object.entries(recentClusterLosses)) {
    if (losses >= cfg.maxConsecutiveClusterLosses) {
      flags.push(`cluster_${cluster}_consecutive_losses`);
      sizeMultiplier = Math.min(sizeMultiplier, 0.5);
    }
  }

  return { sizeMultiplier, blockNewTrades, blockReason, throttleLevel, flags };
}
