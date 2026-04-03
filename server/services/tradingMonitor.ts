export interface TradingMonitorState {
  mode: string;
  currentRegime: string;
  lastDecisionTime: string;
  totalTrades: number;
  winRate: number;
  currentDrawdown: number;
  openPositionsCount: number;
  bestStrategy: string;
  dataQualityScore: number;
}

export interface TradingDecision {
  id: string;
  timestamp: string;
  market: string;
  strategy: string;
  direction: "long" | "short";
  confidence: number;
  thesis: string;
  regime: string;
  volumeRatio: number | null;
  reasonCode: string;
  status: string;
  expectedMove: number | null;
  expectedCost: number | null;
  invalidationRule: string;
  riskBucket: string;
  dataQualityScore: number;
  slippageEstimate: number | null;
  modelVersion: string;
  fullPayload: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface OpenPosition {
  id: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  stopPrice: number;
  duration: string;
  status: string;
}

export interface TradeOutcome {
  id: string;
  symbol: string;
  strategy: string;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  duration: string;
  slippage: number;
  outcome: "win" | "loss";
  timestamp: string;
}

export interface TradingPerformance {
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  pnlSeries: { date: string; value: number }[];
}

export interface TradingMonitorResponse {
  state: TradingMonitorState;
  decisions: TradingDecision[];
  positions: OpenPosition[];
  recent_outcomes: TradeOutcome[];
  performance: TradingPerformance;
}

function generateMockDecisions(): TradingDecision[] {
  const markets = ["BTC/USD", "ETH/USD", "XAUUSD", "BTC/USD", "ETH/USD"];
  const strategies = ["momentum_breakout", "mean_reversion", "trend_follow", "volatility_squeeze", "regime_shift"];
  const directions: ("long" | "short")[] = ["long", "short"];
  const regimes = ["trend", "range", "volatile", "low_vol"];
  const statuses = ["executed", "executed", "executed", "skipped", "pending"];
  const reasonCodes = ["strong_momentum", "support_bounce", "breakout_confirmed", "regime_alignment", "volume_spike"];
  const riskBuckets = ["low", "medium", "medium", "high", "low"];

  const now = Date.now();
  return Array.from({ length: 25 }, (_, i) => {
    const dir = directions[i % 2];
    const mkt = markets[i % markets.length];
    const strat = strategies[i % strategies.length];
    const conf = Math.round(55 + Math.random() * 40);
    const ts = new Date(now - i * 720000).toISOString();

    return {
      id: `td-${1000 + i}`,
      timestamp: ts,
      market: mkt,
      strategy: strat,
      direction: dir,
      confidence: conf,
      thesis: generateThesis(mkt, dir, strat),
      regime: regimes[i % regimes.length],
      volumeRatio: Math.round((0.8 + Math.random() * 2.5) * 100) / 100,
      reasonCode: reasonCodes[i % reasonCodes.length],
      status: statuses[i % statuses.length],
      expectedMove: Math.round((0.5 + Math.random() * 4) * 100) / 100,
      expectedCost: Math.round(Math.random() * 15 * 100) / 100,
      invalidationRule: dir === "long" ? `Close below ${mkt === "XAUUSD" ? "$2,280" : "$" + Math.floor(Math.random() * 1000 + 60000)}` : `Close above $${Math.floor(Math.random() * 1000 + 62000)}`,
      riskBucket: riskBuckets[i % riskBuckets.length],
      dataQualityScore: Math.round((0.85 + Math.random() * 0.14) * 100) / 100,
      slippageEstimate: Math.round(Math.random() * 0.15 * 100) / 100,
      modelVersion: "v0.3.1-paper",
      fullPayload: {
        model: "v0.3.1-paper",
        market: mkt,
        direction: dir,
        strategy: strat,
        confidence: conf,
        regime: regimes[i % regimes.length],
        paperMode: true,
        features: {
          rsi14: Math.round((30 + Math.random() * 50) * 10) / 10,
          macdSignal: Math.round((Math.random() - 0.5) * 200) / 100,
          bbWidth: Math.round(Math.random() * 5 * 100) / 100,
          volume24h: Math.round(Math.random() * 50e9),
          atr14: Math.round(Math.random() * 2000),
        },
      },
      createdAt: ts,
      updatedAt: ts,
    };
  });
}

function generateThesis(market: string, direction: string, strategy: string): string {
  const theses: Record<string, string[]> = {
    "BTC/USD": [
      "Bitcoin showing strong momentum above 20-day EMA with increasing on-chain volume. Funding rates neutral.",
      "BTC consolidating near resistance with declining volume. Expecting breakout on next impulse.",
      "Hash rate at all-time high, exchange reserves declining. Structural supply squeeze forming.",
    ],
    "ETH/USD": [
      "ETH/BTC ratio rebounding from key support. Gas fees stabilising, DeFi TVL recovering.",
      "Ethereum showing relative strength versus broader altcoin market. Staking inflows accelerating.",
      "ETH forming higher lows on 4H chart. Network activity metrics improving week-over-week.",
    ],
    "XAUUSD": [
      "Gold breaking above consolidation range as real yields decline. Central bank buying continues.",
      "XAUUSD testing key resistance with supportive macro backdrop. DXY weakness providing tailwind.",
      "Gold holding above $2,300 with geopolitical risk premium intact. COT data shows net long positioning.",
    ],
  };
  const pool = theses[market] || theses["BTC/USD"];
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateMockPositions(): OpenPosition[] {
  return [
    {
      id: "pos-001",
      symbol: "BTC/USD",
      side: "long",
      entryPrice: 61250.00,
      currentPrice: 62180.00,
      unrealizedPnl: 930.00,
      stopPrice: 60100.00,
      duration: "4h 22m",
      status: "open",
    },
    {
      id: "pos-002",
      symbol: "ETH/USD",
      side: "long",
      entryPrice: 3420.50,
      currentPrice: 3385.20,
      unrealizedPnl: -35.30,
      stopPrice: 3350.00,
      duration: "1h 48m",
      status: "open",
    },
    {
      id: "pos-003",
      symbol: "XAUUSD",
      side: "long",
      entryPrice: 2318.40,
      currentPrice: 2342.10,
      unrealizedPnl: 23.70,
      stopPrice: 2295.00,
      duration: "6h 15m",
      status: "open",
    },
  ];
}

function generateMockOutcomes(): TradeOutcome[] {
  const now = Date.now();
  const outcomes: TradeOutcome[] = [
    { id: "out-001", symbol: "BTC/USD", strategy: "momentum_breakout", entryPrice: 60800, exitPrice: 62100, realizedPnl: 1300, duration: "8h 14m", slippage: 0.04, outcome: "win", timestamp: new Date(now - 3600000).toISOString() },
    { id: "out-002", symbol: "ETH/USD", strategy: "mean_reversion", entryPrice: 3510, exitPrice: 3455, realizedPnl: -55, duration: "2h 45m", slippage: 0.06, outcome: "loss", timestamp: new Date(now - 7200000).toISOString() },
    { id: "out-003", symbol: "BTC/USD", strategy: "trend_follow", entryPrice: 59200, exitPrice: 60850, realizedPnl: 1650, duration: "14h 30m", slippage: 0.03, outcome: "win", timestamp: new Date(now - 14400000).toISOString() },
    { id: "out-004", symbol: "XAUUSD", strategy: "momentum_breakout", entryPrice: 2290, exitPrice: 2315, realizedPnl: 25, duration: "5h 10m", slippage: 0.02, outcome: "win", timestamp: new Date(now - 21600000).toISOString() },
    { id: "out-005", symbol: "ETH/USD", strategy: "volatility_squeeze", entryPrice: 3380, exitPrice: 3350, realizedPnl: -30, duration: "1h 20m", slippage: 0.08, outcome: "loss", timestamp: new Date(now - 28800000).toISOString() },
    { id: "out-006", symbol: "BTC/USD", strategy: "regime_shift", entryPrice: 58400, exitPrice: 59900, realizedPnl: 1500, duration: "18h 55m", slippage: 0.02, outcome: "win", timestamp: new Date(now - 36000000).toISOString() },
    { id: "out-007", symbol: "XAUUSD", strategy: "trend_follow", entryPrice: 2275, exitPrice: 2298, realizedPnl: 23, duration: "9h 40m", slippage: 0.01, outcome: "win", timestamp: new Date(now - 43200000).toISOString() },
    { id: "out-008", symbol: "BTC/USD", strategy: "momentum_breakout", entryPrice: 57800, exitPrice: 58500, realizedPnl: 700, duration: "6h 20m", slippage: 0.05, outcome: "win", timestamp: new Date(now - 50400000).toISOString() },
    { id: "out-009", symbol: "ETH/USD", strategy: "trend_follow", entryPrice: 3290, exitPrice: 3270, realizedPnl: -20, duration: "3h 05m", slippage: 0.07, outcome: "loss", timestamp: new Date(now - 57600000).toISOString() },
    { id: "out-010", symbol: "BTC/USD", strategy: "mean_reversion", entryPrice: 56900, exitPrice: 57600, realizedPnl: 700, duration: "10h 15m", slippage: 0.03, outcome: "win", timestamp: new Date(now - 64800000).toISOString() },
    { id: "out-011", symbol: "XAUUSD", strategy: "volatility_squeeze", entryPrice: 2260, exitPrice: 2282, realizedPnl: 22, duration: "4h 30m", slippage: 0.02, outcome: "win", timestamp: new Date(now - 72000000).toISOString() },
    { id: "out-012", symbol: "BTC/USD", strategy: "trend_follow", entryPrice: 55800, exitPrice: 56500, realizedPnl: 700, duration: "12h 40m", slippage: 0.04, outcome: "win", timestamp: new Date(now - 86400000).toISOString() },
    { id: "out-013", symbol: "ETH/USD", strategy: "momentum_breakout", entryPrice: 3200, exitPrice: 3180, realizedPnl: -20, duration: "2h 10m", slippage: 0.09, outcome: "loss", timestamp: new Date(now - 93600000).toISOString() },
    { id: "out-014", symbol: "BTC/USD", strategy: "regime_shift", entryPrice: 54200, exitPrice: 55100, realizedPnl: 900, duration: "16h 00m", slippage: 0.03, outcome: "win", timestamp: new Date(now - 100800000).toISOString() },
    { id: "out-015", symbol: "XAUUSD", strategy: "mean_reversion", entryPrice: 2240, exitPrice: 2255, realizedPnl: 15, duration: "7h 25m", slippage: 0.01, outcome: "win", timestamp: new Date(now - 108000000).toISOString() },
    { id: "out-016", symbol: "ETH/USD", strategy: "trend_follow", entryPrice: 3150, exitPrice: 3190, realizedPnl: 40, duration: "11h 50m", slippage: 0.04, outcome: "win", timestamp: new Date(now - 115200000).toISOString() },
    { id: "out-017", symbol: "BTC/USD", strategy: "volatility_squeeze", entryPrice: 53500, exitPrice: 53300, realizedPnl: -200, duration: "1h 55m", slippage: 0.06, outcome: "loss", timestamp: new Date(now - 122400000).toISOString() },
    { id: "out-018", symbol: "XAUUSD", strategy: "momentum_breakout", entryPrice: 2220, exitPrice: 2245, realizedPnl: 25, duration: "8h 30m", slippage: 0.02, outcome: "win", timestamp: new Date(now - 129600000).toISOString() },
    { id: "out-019", symbol: "BTC/USD", strategy: "trend_follow", entryPrice: 52800, exitPrice: 53600, realizedPnl: 800, duration: "20h 10m", slippage: 0.03, outcome: "win", timestamp: new Date(now - 136800000).toISOString() },
    { id: "out-020", symbol: "ETH/USD", strategy: "regime_shift", entryPrice: 3080, exitPrice: 3120, realizedPnl: 40, duration: "13h 45m", slippage: 0.05, outcome: "win", timestamp: new Date(now - 144000000).toISOString() },
  ];
  return outcomes;
}

function generateMockPerformance(outcomes: TradeOutcome[]): TradingPerformance {
  const wins = outcomes.filter(o => o.outcome === "win");
  const losses = outcomes.filter(o => o.outcome === "loss");
  const avgWin = wins.length > 0 ? Math.round(wins.reduce((s, o) => s + o.realizedPnl, 0) / wins.length * 100) / 100 : 0;
  const avgLoss = losses.length > 0 ? Math.round(losses.reduce((s, o) => s + Math.abs(o.realizedPnl), 0) / losses.length * 100) / 100 : 0;
  const winRate = outcomes.length > 0 ? wins.length / outcomes.length : 0;
  const expectancy = Math.round((winRate * avgWin - (1 - winRate) * avgLoss) * 100) / 100;

  let consWins = 0, consLosses = 0, curWins = 0, curLosses = 0;
  for (const o of outcomes) {
    if (o.outcome === "win") { curWins++; curLosses = 0; consWins = Math.max(consWins, curWins); }
    else { curLosses++; curWins = 0; consLosses = Math.max(consLosses, curLosses); }
  }

  const now = Date.now();
  let cumPnl = 0;
  const pnlSeries = outcomes
    .slice()
    .reverse()
    .map((o) => {
      cumPnl += o.realizedPnl;
      return { date: o.timestamp, value: Math.round(cumPnl * 100) / 100 };
    });

  return { avgWin, avgLoss, expectancy, consecutiveWins: consWins, consecutiveLosses: consLosses, pnlSeries };
}

export function getTradingMonitorData(): TradingMonitorResponse {
  const decisions = generateMockDecisions();
  const positions = generateMockPositions();
  const outcomes = generateMockOutcomes();
  const performance = generateMockPerformance(outcomes);

  const wins = outcomes.filter(o => o.outcome === "win").length;
  const winRate = outcomes.length > 0 ? Math.round((wins / outcomes.length) * 100) : 0;
  const maxPnl = performance.pnlSeries.length > 0 ? Math.max(...performance.pnlSeries.map(p => p.value)) : 0;
  const currentPnl = performance.pnlSeries.length > 0 ? performance.pnlSeries[performance.pnlSeries.length - 1].value : 0;
  const drawdown = maxPnl > 0 ? Math.round(((maxPnl - currentPnl) / maxPnl) * 10000) / 100 : 0;

  const strategyCounts: Record<string, number> = {};
  for (const o of outcomes.filter(oo => oo.outcome === "win")) {
    strategyCounts[o.strategy] = (strategyCounts[o.strategy] || 0) + 1;
  }
  const bestStrategy = Object.entries(strategyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  const state: TradingMonitorState = {
    mode: "paper",
    currentRegime: "trend",
    lastDecisionTime: decisions[0]?.timestamp || "",
    totalTrades: outcomes.length,
    winRate,
    currentDrawdown: drawdown,
    openPositionsCount: positions.length,
    bestStrategy: bestStrategy.replace(/_/g, " "),
    dataQualityScore: 0.94,
  };

  return { state, decisions, positions, recent_outcomes: outcomes, performance };
}
