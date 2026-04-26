type SectionResult<T = unknown> = {
  ok: boolean;
  source: string;
  data: T;
  error?: string;
  timedOut?: boolean;
};

const SECTION_TIMEOUT_MS = Number(process.env.TRADING_MONITOR_SECTION_TIMEOUT_MS || 2500);

function timeoutAfter<T>(ms: number, label: string, fallback: T): Promise<SectionResult<T>> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ok: false,
        source: label,
        data: fallback,
        timedOut: true,
        error: `${label} timed out after ${ms}ms`,
      });
    }, ms);
  });
}

async function withTimeout<T>(
  label: string,
  fallback: T,
  fn: () => Promise<T> | T,
  timeoutMs = SECTION_TIMEOUT_MS,
): Promise<SectionResult<T>> {
  try {
    const result = await Promise.race([
      Promise.resolve().then(fn).then((data) => ({
        ok: true,
        source: label,
        data,
      }) satisfies SectionResult<T>),
      timeoutAfter(timeoutMs, label, fallback),
    ]);

    return result;
  } catch (error: any) {
    return {
      ok: false,
      source: label,
      data: fallback,
      error: error?.message || String(error),
    };
  }
}

function callable(mod: any, names: string[]): (() => any) | null {
  for (const name of names) {
    if (typeof mod?.[name] === "function") {
      return mod[name].bind(mod);
    }
  }
  return null;
}

async function callFirstExport<T>(
  importPath: string,
  names: string[],
  fallback: T,
  label: string,
): Promise<SectionResult<T>> {
  return withTimeout(label, fallback, async () => {
    const mod = await import(importPath);
    const fn = callable(mod, names);

    if (!fn) {
      return {
        unavailable: true,
        reason: `No matching export found. Tried: ${names.join(", ")}`,
        availableExports: Object.keys(mod).sort(),
      } as T;
    }

    return await fn();
  });
}

function pickArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.positions)) return value.positions;
  if (Array.isArray(value?.openPositions)) return value.openPositions;
  if (Array.isArray(value?.decisions)) return value.decisions;
  if (Array.isArray(value?.outcomes)) return value.outcomes;
  if (Array.isArray(value?.trades)) return value.trades;
  if (Array.isArray(value?.wallets)) return value.wallets;
  return [];
}

function countArray(value: any): number {
  return pickArray(value).length;
}

function safeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function summarisePaperEngine(openPositions: any, recentOutcomes: any) {
  const open = pickArray(openPositions);
  const outcomes = pickArray(recentOutcomes);

  const wins = outcomes.filter((o: any) => {
    const pnl = safeNumber(o?.pnl ?? o?.profitLoss ?? o?.realisedPnl ?? o?.realizedPnl, 0);
    const status = String(o?.status || o?.result || "").toLowerCase();
    return pnl > 0 || status.includes("win");
  }).length;

  const losses = outcomes.filter((o: any) => {
    const pnl = safeNumber(o?.pnl ?? o?.profitLoss ?? o?.realisedPnl ?? o?.realizedPnl, 0);
    const status = String(o?.status || o?.result || "").toLowerCase();
    return pnl < 0 || status.includes("loss");
  }).length;

  const closed = wins + losses || outcomes.length;
  const winRate = closed > 0 ? Math.round((wins / closed) * 10000) / 100 : 0;

  const realisedPnl = outcomes.reduce((sum: number, o: any) => {
    return sum + safeNumber(o?.pnl ?? o?.profitLoss ?? o?.realisedPnl ?? o?.realizedPnl, 0);
  }, 0);

  const unrealisedPnl = open.reduce((sum: number, p: any) => {
    return sum + safeNumber(p?.unrealisedPnl ?? p?.unrealizedPnl ?? p?.pnl ?? p?.profitLoss, 0);
  }, 0);

  return {
    totalTrades: outcomes.length + open.length,
    openTrades: open.length,
    closedTrades: outcomes.length,
    winRate,
    pnl: Math.round((realisedPnl + unrealisedPnl) * 100) / 100,
    realisedPnl: Math.round(realisedPnl * 100) / 100,
    unrealisedPnl: Math.round(unrealisedPnl * 100) / 100,
  };
}

export async function getSafeTradingMonitorData() {
  const generatedAt = new Date().toISOString();

  const [
    marketData,
    openPositions,
    recentOutcomes,
    paperState,
    walletRegistry,
    walletMonitor,
    walletLedger,
    walletScores,
    riskGovernor,
    guardrails,
    tradingIndex,
  ] = await Promise.all([
    callFirstExport("./mexcMarketData", [
      "getMarketDataState",
      "getMexcMarketSnapshot",
    ], { marketContext: [], failures: [] }, "marketData.mexcPublicRest"),

    callFirstExport("./paperEngine", [
      "getOpenPositions",
      "listOpenPositions",
      "getActivePositions",
      "openPositions",
    ], [], "paperEngine.openPositions"),

    callFirstExport("./paperEngine", [
      "getRecentOutcomes",
      "listRecentOutcomes",
      "getClosedTrades",
      "getTradeOutcomes",
      "listPaperTrades",
    ], [], "paperEngine.recentOutcomes"),

    callFirstExport("./paperEngine", [
      "getMonitorState",
      "getPaperEngineState",
      "getPaperTradingState",
      "getTradingState",
      "getState",
    ], {}, "paperEngine.state"),

    callFirstExport("./wallet-registry", [
      "listTrackedWallets",
      "getTrackedWallets",
      "listWallets",
      "getWalletRegistry",
    ], [], "walletRegistry.trackedWallets"),

    callFirstExport("./wallet-monitor", [
      "getWalletMonitorState",
      "getMonitorState",
      "listWalletActions",
      "getRecentWalletActions",
    ], {}, "walletMonitor.state"),

    callFirstExport("./wallet-ledger", [
      "getWalletLedger",
      "listWalletLedger",
      "getWalletPerformance",
      "getRecentWalletTrades",
    ], {}, "walletLedger.data"),

    callFirstExport("./wallet-score-engine", [
      "getWalletScoreState",
      "getWalletScores",
      "scoreWallets",
      "getAllWalletScores",
    ], {}, "walletScoreEngine.scores"),

    callFirstExport("./risk-governor", [
      "getRiskGovernorState",
      "getRiskState",
      "getRiskSnapshot",
      "evaluateRiskState",
    ], {}, "riskGovernor.state"),

    callFirstExport("./tradingGuardrails", [
      "getGuardrailState",
      "getTradingGuardrailsState",
      "getGuardrails",
      "evaluateGuardrails",
    ], {}, "tradingGuardrails.state"),

    callFirstExport("./index", [
      "getTradingMonitorData",
    ], {}, "trading.index.getTradingMonitorData"),
  ]);

  const openPositionsData = pickArray(openPositions.data);
  const recentOutcomesData = pickArray(recentOutcomes.data);
  const performance = summarisePaperEngine(openPositions.data, recentOutcomes.data);

  const sections = {
    marketData,
    openPositions,
    recentOutcomes,
    paperState,
    walletRegistry,
    walletMonitor,
    walletLedger,
    walletScores,
    riskGovernor,
    guardrails,
    tradingIndex,
  };

  const sectionValues = Object.values(sections);
  const failedSections = sectionValues.filter((section) => !section.ok);
  const timedOutSections = sectionValues.filter((section) => section.timedOut);

  const realFeedHealthy =
    marketData.ok ||
    openPositions.ok ||
    recentOutcomes.ok ||
    paperState.ok ||
    walletRegistry.ok ||
    walletMonitor.ok ||
    walletLedger.ok ||
    walletScores.ok ||
    riskGovernor.ok ||
    guardrails.ok;

  return {
    ok: true,
    connected: true,
    status: failedSections.length === 0 ? "online" : realFeedHealthy ? "degraded" : "limited",
    mode: "paper",
    paperMode: true,
    liveTradingEnabled: false,
    generatedAt,

    state: {
      engine: "PhantomX",
      runtime: "local",
      dataFeed: "real_modules_with_timeouts",
      message: realFeedHealthy
        ? "Trading Monitor connected to real trading modules with timeout protection."
        : "Trading Monitor connected, but real modules did not return usable data yet.",
      failedSections: failedSections.map((s) => ({ source: s.source, error: s.error, timedOut: s.timedOut || false })),
      timedOutSections: timedOutSections.map((s) => s.source),
    },

    engine: {
      running: Boolean((paperState.data as any)?.running ?? (walletMonitor.data as any)?.running ?? false),
      paperMode: true,
      liveTradingEnabled: false,
      approvalRequired: false,
      phantomXStatus: {
        paperEngine: paperState.ok ? "connected" : "degraded",
        walletMonitor: walletMonitor.ok ? "connected" : "degraded",
        walletLedger: walletLedger.ok ? "connected" : "degraded",
        riskGovernor: riskGovernor.ok ? "connected" : "degraded",
        guardrails: guardrails.ok ? "connected" : "degraded",
      },
    },

    performance,
    open_positions: openPositionsData,
    recent_outcomes: recentOutcomesData,
    decisions: pickArray((tradingIndex.data as any)?.decisions ?? (tradingIndex.data as any)?.recent_decisions),
    recent_decisions: pickArray((tradingIndex.data as any)?.recent_decisions ?? (tradingIndex.data as any)?.decisions),
    news: pickArray((tradingIndex.data as any)?.news),
    strategy_profiles: pickArray((tradingIndex.data as any)?.strategy_profiles ?? (tradingIndex.data as any)?.strategyProfiles),
    market_context:
      (marketData.data as any)?.marketContext?.length
        ? (marketData.data as any).marketContext
        : (tradingIndex.data as any)?.market_context ?? (tradingIndex.data as any)?.marketContext ?? {},

    realData: {
      marketData: marketData.data,
      paperEngine: {
        state: paperState.data,
        openPositions: openPositions.data,
        recentOutcomes: recentOutcomes.data,
      },
      walletMonitor: walletMonitor.data,
      walletLedger: walletLedger.data,
      walletRegistry: walletRegistry.data,
      walletScores: walletScores.data,
      riskGovernor: riskGovernor.data,
      guardrails: guardrails.data,
      legacyTradingIndex: tradingIndex.data,
    },

    counts: {
      marketSymbols: Array.isArray((marketData.data as any)?.marketContext) ? (marketData.data as any).marketContext.length : 0,
      staleMarketSymbols: Array.isArray((marketData.data as any)?.failures) ? (marketData.data as any).failures.length : 0,
      openPositions: openPositionsData.length,
      recentOutcomes: recentOutcomesData.length,
      trackedWallets: countArray(walletRegistry.data),
      walletActions: countArray(walletMonitor.data),
      walletLedgerItems: countArray(walletLedger.data),
    },
  };
}
