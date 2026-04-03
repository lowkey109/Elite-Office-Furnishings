export interface ExecutionQualityResult {
  score: number;
  label: "excellent" | "good" | "acceptable" | "poor" | "failed";
}

export function scoreExecutionQuality(params: {
  entrySlippage: number;
  exitSlippage: number;
  totalSlippage: number;
  entryPrice: number;
  exitPrice: number;
  expectedSlippage: number;
}): ExecutionQualityResult {
  const { entrySlippage, exitSlippage, totalSlippage, entryPrice, expectedSlippage } = params;

  let score = 100;

  const slippagePct = entryPrice > 0 ? (totalSlippage / entryPrice) * 100 : 0;

  if (slippagePct > 1.0) score -= 40;
  else if (slippagePct > 0.5) score -= 25;
  else if (slippagePct > 0.2) score -= 12;
  else if (slippagePct > 0.1) score -= 5;

  const slippageRatio = expectedSlippage > 0 ? totalSlippage / expectedSlippage : 1;
  if (slippageRatio > 3) score -= 30;
  else if (slippageRatio > 2) score -= 15;
  else if (slippageRatio > 1.5) score -= 8;

  if (exitSlippage > entrySlippage * 2) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let label: ExecutionQualityResult["label"];
  if (score >= 90) label = "excellent";
  else if (score >= 75) label = "good";
  else if (score >= 55) label = "acceptable";
  else if (score >= 30) label = "poor";
  else label = "failed";

  return { score, label };
}
