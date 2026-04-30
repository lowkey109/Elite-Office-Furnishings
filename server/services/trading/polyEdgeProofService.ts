import { getTradingMonitorData } from "./index";
import { getRecentAttemptLogs, getRecentLiveOrders, getLivePositionsSummary } from "./liveExecutionGateway";
import { getNexoraLoopState } from "../nexoraLoop";
import { getAutonomyRuntimeStatus } from "../ops/autonomyRunbook";

type PolyEdgeMode = "admin" | "client";

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(value: number): number {
  return Math.round(value * 100) / 100;
}

function getPnl(row: any): number {
  return n(
    row?.realizedPnl ??
    row?.pnl ??
    row?.profitLoss ??
    row?.netPnl ??
    row?.capitalReturned - row?.paperCapitalAllocated
  );
}

function calculateMaxDrawdown(pnls: number[]): number {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const pnl of pnls) {
    equity += pnl;
    peak = Math.max(peak, equity);
    const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  return pct(maxDrawdown);
}

function calculateProof(outcomes: any[]) {
  const closed = Array.isArray(outcomes) ? outcomes : [];
  const pnls = closed.map(getPnl);
  const totalTrades = closed.length;
  const wins = pnls.filter((p) => p > 0).length;
  const losses = pnls.filter((p) => p < 0).length;
  const flats = totalTrades - wins - losses;

  const grossProfit = pnls.filter((p) => p > 0).reduce((s, v) => s + v, 0);
  const grossLossAbs = Math.abs(pnls.filter((p) => p < 0).reduce((s, v) => s + v, 0));

  const totalPnl = pnls.reduce((s, v) => s + v, 0);
  const avgPnl = totalTrades ? totalPnl / totalTrades : 0;
  const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
  const profitFactor = grossLossAbs > 0 ? grossProfit / grossLossAbs : grossProfit > 0 ? 999 : 0;
  const expectancy = avgPnl;
  const maxDrawdownPct = calculateMaxDrawdown(pnls);

  const readiness =
    totalTrades < 20 ? "learning" :
    winRate >= 55 && profitFactor >= 1.25 && maxDrawdownPct <= 15 ? "stable" :
    winRate >= 45 && profitFactor >= 1 ? "review_required" :
    "not_ready_for_live";

  const proofPassed =
    totalTrades >= 20 &&
    winRate >= 55 &&
    profitFactor >= 1.25 &&
    maxDrawdownPct <= 15 &&
    totalPnl > 0;

  return {
    totalTrades,
    wins,
    losses,
    flats,
    winRate: pct(winRate),
    grossProfit: pct(grossProfit),
    grossLossAbs: pct(grossLossAbs),
    totalPnl: pct(totalPnl),
    avgPnl: pct(avgPnl),
    expectancy: pct(expectancy),
    profitFactor: pct(profitFactor),
    maxDrawdownPct,
    proofPassed,
    readiness,
    proofRules: {
      minimumTrades: 20,
      minimumWinRate: 55,
      minimumProfitFactor: 1.25,
      maximumDrawdownPct: 15,
      mustBeNetProfitable: true,
    },
  };
}

function buildCustomerSafeMonitor(monitor: any) {
  return {
    state: monitor?.state ?? null,
    performance: monitor?.performance ?? null,
    positions: Array.isArray(monitor?.positions) ? monitor.positions.slice(0, 20) : [],
    recent_outcomes: Array.isArray(monitor?.recent_outcomes) ? monitor.recent_outcomes.slice(0, 50) : [],
    marketContext: monitor?.marketContext ?? null,
    feedStatus: monitor?.feedStatus ?? null,
    dataMode: "paper",
  };
}

export async function getPolyEdgeProof(mode: PolyEdgeMode = "client") {
  const [monitor, attempts, liveOrders, livePositions] = await Promise.all([
    getTradingMonitorData(),
    mode === "admin" ? getRecentAttemptLogs(30).catch(() => []) : Promise.resolve([]),
    mode === "admin" ? getRecentLiveOrders(20).catch(() => []) : Promise.resolve([]),
    mode === "admin" ? getLivePositionsSummary().catch(() => []) : Promise.resolve([]),
  ]);

  const outcomes = Array.isArray((monitor as any)?.recent_outcomes)
    ? (monitor as any).recent_outcomes
    : [];

  const proof = calculateProof(outcomes);
  const runtime = getAutonomyRuntimeStatus();
  const nexoraLoop = getNexoraLoopState();

  const liveTradingAllowed = false;

  return {
    ok: true,
    product: "polyedge_aetherforge",
    generatedAt: new Date().toISOString(),
    mode,
    tradingMode: "paper",
    liveTradingAllowed,
    customerDisclaimer:
      "PolyEdge/Aetherforge is paper-trading intelligence only. It is not financial advice and does not execute live customer trades.",
    nexora: {
      executionAuthority: "nexora",
      workerMode: nexoraLoop.workerMode,
      loopEnabled: nexoraLoop.enabled,
      running: nexoraLoop.running,
      lastRunAt: nexoraLoop.lastRunAt,
      gateRequired: true,
    },
    runtime: {
      safeMode: runtime.safeMode,
      realOutreachEnabled: runtime.realOutreachEnabled,
      phantomXLivePreauthorised: runtime.phantomXLivePreauthorised,
      emergencyStop: runtime.emergencyStop,
      outboundKillSwitch: runtime.outboundKillSwitch,
      liveTradingKillSwitch: runtime.liveTradingKillSwitch,
    },
    proof,
    monitor: mode === "admin" ? monitor : buildCustomerSafeMonitor(monitor),
    adminOnly: mode === "admin" ? {
      executionAttempts: attempts,
      liveOrders,
      livePositions,
    } : undefined,
  };
}
