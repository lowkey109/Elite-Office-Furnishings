import { scorePredictionMarketEdge } from "./nexoraPredictionMarketEdge";

export async function runNexoraPredictionStrategyPolicy(input: any = {}) {
  const markets = Array.isArray(input.markets) ? input.markets : [];

  const scored = markets.map((market: any) =>
    scorePredictionMarketEdge({
      marketId: market.marketId,
      title: market.title,
      marketProbability: Number(market.marketProbability || market.price || 0),
      modelProbability: Number(market.modelProbability || market.fairProbability || 0),
      liquidityUsd: Number(market.liquidityUsd || market.liquidity || 0),
      spreadPct: Number(market.spreadPct || market.spread || 100),
      category: market.category,
      bankrollUsd: Number(input.bankrollUsd || market.bankrollUsd || 1000),
      resolutionClear: market.resolutionClear !== false,
    })
  );

  const approved = scored
    .filter((x: any) => x.approved)
    .sort((a: any, b: any) => Math.abs(b.edgePct) - Math.abs(a.edgePct));

  return {
    ok: true,
    service: "nexora_prediction_strategy_policy",
    paperOnly: true,
    mode: "Nexora will use market-making + mispricing detection as the primary prediction-market strategy.",
    strategyUse: {
      primary: "Find wrong prices, not emotional winners.",
      tradeOnlyWhen: "modelProbability - marketProbability >= 7%, liquidity is strong, spread is tight, and resolution rules are clear.",
      execution: "LIMIT_ONLY",
      risk: "1–3% bankroll per market, 10–15% max category exposure.",
      exit: "Exit before resolution when edge compresses or market price moves toward model value.",
    },
    scoredCount: scored.length,
    approvedCount: approved.length,
    approved,
    scored,
    integratedWithExistingNexoraSystems: [
      "paper-only execution",
      "learning pressure",
      "aggressive probe seeding",
      "outcome booster",
      "bad probe demoter",
      "candidate allowlist",
      "DB safety guard",
      "trade journal / paper outcomes",
      "risk manager",
    ],
    nextRequiredBuild:
      "Wire approved prediction-market signals into the paper trade journal and learning loop.",
    updatedAt: new Date().toISOString(),
  };
}
