export type PredictionMarketInput = {
  marketId?: string;
  title?: string;
  marketProbability: number;
  modelProbability: number;
  liquidityUsd?: number;
  spreadPct?: number;
  category?: string;
  bankrollUsd?: number;
  resolutionClear?: boolean;
};

export function scorePredictionMarketEdge(input: PredictionMarketInput) {
  const marketProbability = Number(input.marketProbability || 0);
  const modelProbability = Number(input.modelProbability || 0);
  const liquidityUsd = Number(input.liquidityUsd || 0);
  const spreadPct = Number(input.spreadPct || 100);
  const bankrollUsd = Number(input.bankrollUsd || 1000);
  const resolutionClear = input.resolutionClear !== false;

  const edgePct = Math.round((modelProbability - marketProbability) * 10000) / 100;
  const absEdge = Math.abs(edgePct);

  const liquid = liquidityUsd >= 1000;
  const tightSpread = spreadPct <= 3;
  const edgeStrong = absEdge >= 7;
  const direction =
    edgePct >= 7 ? "BUY_YES" :
    edgePct <= -7 ? "BUY_NO" :
    "NO_TRADE";

  const riskPct =
    absEdge >= 15 ? 0.03 :
    absEdge >= 10 ? 0.02 :
    absEdge >= 7 ? 0.01 :
    0;

  const positionUsd = Math.max(0, Math.round(bankrollUsd * riskPct * 100) / 100);

  const blockedReasons: string[] = [];
  if (!edgeStrong) blockedReasons.push("Edge below 7% minimum.");
  if (!liquid) blockedReasons.push("Liquidity below minimum.");
  if (!tightSpread) blockedReasons.push("Spread too wide.");
  if (!resolutionClear) blockedReasons.push("Resolution rules unclear.");

  const approved = blockedReasons.length === 0 && direction !== "NO_TRADE";

  return {
    ok: true,
    service: "nexora_prediction_market_edge",
    paperOnly: true,
    strategy: "market_making_plus_mispricing_detection",
    input,
    marketProbability,
    modelProbability,
    edgePct,
    direction,
    approved,
    orderType: approved ? "LIMIT_ONLY" : "NONE",
    recommendedAction: approved
      ? `${direction} with limit order; avoid market order.`
      : "NO_TRADE",
    risk: {
      bankrollUsd,
      riskPct,
      positionUsd,
      maxSingleMarketRiskPct: 3,
      maxCategoryExposurePct: 15,
    },
    filters: {
      edgeStrong,
      liquid,
      tightSpread,
      resolutionClear,
      minEdgePct: 7,
      minLiquidityUsd: 1000,
      maxSpreadPct: 3,
    },
    blockedReasons,
    exitRule: "Exit before resolution when market price moves toward model value or edge compresses below 2%.",
    updatedAt: new Date().toISOString(),
  };
}

export function explainPredictionMarketStrategy() {
  return {
    ok: true,
    service: "nexora_prediction_market_strategy",
    paperOnly: true,
    name: "Market-making + mispricing detection",
    thesis: "Do not guess winners. Find wrong prices.",
    pipeline: [
      "Data feeds",
      "Fair probability model",
      "Edge detector",
      "Liquidity filter",
      "Spread filter",
      "Limit-order execution",
      "Risk manager",
      "Trade journal",
      "Learning loop",
    ],
    tradeRule:
      "Trade only when model probability minus market probability is at least 7%, liquidity is strong, spread is tight, and resolution rules are clear.",
    riskRules: {
      singleMarketRisk: "1–3% bankroll",
      categoryExposure: "10–15% maximum",
      execution: "Limit orders only",
      avoid: ["wide spreads", "low volume", "unclear resolution rules", "tiny edges"],
    },
    updatedAt: new Date().toISOString(),
  };
}
