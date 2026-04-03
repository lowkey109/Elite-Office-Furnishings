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
  direction: "long" | "short";
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
  sharpeRatio: number;
  profitFactor: number;
  maxDrawdown: number;
  totalPnl: number;
  pnlSeries: { date: string; value: number }[];
}

export interface NewsItem {
  id: string;
  timestamp: string;
  headline: string;
  source: string;
  sentiment: "bullish" | "bearish" | "neutral";
  relevance: number;
  markets: string[];
  summary: string;
  impact: "high" | "medium" | "low";
}

export interface MarketContext {
  symbol: string;
  price: number;
  change24h: number;
  changePct24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  regime: string;
  dominantTrend: string;
  volatilityLevel: string;
  keyLevels: { support: number[]; resistance: number[] };
  technicals: {
    rsi14: number;
    macd: { value: number; signal: number; histogram: number };
    ema20: number;
    ema50: number;
    ema200: number;
    bbUpper: number;
    bbLower: number;
    bbWidth: number;
    atr14: number;
    adx: number;
    obv: string;
    vwap: number;
    stochRsi: number;
    williamsR: number;
    cci: number;
    mfi: number;
  };
  fundingRate: number | null;
  openInterest: number | null;
  fearGreedIndex: number | null;
}

export interface StrategyProfile {
  name: string;
  description: string;
  edge: string;
  idealRegime: string;
  winRate: number;
  avgRR: number;
  avgHoldTime: string;
  riskPerTrade: string;
  entryRules: string[];
  exitRules: string[];
  invalidationRules: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface TradingMonitorResponse {
  state: TradingMonitorState;
  decisions: TradingDecision[];
  positions: OpenPosition[];
  recent_outcomes: TradeOutcome[];
  performance: TradingPerformance;
  news: NewsItem[];
  marketContext: MarketContext[];
  strategies: StrategyProfile[];
}

let cachedData: TradingMonitorResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildStrategies(): StrategyProfile[] {
  return [
    {
      name: "momentum_breakout",
      description: "Captures strong directional moves when price breaks through established support/resistance with volume confirmation. Targets the initial impulse move after the breakout.",
      edge: "High-probability entries when volume confirms the breakout direction, catching the fastest part of the move before mean-reversion forces take over.",
      idealRegime: "trending",
      winRate: 62,
      avgRR: 2.1,
      avgHoldTime: "4-12 hours",
      riskPerTrade: "1.5% of paper capital",
      entryRules: [
        "Price breaks above/below key horizontal level with at least 1.5x average volume",
        "RSI(14) confirms direction (>55 for long breakout, <45 for short)",
        "MACD histogram expanding in breakout direction",
        "ADX > 25 confirming trend strength",
        "No major resistance/support within 1 ATR of entry in trade direction",
      ],
      exitRules: [
        "Take profit at 2:1 reward-to-risk ratio",
        "Trail stop to breakeven after 1R move",
        "Close 50% at 1.5R, trail remainder with 2-ATR stop",
        "Exit on volume exhaustion (volume drops below average on continuation)",
      ],
      invalidationRules: [
        "Price closes back inside the range within 2 candles",
        "Volume dries up immediately after breakout (false breakout signal)",
        "Opposing macro news event within 30 minutes of entry",
      ],
      strengths: ["High R:R ratio", "Clear entry/exit rules", "Works well in trending markets", "Quick to identify false breakouts"],
      weaknesses: ["Whipsaws in ranging markets", "Slippage on volatile breakouts", "Requires real-time volume data", "Lower win rate than mean reversion"],
    },
    {
      name: "mean_reversion",
      description: "Fades extreme moves by entering counter-trend when price reaches statistical extremes (Bollinger Band outer edges, RSI overbought/oversold) with regime confirmation that conditions favor snapback.",
      edge: "Statistically, price reverts to the mean 60-70% of the time in range-bound regimes. Tight stops limit downside when trend continuation invalidates the setup.",
      idealRegime: "ranging",
      winRate: 68,
      avgRR: 1.3,
      avgHoldTime: "1-4 hours",
      riskPerTrade: "1% of paper capital",
      entryRules: [
        "Price touches or exceeds 2-standard-deviation Bollinger Band",
        "RSI(14) > 75 (short) or < 25 (long)",
        "ADX < 20 confirming range-bound conditions",
        "Stochastic RSI showing divergence from price",
        "MFI confirms exhaustion (>80 for short, <20 for long)",
        "No earnings or major macro event within 4 hours",
      ],
      exitRules: [
        "Target: 20-period moving average (the 'mean')",
        "Stop: 0.5 ATR beyond the extreme",
        "Time stop: Exit if no reversion within 6 hours",
        "Close if ADX starts rising above 25 (regime shift to trend)",
      ],
      invalidationRules: [
        "ADX crosses above 30 (strong trend forming, not a reversion setup)",
        "Price makes new extreme on higher volume (continuation, not exhaustion)",
        "Funding rate extreme and rising (crypto-specific leverage indicator)",
      ],
      strengths: ["High win rate", "Quick trades", "Works in choppy markets", "Low drawdown per trade"],
      weaknesses: ["Small R:R means a few losses wipe many wins", "Fails catastrophically in strong trends", "Requires accurate regime detection"],
    },
    {
      name: "trend_follow",
      description: "Rides established trends by entering on pullbacks to dynamic support/resistance (EMAs, VWAP). Holds position as long as the trend structure remains intact, using trailing stops to capture large moves.",
      edge: "Trends persist longer than most market participants expect. Pullback entries provide favourable risk:reward by entering closer to the trend's support structure.",
      idealRegime: "trending",
      winRate: 55,
      avgRR: 3.2,
      avgHoldTime: "12-48 hours",
      riskPerTrade: "1.5% of paper capital",
      entryRules: [
        "Price above EMA(20) and EMA(50), both sloping in trend direction",
        "Pullback touches EMA(20) or VWAP and bounces",
        "ADX > 25 and DI+ > DI- (uptrend) or DI- > DI+ (downtrend)",
        "Volume decreases during pullback, increases on bounce (healthy trend)",
        "Higher timeframe (4H/daily) confirms same trend direction",
      ],
      exitRules: [
        "Initial stop: Below EMA(50) or swing low",
        "Trail stop using 3-ATR from price or EMA(20)",
        "Close 33% at 2R, 33% at 3R, trail final 33%",
        "Exit on EMA(20) crossing below EMA(50)",
      ],
      invalidationRules: [
        "Price closes below EMA(50) on volume",
        "ADX drops below 20 (trend losing strength)",
        "Series of lower highs in uptrend or higher lows in downtrend",
      ],
      strengths: ["Large winners capture big moves", "Rides trends for maximum profit", "Clear trend-structure-based stops", "Scales well across timeframes"],
      weaknesses: ["Low win rate requires discipline", "Slow to exit — gives back profit on reversals", "Doesn't work in choppy/ranging markets"],
    },
    {
      name: "volatility_squeeze",
      description: "Identifies periods of unusually low volatility (Bollinger Band width contraction, ATR compression) and positions for the explosive move that typically follows. Direction determined by order flow and momentum indicators.",
      edge: "Volatility is mean-reverting: periods of compression are reliably followed by expansion. The squeeze pattern is one of the most consistent setups across all liquid markets.",
      idealRegime: "low_volatility",
      winRate: 58,
      avgRR: 2.5,
      avgHoldTime: "2-8 hours",
      riskPerTrade: "1% of paper capital",
      entryRules: [
        "Bollinger Band width falls to lowest level in 20 periods",
        "Keltner Channels inside Bollinger Bands (classic squeeze signal)",
        "ATR(14) at or near 20-period low",
        "Wait for first candle to close outside the squeeze range",
        "Enter in direction of the breakout with momentum confirmation (MACD cross)",
      ],
      exitRules: [
        "Target: 2.5x the width of the squeeze range",
        "Stop: Opposite side of the squeeze range",
        "Trail using 2-ATR once move exceeds 1.5R",
        "Exit if momentum indicator (MACD histogram) starts declining within 3 candles",
      ],
      invalidationRules: [
        "Price re-enters squeeze range and closes inside it",
        "Volume doesn't increase on breakout (low-conviction move)",
        "Squeeze lasts more than 40 periods without resolution (pattern degradation)",
      ],
      strengths: ["Excellent R:R from tight stops", "Repeatable pattern", "Works across all liquid markets", "Clear visual setup"],
      weaknesses: ["False breakouts common", "Requires patience waiting for squeeze", "Timing of entry is critical"],
    },
    {
      name: "regime_shift",
      description: "Detects transitions between market regimes (trending ↔ ranging, low vol ↔ high vol) and positions early in the new regime. Uses a combination of volatility metrics, trend strength, and structural analysis.",
      edge: "Most strategies fail during regime transitions because they're calibrated for the previous regime. This strategy profits from the transition itself — the most dislocating and profitable phase.",
      idealRegime: "transition",
      winRate: 48,
      avgRR: 4.0,
      avgHoldTime: "24-72 hours",
      riskPerTrade: "0.75% of paper capital",
      entryRules: [
        "ADX crosses above 25 from below (trend emerging from range)",
        "ATR expanding 50%+ from 20-period average",
        "EMA(20) crosses EMA(50) (golden/death cross forming)",
        "Volume surge: 2x average for 3+ consecutive periods",
        "Correlation with correlated assets confirms regime change (e.g., BTC leads alts)",
        "Macro catalyst identified (rate decision, major news, regulatory change)",
      ],
      exitRules: [
        "Hold until new regime is established (ADX sustained above 30 for trend)",
        "Take partial profits at 3R and 5R",
        "Exit if regime change fails (ADX drops back below 20 within 48 hours)",
        "Exit on counter-regime signals appearing",
      ],
      invalidationRules: [
        "ADX reversal back below 20 within 24 hours",
        "Volume returns to average levels (regime change not confirmed by participation)",
        "Price fails to make new high/low in expected direction within 48 hours",
      ],
      strengths: ["Massive R:R potential", "Catches the biggest moves", "First-mover advantage in new regime", "Works across all asset classes"],
      weaknesses: ["Lowest win rate of all strategies", "Requires patience and conviction", "False regime shifts are costly", "Hardest strategy to execute psychologically"],
    },
    {
      name: "order_flow_scalp",
      description: "Micro-scalping strategy using order book imbalance, trade flow analysis, and CVD (Cumulative Volume Delta) to identify short-term directional moves. Targets 0.3-0.8% moves on leveraged positions.",
      edge: "Order flow reveals institutional intent before price moves. Aggressive absorption and delta divergence signal high-probability short-term directional moves.",
      idealRegime: "any_liquid",
      winRate: 71,
      avgRR: 0.8,
      avgHoldTime: "5-30 minutes",
      riskPerTrade: "0.5% of paper capital",
      entryRules: [
        "CVD divergence from price (price flat, delta surging in one direction)",
        "Order book imbalance > 3:1 at key level (bid/ask ratio)",
        "Large resting orders being absorbed (iceberg detection)",
        "Footprint chart shows aggressive buying/selling at key price level",
        "Spread tightening after recent widening (market maker confidence returning)",
      ],
      exitRules: [
        "Fixed target: 0.5% from entry",
        "Stop: 0.3% from entry",
        "Exit on CVD reversal",
        "Time stop: 15 minutes maximum hold",
      ],
      invalidationRules: [
        "Spread widens significantly (liquidity withdrawal)",
        "Large market order executes against position direction",
        "News event occurs during hold period",
      ],
      strengths: ["Very high win rate", "Quick trades reduce exposure", "Works in any regime with liquidity", "Low capital at risk per trade"],
      weaknesses: ["Requires institutional-grade data feeds", "High execution cost from frequent trading", "Slippage kills edge on less liquid pairs", "Mentally exhausting"],
    },
  ];
}

function buildMarketContext(): MarketContext[] {
  return [
    {
      symbol: "BTC/USD",
      price: 84532.40,
      change24h: 1247.80,
      changePct24h: 1.50,
      volume24h: 42.8e9,
      high24h: 85120.00,
      low24h: 82940.00,
      regime: "trending",
      dominantTrend: "bullish",
      volatilityLevel: "moderate",
      keyLevels: {
        support: [82000, 80500, 78200, 75000],
        resistance: [85500, 87000, 90000, 92500],
      },
      technicals: {
        rsi14: 62.4,
        macd: { value: 284.5, signal: 198.2, histogram: 86.3 },
        ema20: 83180,
        ema50: 81450,
        ema200: 74200,
        bbUpper: 86400,
        bbLower: 81200,
        bbWidth: 6.2,
        atr14: 1850,
        adx: 31.2,
        obv: "+2.4B (rising)",
        vwap: 83920,
        stochRsi: 0.72,
        williamsR: -28.5,
        cci: 124.3,
        mfi: 58.7,
      },
      fundingRate: 0.0082,
      openInterest: 18.4e9,
      fearGreedIndex: 67,
    },
    {
      symbol: "ETH/USD",
      price: 1898.60,
      change24h: -22.40,
      changePct24h: -1.17,
      volume24h: 18.2e9,
      high24h: 1935.00,
      low24h: 1875.00,
      regime: "ranging",
      dominantTrend: "neutral",
      volatilityLevel: "low",
      keyLevels: {
        support: [1860, 1820, 1780, 1720],
        resistance: [1940, 1980, 2050, 2120],
      },
      technicals: {
        rsi14: 47.8,
        macd: { value: -12.4, signal: -8.1, histogram: -4.3 },
        ema20: 1910,
        ema50: 1925,
        ema200: 2180,
        bbUpper: 1960,
        bbLower: 1860,
        bbWidth: 5.3,
        atr14: 62,
        adx: 18.4,
        obv: "-180M (flat)",
        vwap: 1905,
        stochRsi: 0.35,
        williamsR: -62.1,
        cci: -18.7,
        mfi: 42.3,
      },
      fundingRate: 0.0045,
      openInterest: 8.2e9,
      fearGreedIndex: 52,
    },
    {
      symbol: "XAUUSD",
      price: 3128.50,
      change24h: 32.70,
      changePct24h: 1.06,
      volume24h: 210e6,
      high24h: 3142.00,
      low24h: 3088.00,
      regime: "trending",
      dominantTrend: "bullish",
      volatilityLevel: "moderate",
      keyLevels: {
        support: [3080, 3050, 3000, 2960],
        resistance: [3150, 3180, 3200, 3250],
      },
      technicals: {
        rsi14: 64.1,
        macd: { value: 18.2, signal: 12.8, histogram: 5.4 },
        ema20: 3095,
        ema50: 3040,
        ema200: 2820,
        bbUpper: 3160,
        bbLower: 3020,
        bbWidth: 4.5,
        atr14: 28.5,
        adx: 28.7,
        obv: "+450M (rising)",
        vwap: 3112,
        stochRsi: 0.68,
        williamsR: -22.8,
        cci: 98.4,
        mfi: 61.2,
      },
      fundingRate: null,
      openInterest: null,
      fearGreedIndex: null,
    },
    {
      symbol: "SOL/USD",
      price: 134.20,
      change24h: 5.80,
      changePct24h: 4.52,
      volume24h: 4.8e9,
      high24h: 136.50,
      low24h: 127.40,
      regime: "volatile",
      dominantTrend: "bullish",
      volatilityLevel: "high",
      keyLevels: {
        support: [128, 122, 115, 108],
        resistance: [138, 145, 155, 165],
      },
      technicals: {
        rsi14: 68.9,
        macd: { value: 4.8, signal: 2.1, histogram: 2.7 },
        ema20: 129.50,
        ema50: 124.80,
        ema200: 118.40,
        bbUpper: 140.20,
        bbLower: 120.80,
        bbWidth: 14.5,
        atr14: 8.2,
        adx: 34.6,
        obv: "+820M (surging)",
        vwap: 132.40,
        stochRsi: 0.82,
        williamsR: -15.4,
        cci: 156.2,
        mfi: 72.4,
      },
      fundingRate: 0.012,
      openInterest: 2.8e9,
      fearGreedIndex: 71,
    },
  ];
}

function buildNews(): NewsItem[] {
  const now = Date.now();
  return [
    {
      id: "news-001",
      timestamp: new Date(now - 1800000).toISOString(),
      headline: "Federal Reserve signals potential rate pause in upcoming meeting",
      source: "Reuters",
      sentiment: "bullish",
      relevance: 0.95,
      markets: ["BTC/USD", "ETH/USD", "XAUUSD", "SOL/USD"],
      summary: "Fed Chair indicated that economic data supports maintaining current rates, reducing pressure on risk assets. Treasury yields dropped 8bps on the news. Historically, rate pauses have been bullish for both crypto and gold, with BTC averaging +12% in the 30 days following a pause signal.",
      impact: "high",
    },
    {
      id: "news-002",
      timestamp: new Date(now - 3600000).toISOString(),
      headline: "Bitcoin ETF inflows reach $780M in single day — highest since March",
      source: "Bloomberg",
      sentiment: "bullish",
      relevance: 0.92,
      markets: ["BTC/USD"],
      summary: "Spot Bitcoin ETFs recorded massive inflows led by BlackRock iShares Bitcoin Trust ($412M) and Fidelity Wise Origin ($198M). This represents the strongest single-day inflow since mid-March and suggests institutional accumulation is accelerating. Grayscale saw net zero outflows for the first time in 2024.",
      impact: "high",
    },
    {
      id: "news-003",
      timestamp: new Date(now - 5400000).toISOString(),
      headline: "Central banks purchased 290 tonnes of gold in Q1 — China and India leading",
      source: "World Gold Council",
      sentiment: "bullish",
      relevance: 0.88,
      markets: ["XAUUSD"],
      summary: "Central bank gold purchases continue at an elevated pace with China adding 45 tonnes and India adding 32 tonnes to reserves. The trend of de-dollarisation and reserve diversification supports structural demand for gold above current levels. Gold-backed ETF holdings have also increased for 4 consecutive months.",
      impact: "high",
    },
    {
      id: "news-004",
      timestamp: new Date(now - 7200000).toISOString(),
      headline: "Ethereum Pectra upgrade successfully deployed on testnet",
      source: "CoinDesk",
      sentiment: "neutral",
      relevance: 0.75,
      markets: ["ETH/USD"],
      summary: "The Pectra upgrade combining Prague and Electra changes went live on the Holesky testnet without issues. Key improvements include account abstraction (EIP-7702), increased blob capacity, and validator staking cap increases. Mainnet deployment expected in Q2. Market reaction was muted as the upgrade was largely priced in.",
      impact: "medium",
    },
    {
      id: "news-005",
      timestamp: new Date(now - 10800000).toISOString(),
      headline: "US Dollar Index (DXY) breaks below 104 for first time in 3 months",
      source: "Financial Times",
      sentiment: "bullish",
      relevance: 0.90,
      markets: ["BTC/USD", "XAUUSD", "ETH/USD"],
      summary: "The US Dollar weakened against major currencies as economic data showed cooling inflation. DXY fell to 103.8, its lowest level since January. Dollar weakness historically correlates strongly with rallies in both gold and Bitcoin. The inverse correlation between DXY and BTC has been -0.78 over the past 90 days.",
      impact: "high",
    },
    {
      id: "news-006",
      timestamp: new Date(now - 14400000).toISOString(),
      headline: "Solana DEX volume exceeds Ethereum for 5th consecutive week",
      source: "The Block",
      sentiment: "bullish",
      relevance: 0.82,
      markets: ["SOL/USD"],
      summary: "Solana decentralised exchange volume reached $18.2B this week versus Ethereum's $14.8B, marking the 5th straight week of outperformance. Jupiter aggregator processed $8.4B alone. Network revenue from fees hit an all-time high, and active addresses surpassed 2.4M daily. The SOL/ETH ratio is at its highest level ever.",
      impact: "medium",
    },
    {
      id: "news-007",
      timestamp: new Date(now - 18000000).toISOString(),
      headline: "Bitcoin mining difficulty hits new all-time high — hash rate at 850 EH/s",
      source: "Glassnode",
      sentiment: "bullish",
      relevance: 0.78,
      markets: ["BTC/USD"],
      summary: "Bitcoin mining difficulty increased 3.2% to a new record, reflecting hash rate reaching 850 EH/s. Higher difficulty means greater security and miner commitment. Post-halving economics are stabilising as transaction fee revenue supplements reduced block rewards. Miner reserves remain steady, indicating no forced selling pressure.",
      impact: "low",
    },
    {
      id: "news-008",
      timestamp: new Date(now - 21600000).toISOString(),
      headline: "Geopolitical tensions in Middle East escalate — safe haven flows increase",
      source: "Reuters",
      sentiment: "bearish",
      relevance: 0.85,
      markets: ["XAUUSD", "BTC/USD"],
      summary: "Rising tensions have triggered safe-haven inflows into gold and US Treasuries. Gold gained $18 on the news. Bitcoin's response was mixed — initially selling off 2% before recovering as some traders repositioned it as 'digital gold'. Risk appetite in broader markets declined with VIX rising to 18.2.",
      impact: "medium",
    },
    {
      id: "news-009",
      timestamp: new Date(now - 25200000).toISOString(),
      headline: "Whale accumulation: Addresses holding 1K+ BTC add 28,000 BTC in past week",
      source: "Santiment",
      sentiment: "bullish",
      relevance: 0.87,
      markets: ["BTC/USD"],
      summary: "On-chain data shows large holders (1,000+ BTC wallets) accumulated 28,000 BTC ($2.3B) over the past 7 days, the largest weekly accumulation since November 2023. Exchange balances dropped to a 5-year low of 2.26M BTC. The supply squeeze narrative is strengthening as available supply on exchanges decreases while ETF inflows increase.",
      impact: "high",
    },
    {
      id: "news-010",
      timestamp: new Date(now - 28800000).toISOString(),
      headline: "Japan's BOJ maintains negative rate stance — Yen weakens to 155/USD",
      source: "Nikkei Asia",
      sentiment: "neutral",
      relevance: 0.72,
      markets: ["BTC/USD", "XAUUSD"],
      summary: "Bank of Japan held rates steady, disappointing hawks who expected tightening. The Yen weakened past 155 to the dollar. This supports the broader 'currency debasement' narrative that benefits hard assets like Bitcoin and gold. Japanese institutional investors have been increasing exposure to dollar-denominated assets including crypto.",
      impact: "medium",
    },
    {
      id: "news-011",
      timestamp: new Date(now - 32400000).toISOString(),
      headline: "Tether treasury prints $1B USDT on Ethereum — largest single mint in 6 months",
      source: "Whale Alert",
      sentiment: "bullish",
      relevance: 0.80,
      markets: ["BTC/USD", "ETH/USD", "SOL/USD"],
      summary: "Tether minted $1B USDT in a single transaction, typically a leading indicator of incoming buy pressure. Historically, large USDT mints have preceded BTC rallies within 48-72 hours as the new stablecoins are deployed into the market. Total USDT supply now exceeds $145B.",
      impact: "medium",
    },
    {
      id: "news-012",
      timestamp: new Date(now - 36000000).toISOString(),
      headline: "SEC Commissioner signals openness to broader crypto regulation framework",
      source: "WSJ",
      sentiment: "bullish",
      relevance: 0.83,
      markets: ["ETH/USD", "SOL/USD"],
      summary: "SEC Commissioner Hester Peirce outlined a potential regulatory framework that could provide clarity for altcoins and DeFi protocols. The proposal includes safe harbour provisions for token projects and clearer guidelines on what constitutes a security. Market participants view this as a positive shift from enforcement-first approach.",
      impact: "medium",
    },
  ];
}

function buildDecisions(): TradingDecision[] {
  const now = Date.now();
  const rng = seededRandom(42);

  const decisions: TradingDecision[] = [
    {
      id: "td-1001",
      timestamp: new Date(now - 180000).toISOString(),
      market: "BTC/USD",
      strategy: "trend_follow",
      direction: "long",
      confidence: 82,
      thesis: "BTC maintaining bullish structure above EMA(20) at $83,180 with ADX at 31.2 confirming trend strength. Pullback to VWAP ($83,920) found support with volume pickup. ETF inflows at $780M yesterday signal institutional accumulation. DXY weakness below 104 provides macro tailwind. Targeting $87,000 resistance with stop below EMA(50) at $81,450.",
      regime: "trending",
      volumeRatio: 1.85,
      reasonCode: "trend_pullback_bounce",
      status: "executed",
      expectedMove: 2.9,
      expectedCost: 8.50,
      invalidationRule: "Close below EMA(50) at $81,450 on 4H candle",
      riskBucket: "medium",
      dataQualityScore: 0.96,
      slippageEstimate: 0.03,
      modelVersion: "v0.4.2-paper",
      fullPayload: {
        model: "v0.4.2-paper",
        market: "BTC/USD",
        direction: "long",
        confidence: 82,
        regime: "trending",
        paperMode: true,
        entryPrice: 84200,
        targetPrice: 87000,
        stopLoss: 81450,
        positionSize: "2% of paper capital",
        riskReward: 2.1,
        features: { rsi14: 62.4, macdHistogram: 86.3, adx: 31.2, bbWidth: 6.2, atr14: 1850, volume24h: 42.8e9, ema20: 83180, ema50: 81450, vwap: 83920, fundingRate: 0.0082 },
        catalysts: ["Fed rate pause signal", "ETF inflows $780M", "DXY below 104", "Whale accumulation 28K BTC"],
        risks: ["Geopolitical escalation", "Resistance at $85,500", "Funding rate elevated"],
      },
      createdAt: new Date(now - 180000).toISOString(),
      updatedAt: new Date(now - 180000).toISOString(),
    },
    {
      id: "td-1002",
      timestamp: new Date(now - 600000).toISOString(),
      market: "XAUUSD",
      strategy: "momentum_breakout",
      direction: "long",
      confidence: 78,
      thesis: "Gold breaking above $3,120 consolidation with volume 1.6x average. Central bank buying at 290 tonnes Q1 provides structural demand floor. DXY weakness and geopolitical risk premium support continuation. RSI at 64.1 has room to run before overbought. Targeting $3,180 resistance.",
      regime: "trending",
      volumeRatio: 1.62,
      reasonCode: "breakout_confirmed",
      status: "executed",
      expectedMove: 1.6,
      expectedCost: 3.20,
      invalidationRule: "Close below $3,080 support on daily",
      riskBucket: "low",
      dataQualityScore: 0.94,
      slippageEstimate: 0.01,
      modelVersion: "v0.4.2-paper",
      fullPayload: {
        model: "v0.4.2-paper",
        market: "XAUUSD",
        direction: "long",
        confidence: 78,
        regime: "trending",
        paperMode: true,
        entryPrice: 3125,
        targetPrice: 3180,
        stopLoss: 3080,
        positionSize: "1.5% of paper capital",
        riskReward: 1.22,
        features: { rsi14: 64.1, macdHistogram: 5.4, adx: 28.7, bbWidth: 4.5, atr14: 28.5, vwap: 3112 },
        catalysts: ["Central bank buying 290t Q1", "DXY below 104", "Geopolitical risk premium"],
        risks: ["Profit-taking near ATH", "DXY reversal risk"],
      },
      createdAt: new Date(now - 600000).toISOString(),
      updatedAt: new Date(now - 600000).toISOString(),
    },
    {
      id: "td-1003",
      timestamp: new Date(now - 1200000).toISOString(),
      market: "ETH/USD",
      strategy: "mean_reversion",
      direction: "long",
      confidence: 61,
      thesis: "ETH ranging between $1,860-$1,940 with ADX at 18.4 confirming no trend. Price touching lower Bollinger Band ($1,860) with RSI at 47.8 and declining. Stochastic RSI at 0.35 suggests oversold within range. Targeting mean reversion to EMA(20) at $1,910. However, ETH/BTC ratio weakness and below EMA(200) cap upside conviction.",
      regime: "ranging",
      volumeRatio: 0.94,
      reasonCode: "range_low_bounce",
      status: "executed",
      expectedMove: 1.1,
      expectedCost: 4.80,
      invalidationRule: "Close below $1,820 (range breakdown)",
      riskBucket: "medium",
      dataQualityScore: 0.91,
      slippageEstimate: 0.05,
      modelVersion: "v0.4.2-paper",
      fullPayload: {
        model: "v0.4.2-paper",
        market: "ETH/USD",
        direction: "long",
        confidence: 61,
        regime: "ranging",
        paperMode: true,
        entryPrice: 1880,
        targetPrice: 1910,
        stopLoss: 1820,
        positionSize: "1% of paper capital",
        riskReward: 0.5,
        features: { rsi14: 47.8, macdHistogram: -4.3, adx: 18.4, bbWidth: 5.3, atr14: 62, stochRsi: 0.35, mfi: 42.3 },
        catalysts: ["Range low support", "Pectra upgrade catalyst"],
        risks: ["Below EMA(200)", "ETH/BTC ratio weakness", "Low volume"],
      },
      createdAt: new Date(now - 1200000).toISOString(),
      updatedAt: new Date(now - 1200000).toISOString(),
    },
    {
      id: "td-1004",
      timestamp: new Date(now - 2400000).toISOString(),
      market: "SOL/USD",
      strategy: "momentum_breakout",
      direction: "long",
      confidence: 74,
      thesis: "SOL surging 4.5% with volume 2.1x average. DEX volume exceeding ETH for 5th consecutive week validates ecosystem strength. ADX at 34.6 with strong directional movement. RSI at 68.9 approaching overbought but not yet there. Breaking above $134 with next resistance at $138.",
      regime: "volatile",
      volumeRatio: 2.14,
      reasonCode: "volume_spike",
      status: "executed",
      expectedMove: 3.8,
      expectedCost: 12.50,
      invalidationRule: "Close below $128 support",
      riskBucket: "high",
      dataQualityScore: 0.89,
      slippageEstimate: 0.08,
      modelVersion: "v0.4.2-paper",
      fullPayload: {
        model: "v0.4.2-paper",
        market: "SOL/USD",
        direction: "long",
        confidence: 74,
        regime: "volatile",
        paperMode: true,
        entryPrice: 133.50,
        targetPrice: 138.00,
        stopLoss: 128.00,
        positionSize: "1% of paper capital",
        riskReward: 0.82,
        features: { rsi14: 68.9, macdHistogram: 2.7, adx: 34.6, atr14: 8.2, volume24h: 4.8e9, stochRsi: 0.82 },
        catalysts: ["DEX volume dominance", "Ecosystem growth", "USDT mint $1B"],
        risks: ["Overbought RSI approaching 70", "High volatility environment", "Elevated slippage"],
      },
      createdAt: new Date(now - 2400000).toISOString(),
      updatedAt: new Date(now - 2400000).toISOString(),
    },
    {
      id: "td-1005",
      timestamp: new Date(now - 3600000).toISOString(),
      market: "BTC/USD",
      strategy: "volatility_squeeze",
      direction: "long",
      confidence: 68,
      thesis: "4H Bollinger Band width contracted to 20-period low before latest move. Keltner Channels were inside BBands (classic squeeze). Breakout to the upside confirmed by MACD cross and volume expansion. Targeting 2.5x squeeze range for $87,200. Fed rate pause catalyst provides fundamental support.",
      regime: "low_vol",
      volumeRatio: 1.92,
      reasonCode: "squeeze_breakout",
      status: "executed",
      expectedMove: 3.4,
      expectedCost: 6.80,
      invalidationRule: "Price re-enters squeeze range below $83,000",
      riskBucket: "medium",
      dataQualityScore: 0.93,
      slippageEstimate: 0.04,
      modelVersion: "v0.4.2-paper",
      fullPayload: {
        model: "v0.4.2-paper",
        market: "BTC/USD",
        direction: "long",
        confidence: 68,
        regime: "low_vol → breakout",
        paperMode: true,
        entryPrice: 83500,
        targetPrice: 87200,
        stopLoss: 82800,
        positionSize: "1% of paper capital",
        riskReward: 5.28,
        features: { rsi14: 58.2, bbWidth: 3.1, atr14: 1200, adx: 22.5, squeezeCandles: 14, keltnerInside: true },
        catalysts: ["BB squeeze resolution", "Fed pause signal", "Volume expansion"],
        risks: ["False breakout if volume fades", "Could re-enter range"],
      },
      createdAt: new Date(now - 3600000).toISOString(),
      updatedAt: new Date(now - 3600000).toISOString(),
    },
    {
      id: "td-1006",
      timestamp: new Date(now - 5400000).toISOString(),
      market: "ETH/USD",
      strategy: "trend_follow",
      direction: "short",
      confidence: 55,
      thesis: "ETH below EMA(200) at $2,180 — structural bearish. EMA(20) crossing below EMA(50) forming death cross. However, ADX only 18.4 suggesting weak trend. Low conviction short targeting $1,860 support. Position size reduced due to low confidence.",
      regime: "ranging",
      volumeRatio: 0.78,
      reasonCode: "weak_trend_signal",
      status: "skipped",
      expectedMove: 2.1,
      expectedCost: 5.20,
      invalidationRule: "Close above EMA(50) at $1,925",
      riskBucket: "medium",
      dataQualityScore: 0.88,
      slippageEstimate: 0.06,
      modelVersion: "v0.4.2-paper",
      fullPayload: {
        model: "v0.4.2-paper",
        market: "ETH/USD",
        direction: "short",
        confidence: 55,
        regime: "ranging",
        paperMode: true,
        skipReason: "Confidence below 60% threshold — ADX too low for trend follow strategy",
        features: { rsi14: 47.8, adx: 18.4, ema20: 1910, ema50: 1925, ema200: 2180 },
      },
      createdAt: new Date(now - 5400000).toISOString(),
      updatedAt: new Date(now - 5400000).toISOString(),
    },
  ];

  for (let i = 6; i < 30; i++) {
    const r = () => Math.floor(rng() * 1000) / 10;
    const markets = ["BTC/USD", "ETH/USD", "XAUUSD", "SOL/USD"];
    const strats = ["momentum_breakout", "mean_reversion", "trend_follow", "volatility_squeeze", "regime_shift", "order_flow_scalp"];
    const dirs: ("long" | "short")[] = ["long", "short"];
    const regimes = ["trending", "ranging", "volatile", "low_vol"];
    const codes = ["strong_momentum", "support_bounce", "breakout_confirmed", "regime_alignment", "volume_spike", "squeeze_breakout", "trend_pullback_bounce", "range_low_bounce", "divergence_signal"];
    const buckets = ["low", "medium", "high"];
    const statuses = ["executed", "executed", "executed", "skipped", "pending"];
    const mkt = markets[i % markets.length];
    const dir = dirs[i % 2];
    const conf = Math.round(50 + rng() * 45);

    decisions.push({
      id: `td-${1000 + i + 1}`,
      timestamp: new Date(now - i * 720000).toISOString(),
      market: mkt,
      strategy: strats[i % strats.length],
      direction: dir,
      confidence: conf,
      thesis: generateThesisDeep(mkt, dir, strats[i % strats.length], Math.floor(rng() * 100)),
      regime: regimes[i % regimes.length],
      volumeRatio: Math.round((0.6 + rng() * 2.5) * 100) / 100,
      reasonCode: codes[i % codes.length],
      status: statuses[i % statuses.length],
      expectedMove: Math.round((0.5 + rng() * 4.5) * 100) / 100,
      expectedCost: Math.round(rng() * 15 * 100) / 100,
      invalidationRule: generateInvalidation(mkt, dir),
      riskBucket: buckets[i % buckets.length],
      dataQualityScore: Math.round((0.82 + rng() * 0.17) * 100) / 100,
      slippageEstimate: Math.round(rng() * 0.12 * 100) / 100,
      modelVersion: "v0.4.2-paper",
      fullPayload: { model: "v0.4.2-paper", market: mkt, direction: dir, strategy: strats[i % strats.length], confidence: conf, paperMode: true },
      createdAt: new Date(now - i * 720000).toISOString(),
      updatedAt: new Date(now - i * 720000).toISOString(),
    });
  }

  return decisions;
}

function generateThesisDeep(market: string, direction: string, strategy: string, seed: number): string {
  const theses: Record<string, string[]> = {
    "BTC/USD": [
      "Bitcoin holding above key EMA cluster with on-chain metrics showing continued accumulation by long-term holders. Exchange outflows accelerating — supply squeeze dynamics in play. Funding rates neutral suggesting room for leverage-driven move higher.",
      "BTC testing $85K resistance with declining momentum. RSI divergence forming on 4H — price making higher highs but RSI making lower highs. Volume thinning on approach to resistance. Caution warranted, but trend structure still intact above EMA(50).",
      "Hash rate at ATH (850 EH/s) confirms miner conviction post-halving. MVRV ratio at 2.1 suggests mid-cycle, not overheated. Realized price at $35,200 means most holders are in profit, reducing sell pressure from capitulation.",
      "BTC correlation with gold strengthening (0.42 over 30 days) as both benefit from dollar weakness narrative. Institutional flows via ETFs provide a structural bid that didn't exist in previous cycles. Options market shows bullish skew with 25-delta call premium at +8.2%.",
    ],
    "ETH/USD": [
      "ETH/BTC ratio at multi-year lows (0.0225) creating potential mean-reversion opportunity. Pectra upgrade catalyst approaching. However, Layer 2 revenue capture and reduced mainnet fee revenue create structural headwinds for ETH value accrual.",
      "Ethereum staking yields at 3.8% APR provide downside floor as institutional stakers are less likely to sell. However, ETH supply on exchanges has been increasing for 3 weeks — a bearish divergence from the broader market.",
      "DeFi TVL recovering on Ethereum ($48B) after Q1 decline. Restaking narrative via EigenLayer adding utility but also complexity risk. ETH implied volatility at 52% is 30% below BTC's, suggesting the options market expects ETH to underperform on a vol-adjusted basis.",
    ],
    "XAUUSD": [
      "Gold approaching all-time highs with central bank demand providing structural floor. Real yields declining as inflation expectations remain anchored while nominal rates may fall. The gold-to-S&P500 ratio is at its most attractive level in 3 years.",
      "XAUUSD benefiting from de-dollarisation trend — BRICS nations actively diversifying reserves. Physical demand from China and India remains robust. Gold miners' all-in sustaining cost averaging $1,350/oz provides significant margin cushion at current prices.",
      "Gold volatility (GVZ) at 14.2 is historically low, suggesting potential for explosive move. COT data shows managed money net long at +185K contracts — elevated but not extreme. Commercial hedgers' short position is large, which typically occurs during strong uptrends.",
    ],
    "SOL/USD": [
      "Solana ecosystem metrics at all-time highs: 2.4M daily active addresses, $18.2B weekly DEX volume, network fees hitting records. The SOL/ETH ratio breakout suggests institutional rotation. Validator economics strong with staking yield at 7.2%.",
      "SOL showing high-beta behavior versus BTC with a 90-day beta of 1.8. While upside is amplified, drawdowns will be severe if BTC corrects. Funding rates elevated at 0.012% suggests leveraged longs are crowded — risk of liquidation cascade on any pullback.",
      "Solana's memecoin and DePIN narratives driving retail engagement. Firedancer client approaching mainnet — potential catalyst for institutional confidence. However, network has had 4 outages in past 12 months — reliability risk remains a concern for large allocators.",
    ],
  };
  const pool = theses[market] || theses["BTC/USD"];
  return pool[seed % pool.length];
}

function generateInvalidation(market: string, direction: string): string {
  const levels: Record<string, { longInv: string; shortInv: string }> = {
    "BTC/USD": { longInv: "Close below $81,450 (EMA-50) on 4H", shortInv: "Close above $85,500 on 4H" },
    "ETH/USD": { longInv: "Close below $1,820 (range low)", shortInv: "Close above $1,940 (range high)" },
    "XAUUSD": { longInv: "Close below $3,080 on daily", shortInv: "Close above $3,150 on daily" },
    "SOL/USD": { longInv: "Close below $128 on 4H", shortInv: "Close above $138 on 4H" },
  };
  const l = levels[market] || levels["BTC/USD"];
  return direction === "long" ? l.longInv : l.shortInv;
}

function buildPositions(): OpenPosition[] {
  return [
    {
      id: "pos-001",
      symbol: "BTC/USD",
      side: "long",
      entryPrice: 83850.00,
      currentPrice: 84532.40,
      unrealizedPnl: 682.40,
      stopPrice: 81450.00,
      duration: "3h 45m",
      status: "open",
    },
    {
      id: "pos-002",
      symbol: "XAUUSD",
      side: "long",
      entryPrice: 3105.20,
      currentPrice: 3128.50,
      unrealizedPnl: 23.30,
      stopPrice: 3080.00,
      duration: "5h 12m",
      status: "open",
    },
    {
      id: "pos-003",
      symbol: "ETH/USD",
      side: "long",
      entryPrice: 1882.40,
      currentPrice: 1898.60,
      unrealizedPnl: 16.20,
      stopPrice: 1820.00,
      duration: "1h 38m",
      status: "open",
    },
    {
      id: "pos-004",
      symbol: "SOL/USD",
      side: "long",
      entryPrice: 131.80,
      currentPrice: 134.20,
      unrealizedPnl: 2.40,
      stopPrice: 128.00,
      duration: "2h 22m",
      status: "open",
    },
  ];
}

function buildOutcomes(): TradeOutcome[] {
  const now = Date.now();
  return [
    { id: "out-001", symbol: "BTC/USD", strategy: "trend_follow", direction: "long", entryPrice: 82100, exitPrice: 84200, realizedPnl: 2100, duration: "18h 30m", slippage: 0.03, outcome: "win", timestamp: new Date(now - 3600000).toISOString() },
    { id: "out-002", symbol: "ETH/USD", strategy: "mean_reversion", direction: "long", entryPrice: 1920, exitPrice: 1895, realizedPnl: -25, duration: "2h 15m", slippage: 0.05, outcome: "loss", timestamp: new Date(now - 7200000).toISOString() },
    { id: "out-003", symbol: "XAUUSD", strategy: "momentum_breakout", direction: "long", entryPrice: 3065, exitPrice: 3105, realizedPnl: 40, duration: "6h 45m", slippage: 0.01, outcome: "win", timestamp: new Date(now - 10800000).toISOString() },
    { id: "out-004", symbol: "BTC/USD", strategy: "volatility_squeeze", direction: "long", entryPrice: 80500, exitPrice: 82800, realizedPnl: 2300, duration: "8h 10m", slippage: 0.04, outcome: "win", timestamp: new Date(now - 14400000).toISOString() },
    { id: "out-005", symbol: "SOL/USD", strategy: "momentum_breakout", direction: "long", entryPrice: 125.40, exitPrice: 122.80, realizedPnl: -2.60, duration: "1h 50m", slippage: 0.09, outcome: "loss", timestamp: new Date(now - 18000000).toISOString() },
    { id: "out-006", symbol: "BTC/USD", strategy: "regime_shift", direction: "long", entryPrice: 78200, exitPrice: 81500, realizedPnl: 3300, duration: "36h 00m", slippage: 0.02, outcome: "win", timestamp: new Date(now - 21600000).toISOString() },
    { id: "out-007", symbol: "XAUUSD", strategy: "trend_follow", direction: "long", entryPrice: 3020, exitPrice: 3068, realizedPnl: 48, duration: "14h 20m", slippage: 0.01, outcome: "win", timestamp: new Date(now - 25200000).toISOString() },
    { id: "out-008", symbol: "ETH/USD", strategy: "order_flow_scalp", direction: "short", entryPrice: 1945, exitPrice: 1938, realizedPnl: 7, duration: "12m", slippage: 0.04, outcome: "win", timestamp: new Date(now - 28800000).toISOString() },
    { id: "out-009", symbol: "BTC/USD", strategy: "momentum_breakout", direction: "long", entryPrice: 79500, exitPrice: 78800, realizedPnl: -700, duration: "45m", slippage: 0.06, outcome: "loss", timestamp: new Date(now - 32400000).toISOString() },
    { id: "out-010", symbol: "SOL/USD", strategy: "trend_follow", direction: "long", entryPrice: 118.20, exitPrice: 126.50, realizedPnl: 8.30, duration: "22h 15m", slippage: 0.07, outcome: "win", timestamp: new Date(now - 36000000).toISOString() },
    { id: "out-011", symbol: "XAUUSD", strategy: "mean_reversion", direction: "long", entryPrice: 2998, exitPrice: 3025, realizedPnl: 27, duration: "3h 40m", slippage: 0.02, outcome: "win", timestamp: new Date(now - 43200000).toISOString() },
    { id: "out-012", symbol: "BTC/USD", strategy: "trend_follow", direction: "long", entryPrice: 76800, exitPrice: 79200, realizedPnl: 2400, duration: "28h 50m", slippage: 0.03, outcome: "win", timestamp: new Date(now - 50400000).toISOString() },
    { id: "out-013", symbol: "ETH/USD", strategy: "volatility_squeeze", direction: "long", entryPrice: 1880, exitPrice: 1865, realizedPnl: -15, duration: "1h 30m", slippage: 0.08, outcome: "loss", timestamp: new Date(now - 57600000).toISOString() },
    { id: "out-014", symbol: "BTC/USD", strategy: "order_flow_scalp", direction: "long", entryPrice: 77400, exitPrice: 77680, realizedPnl: 280, duration: "8m", slippage: 0.02, outcome: "win", timestamp: new Date(now - 64800000).toISOString() },
    { id: "out-015", symbol: "XAUUSD", strategy: "volatility_squeeze", direction: "long", entryPrice: 2975, exitPrice: 3010, realizedPnl: 35, duration: "5h 20m", slippage: 0.02, outcome: "win", timestamp: new Date(now - 72000000).toISOString() },
    { id: "out-016", symbol: "SOL/USD", strategy: "regime_shift", direction: "long", entryPrice: 108.50, exitPrice: 118.80, realizedPnl: 10.30, duration: "48h 00m", slippage: 0.05, outcome: "win", timestamp: new Date(now - 86400000).toISOString() },
    { id: "out-017", symbol: "ETH/USD", strategy: "momentum_breakout", direction: "short", entryPrice: 1960, exitPrice: 1975, realizedPnl: -15, duration: "2h 10m", slippage: 0.07, outcome: "loss", timestamp: new Date(now - 93600000).toISOString() },
    { id: "out-018", symbol: "BTC/USD", strategy: "mean_reversion", direction: "long", entryPrice: 75200, exitPrice: 76400, realizedPnl: 1200, duration: "4h 30m", slippage: 0.03, outcome: "win", timestamp: new Date(now - 100800000).toISOString() },
    { id: "out-019", symbol: "XAUUSD", strategy: "momentum_breakout", direction: "long", entryPrice: 2940, exitPrice: 2978, realizedPnl: 38, duration: "9h 15m", slippage: 0.01, outcome: "win", timestamp: new Date(now - 108000000).toISOString() },
    { id: "out-020", symbol: "BTC/USD", strategy: "trend_follow", direction: "long", entryPrice: 73500, exitPrice: 75800, realizedPnl: 2300, duration: "32h 40m", slippage: 0.04, outcome: "win", timestamp: new Date(now - 115200000).toISOString() },
  ];
}

function buildPerformance(outcomes: TradeOutcome[]): TradingPerformance {
  const wins = outcomes.filter(o => o.outcome === "win");
  const losses = outcomes.filter(o => o.outcome === "loss");
  const avgWin = wins.length > 0 ? Math.round(wins.reduce((s, o) => s + o.realizedPnl, 0) / wins.length * 100) / 100 : 0;
  const avgLoss = losses.length > 0 ? Math.round(losses.reduce((s, o) => s + Math.abs(o.realizedPnl), 0) / losses.length * 100) / 100 : 0;
  const winRate = outcomes.length > 0 ? wins.length / outcomes.length : 0;
  const expectancy = Math.round((winRate * avgWin - (1 - winRate) * avgLoss) * 100) / 100;
  const totalWinPnl = wins.reduce((s, o) => s + o.realizedPnl, 0);
  const totalLossPnl = losses.reduce((s, o) => s + Math.abs(o.realizedPnl), 0);
  const profitFactor = totalLossPnl > 0 ? Math.round((totalWinPnl / totalLossPnl) * 100) / 100 : 0;

  let consWins = 0, consLosses = 0, curWins = 0, curLosses = 0;
  for (const o of outcomes) {
    if (o.outcome === "win") { curWins++; curLosses = 0; consWins = Math.max(consWins, curWins); }
    else { curLosses++; curWins = 0; consLosses = Math.max(consLosses, curLosses); }
  }

  let cumPnl = 0;
  let peak = 0;
  let maxDD = 0;
  const pnlSeries = outcomes
    .slice()
    .reverse()
    .map((o) => {
      cumPnl += o.realizedPnl;
      if (cumPnl > peak) peak = cumPnl;
      const dd = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
      return { date: o.timestamp, value: Math.round(cumPnl * 100) / 100 };
    });

  const totalPnl = Math.round(cumPnl * 100) / 100;
  const returns = outcomes.map(o => o.realizedPnl);
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? Math.round((mean / stdDev) * Math.sqrt(252) * 100) / 100 : 0;

  return {
    avgWin,
    avgLoss,
    expectancy,
    consecutiveWins: consWins,
    consecutiveLosses: consLosses,
    sharpeRatio,
    profitFactor,
    maxDrawdown: Math.round(maxDD * 100) / 100,
    totalPnl,
    pnlSeries,
  };
}

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

  cachedData = { state, decisions, positions, recent_outcomes: outcomes, performance, news, marketContext, strategies };
  cacheTimestamp = now;

  return cachedData;
}
