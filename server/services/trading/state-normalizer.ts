
import type { TradingSystemState } from "./types/trading-types";

export function normalizeTradingState(
  raw: Partial<TradingSystemState> | null | undefined,
): TradingSystemState {
  const paperCapital = raw?.paperCapital ?? 0;
  const currentCapital = raw?.currentCapital ?? paperCapital;
  const peakCapital = raw?.peakCapital ?? currentCapital;
  const totalPnl = raw?.totalPnl ?? currentCapital - paperCapital;

  return {
    id: raw?.id ?? "singleton",
    paperCapital,
    currentCapital,
    peakCapital,
    totalPnl,
    totalDecisions: raw?.totalDecisions ?? 0,
    totalTrades: raw?.totalTrades ?? 0,
    isRunning: raw?.isRunning ?? false,
    lastDecisionAt: raw?.lastDecisionAt ?? null,
    lastMonitorAt: raw?.lastMonitorAt ?? null,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
  };
}
