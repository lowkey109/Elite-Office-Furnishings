import type { TradingMonitorResponse, TradingMonitorState } from "./types";
import { buildStrategies } from "./strategies";
import { buildMarketContext } from "./marketContext";
import { buildNews } from "./news";
import { buildDecisions } from "./decisions";
import { buildPositions } from "./positions";
import { buildOutcomes } from "./outcomes";
import { buildPerformance } from "./performance";

export type { TradingMonitorResponse } from "./types";

let cachedData: TradingMonitorResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000;

export function getTradingMonitorData(): TradingMonitorResponse {
  const now = Date.now();
  if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedData;
  }

  const decisions = buildDecisions();
  const positions = buildPositions();
  const outcomes = buildOutcomes();
  const performance = buildPerformance(outcomes);
  const news = buildNews();
  const marketContext = buildMarketContext();
  const strategies = buildStrategies();

  const wins = outcomes.filter(o => o.outcome === "win").length;
  const winRate = outcomes.length > 0 ? Math.round((wins / outcomes.length) * 100) : 0;

  const bestStrategyCounts: Record<string, number> = {};
  for (const o of outcomes.filter(oo => oo.outcome === "win")) {
    bestStrategyCounts[o.strategy] = (bestStrategyCounts[o.strategy] || 0) + 1;
  }
  const bestStrategy = Object.entries(bestStrategyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  const state: TradingMonitorState = {
    mode: "paper",
    currentRegime: "trending",
    lastDecisionTime: decisions[0]?.timestamp || "",
    totalTrades: outcomes.length,
    winRate,
    currentDrawdown: performance.maxDrawdown,
    openPositionsCount: positions.length,
    bestStrategy: bestStrategy.replace(/_/g, " "),
    dataQualityScore: 0.94,
  };

  cachedData = {
    state,
    decisions,
    positions,
    recent_outcomes: outcomes,
    performance,
    news,
    marketContext,
    strategies,
    dataMode: "simulation",
    lastRefreshed: new Date().toISOString(),
  };
  cacheTimestamp = now;

  return cachedData;
}
