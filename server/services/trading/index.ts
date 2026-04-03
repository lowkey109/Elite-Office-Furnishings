import type { TradingMonitorResponse } from "./types";
import { buildStrategies } from "./strategies";
import { buildMarketContext } from "./marketContext";
import { fetchRealNews, getNewsAdapterStatus } from "./newsAdapter";
import {
  getMonitorState,
  getRecentDecisions,
  getOpenPositions,
  getRecentOutcomes,
  calculatePerformanceFromDB,
} from "./paperEngine";
import { startMarketLoop, getMarketLoopStatus } from "./marketLoop";
import { getSupportedSymbols, getUnavailableSymbols } from "./marketDataAdapter";

export type { TradingMonitorResponse } from "./types";

export {
  createDecision,
  openPaperPosition,
  closePaperPosition,
  evaluateOpenPositions,
  updatePositionPrice,
  getOrCreateState,
} from "./paperEngine";

export { startMarketLoop, stopMarketLoop, getMarketLoopStatus } from "./marketLoop";

let strategiesCache: ReturnType<typeof buildStrategies> | null = null;
let strategiesCacheTime = 0;
const STRATEGIES_TTL = 60000;

let marketLoopStarted = false;

export async function getTradingMonitorData(): Promise<TradingMonitorResponse> {
  if (!marketLoopStarted) {
    startMarketLoop();
    marketLoopStarted = true;
  }

  const now = Date.now();

  if (!strategiesCache || (now - strategiesCacheTime) > STRATEGIES_TTL) {
    strategiesCache = buildStrategies();
    strategiesCacheTime = now;
  }

  const [state, decisions, positions, outcomes, performance, marketContext, newsResult] = await Promise.all([
    getMonitorState(),
    getRecentDecisions(30),
    getOpenPositions(),
    getRecentOutcomes(50),
    calculatePerformanceFromDB(),
    buildMarketContext(),
    fetchRealNews(),
  ]);

  const loopStatus = getMarketLoopStatus();
  const newsStatus = getNewsAdapterStatus();

  return {
    state,
    decisions,
    positions,
    recent_outcomes: outcomes,
    performance,
    news: newsResult.items,
    marketContext,
    strategies: strategiesCache,
    dataMode: "paper",
    lastRefreshed: new Date().toISOString(),
    feedStatus: {
      loopRunning: loopStatus.isRunning,
      lastFastCycle: loopStatus.lastFastCycleAt,
      lastDetailedCycle: loopStatus.lastDetailedCycleAt,
      cycleErrors: loopStatus.cycleErrors,
      liveSymbols: getSupportedSymbols(),
      unavailableSymbols: getUnavailableSymbols(),
    },
    newsStatus,
  };
}
