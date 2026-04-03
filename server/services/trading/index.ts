import type { TradingMonitorResponse } from "./types";
import { buildStrategies } from "./strategies";
import { buildMarketContext } from "./marketContext";
import { buildNews } from "./news";
import {
  getMonitorState,
  getRecentDecisions,
  getOpenPositions,
  getRecentOutcomes,
  calculatePerformanceFromDB,
} from "./paperEngine";

export type { TradingMonitorResponse } from "./types";

export {
  createDecision,
  openPaperPosition,
  closePaperPosition,
  evaluateOpenPositions,
  updatePositionPrice,
  getOrCreateState,
} from "./paperEngine";

let strategiesCache: ReturnType<typeof buildStrategies> | null = null;
let strategiesCacheTime = 0;
const STRATEGIES_TTL = 60000;

export async function getTradingMonitorData(): Promise<TradingMonitorResponse> {
  const now = Date.now();

  if (!strategiesCache || (now - strategiesCacheTime) > STRATEGIES_TTL) {
    strategiesCache = buildStrategies();
    strategiesCacheTime = now;
  }

  const [state, decisions, positions, outcomes, performance] = await Promise.all([
    getMonitorState(),
    getRecentDecisions(30),
    getOpenPositions(),
    getRecentOutcomes(50),
    calculatePerformanceFromDB(),
  ]);

  const marketContext = buildMarketContext();
  const news = buildNews();

  return {
    state,
    decisions,
    positions,
    recent_outcomes: outcomes,
    performance,
    news,
    marketContext,
    strategies: strategiesCache,
    dataMode: "paper",
    lastRefreshed: new Date().toISOString(),
  };
}
