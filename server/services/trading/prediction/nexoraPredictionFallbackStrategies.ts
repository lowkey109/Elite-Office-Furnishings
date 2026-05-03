import { scorePredictionMarketEdge } from "./nexoraPredictionMarketEdge";

type Market = {
  marketId?: string;
  title?: string;
  category?: string;
  marketProbability?: number;
  modelProbability?: number;
  liquidityUsd?: number;
  spreadPct?: number;
  volumeUsd24h?: number;
  newsVelocity?: number;
  priceMovePct?: number;
  modelMovePct?: number;
  catalystSoon?: boolean;
  catalystName?: string;
  correlatedEventKey?: string;
  resolutionClear?: boolean;
};

function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function scoreFallback(market: Market, bankrollUsd: number, exposureByEvent: Record<string, number>) {
  const edge = scorePredictionMarketEdge({
    marketId: market.marketId,
    title: market.title,
    marketProbability: n(market.marketProbability),
    modelProbability: n(market.modelProbability),
    liquidityUsd: n(market.liquidityUsd),
    spreadPct: n(market.spreadPct, 100),
    category: market.category,
    bankrollUsd,
    resolutionClear: market.resolutionClear !== false,
  });

  const liquidityUsd = n(market.liquidityUsd);
  const spreadPct = n(market.spreadPct, 100);
  const volumeUsd24h = n(market.volumeUsd24h);
  const priceMovePct = n(market.priceMovePct);
  const modelMovePct = n(market.modelMovePct);
  const newsVelocity = n(market.newsVelocity);
  const eventKey = market.correlatedEventKey || market.marketId || market.title || "unknown";
  const eventExposure = n(exposureByEvent[eventKey]);

  const fallbackCandidates = [
    {
      name: "mispricing_value_edge",
      rank: 1,
      approved: edge.approved,
      reason: edge.approved ? "Model-market probability gap is strong enough." : edge.blockedReasons.join(" "),
      action: edge.recommendedAction,
      direction: edge.direction,
      score: Math.abs(edge.edgePct),
    },
    {
      name: "arbitrage_cross_market_difference",
      rank: 2,
      approved: Math.abs(edge.edgePct) >= 10 && liquidityUsd >= 1000 && spreadPct <= 4 && market.resolutionClear !== false,
      reason: "Use when external odds/news/polls imply a materially different fair probability.",
      action: edge.edgePct > 0 ? "BUY_YES_LIMIT" : "BUY_NO_LIMIT",
      direction: edge.direction,
      score: Math.abs(edge.edgePct) + 2,
    },
    {
      name: "market_making_spread_capture",
      rank: 3,
      approved: Math.abs(edge.edgePct) < 7 && liquidityUsd >= 2500 && spreadPct >= 1 && spreadPct <= 5 && market.resolutionClear !== false,
      reason: "No strong directional edge; provide limit orders around fair value to capture spread.",
      action: "LIMIT_MAKE_AROUND_FAIR_VALUE",
      direction: "NEUTRAL_MARKET_MAKE",
      score: Math.max(0, 7 - Math.abs(edge.edgePct)) + spreadPct,
    },
    {
      name: "momentum_repricing",
      rank: 4,
      approved: Math.abs(priceMovePct) >= 5 && newsVelocity >= 60 && volumeUsd24h >= 1000 && spreadPct <= 4 && market.resolutionClear !== false,
      reason: "News-driven repricing with volume confirmation.",
      action: priceMovePct > 0 ? "BUY_YES_LIMIT_WITH_MOMENTUM" : "BUY_NO_LIMIT_WITH_MOMENTUM",
      direction: priceMovePct > 0 ? "BUY_YES" : "BUY_NO",
      score: Math.abs(priceMovePct) + newsVelocity / 20,
    },
    {
      name: "mean_reversion_overreaction",
      rank: 5,
      approved: Math.abs(priceMovePct) >= 8 && Math.abs(modelMovePct) <= 2 && liquidityUsd >= 1000 && spreadPct <= 4 && market.resolutionClear !== false,
      reason: "Market moved sharply but fair model value did not move enough.",
      action: priceMovePct > 0 ? "FADE_YES_BUY_NO_LIMIT" : "FADE_NO_BUY_YES_LIMIT",
      direction: priceMovePct > 0 ? "BUY_NO" : "BUY_YES",
      score: Math.abs(priceMovePct) - Math.abs(modelMovePct),
    },
    {
      name: "event_catalyst_strategy",
      rank: 6,
      approved: Boolean(market.catalystSoon) && liquidityUsd >= 1000 && spreadPct <= 4 && market.resolutionClear !== false,
      reason: `Known catalyst approaching${market.catalystName ? `: ${market.catalystName}` : ""}.`,
      action: "WAIT_FOR_CATALYST_REPRICE_OR_LIMIT_ENTRY",
      direction: "CATALYST_WATCH",
      score: 6,
    },
    {
      name: "liquidity_provider_mode",
      rank: 7,
      approved: liquidityUsd >= 5000 && spreadPct >= 1.5 && spreadPct <= 6 && market.resolutionClear !== false,
      reason: "Confidence is low but liquidity/spread supports passive limit-order liquidity provision.",
      action: "PASSIVE_LIMIT_ONLY",
      direction: "NEUTRAL_LIQUIDITY_PROVIDER",
      score: liquidityUsd / 1000 + spreadPct,
    },
    {
      name: "risk_off_monitor_mode",
      rank: 8,
      approved: true,
      reason: "Fallback safety mode. Observe only when edge, liquidity, spread, resolution, or DB safety is not proven.",
      action: "MONITOR_ONLY",
      direction: "NO_TRADE",
      score: 0,
    },
  ];

  const correlationBlocked = eventExposure >= 0.15;
  const selected = fallbackCandidates.find((x) => x.approved && (!correlationBlocked || x.name === "risk_off_monitor_mode")) || fallbackCandidates[fallbackCandidates.length - 1];

  return {
    marketId: market.marketId,
    title: market.title,
    category: market.category || "unknown",
    correlatedEventKey: eventKey,
    correlationBlocked,
    eventExposure,
    selected,
    edge,
    fallbackCandidates,
    finalApproved: selected.name !== "risk_off_monitor_mode" && !correlationBlocked,
    finalAction: correlationBlocked ? "MONITOR_ONLY_CORRELATION_BLOCKED" : selected.action,
    rule: "If Nexora cannot prove edge, liquidity, spread, clear resolution, and acceptable correlation exposure, she does not trade.",
  };
}

export async function runNexoraPredictionFallbackStack(input: any = {}) {
  const markets: Market[] = Array.isArray(input.markets) ? input.markets : [];
  const bankrollUsd = n(input.bankrollUsd, 1000);
  const exposureByEvent = input.exposureByEvent && typeof input.exposureByEvent === "object" ? input.exposureByEvent : {};

  const scored = markets.map((m) => scoreFallback(m, bankrollUsd, exposureByEvent));
  const approved = scored.filter((x) => x.finalApproved);

  return {
    ok: true,
    service: "nexora_prediction_fallback_stack",
    paperOnly: true,
    primaryStrategy: "mispricing_value_edge",
    fallbackOrder: [
      "mispricing_value_edge",
      "arbitrage_cross_market_difference",
      "market_making_spread_capture",
      "momentum_repricing",
      "mean_reversion_overreaction",
      "event_catalyst_strategy",
      "liquidity_provider_mode",
      "risk_off_monitor_mode",
    ],
    hardRule: "If Nexora cannot prove edge, liquidity, spread, clear resolution, and acceptable correlation exposure, she does not trade.",
    scoredCount: scored.length,
    approvedCount: approved.length,
    approved,
    scored,
    updatedAt: new Date().toISOString(),
  };
}
