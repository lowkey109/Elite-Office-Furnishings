export type NexoraFeedMarket = {
  marketId: string;
  title: string;
  category: string;
  marketProbability: number;
  modelProbability: number;
  liquidityUsd: number;
  spreadPct: number;
  volumeUsd24h: number;
  source: string;
  resolutionRules: string;
  correlatedEventKey: string;
};

type WeightedFeed = {
  source: string;
  probability: number;
  reliability: number;
  confidence: number;
  weight: number;
};

function n(v: any, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function normalizeNexoraExternalMarkets(input: any = {}) {
  const rows = Array.isArray(input.markets) ? input.markets : [];

  const markets: NexoraFeedMarket[] = rows.map((m: any, i: number): NexoraFeedMarket => {
    const marketProbability = n(m.marketProbability ?? m.price ?? m.yesPrice ?? m.probability, 0.5);
    const modelProbability = n(m.modelProbability ?? m.fairProbability ?? m.externalProbability, marketProbability);

    return {
      marketId: String(m.marketId || m.id || `external_${i}`),
      title: String(m.title || m.question || "Untitled market"),
      category: String(m.category || m.type || "general"),
      marketProbability,
      modelProbability,
      liquidityUsd: n(m.liquidityUsd ?? m.liquidity, 0),
      spreadPct: n(m.spreadPct ?? m.spread, 100),
      volumeUsd24h: n(m.volumeUsd24h ?? m.volume24h, 0),
      source: String(m.source || "manual_feed"),
      resolutionRules: String(m.resolutionRules || m.rules || "Resolution rules not supplied."),
      correlatedEventKey: String(m.correlatedEventKey || m.eventKey || m.marketId || m.id || `event_${i}`),
    };
  });

  return {
    ok: true,
    service: "nexora_feed_normalizer",
    paperOnly: true,
    count: markets.length,
    markets,
    supportedFeeds: ["prediction_markets", "sports_odds", "news_sentiment", "polls", "crypto", "macro", "manual_json"],
    updatedAt: new Date().toISOString(),
  };
}

export function combineNexoraFeedProbabilities(input: any = {}) {
  const feeds = Array.isArray(input.feeds) ? input.feeds : [];

  const weighted: WeightedFeed[] = feeds.map((f: any): WeightedFeed => ({
    source: String(f.source || "unknown"),
    probability: n(f.probability, 0.5),
    reliability: Math.max(0, Math.min(1, n(f.reliability, 0.5))),
    confidence: Math.max(0, Math.min(1, n(f.confidence, 0.5))),
    weight: Math.max(0, n(f.weight, 1)),
  }));

  const totalWeight = weighted.reduce(
    (sum: number, feed: WeightedFeed) => sum + feed.reliability * feed.confidence * feed.weight,
    0
  );

  const fairProbability =
    totalWeight > 0
      ? weighted.reduce(
          (sum: number, feed: WeightedFeed) =>
            sum + feed.probability * feed.reliability * feed.confidence * feed.weight,
          0
        ) / totalWeight
      : 0.5;

  return {
    ok: true,
    service: "nexora_feed_probability_combiner",
    paperOnly: true,
    fairProbability: Math.round(fairProbability * 10000) / 10000,
    fairProbabilityPct: Math.round(fairProbability * 10000) / 100,
    feedCount: weighted.length,
    feeds: weighted,
    rule: "Combine external feed probabilities by reliability, confidence and source weight.",
    updatedAt: new Date().toISOString(),
  };
}

export function getNexoraFeedConnectorStatus() {
  return {
    ok: true,
    service: "nexora_feed_connectors",
    paperOnly: true,
    liveExternalFetching: false,
    status: "Feed connector normalization layer ready. Real API keys/connectors can be added next.",
    connectors: {
      polymarketStyle: "manual/import-ready",
      odds: "manual/import-ready",
      news: "manual/import-ready",
      polls: "manual/import-ready",
      sports: "manual/import-ready",
      crypto: "manual/import-ready",
      macro: "manual/import-ready",
    },
    updatedAt: new Date().toISOString(),
  };
}
