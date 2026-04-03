import type { TradingDecision } from "./types";

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
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

export function buildDecisions(): TradingDecision[] {
  const now = Date.now();
  const rng = seededRandom(42);

  const handCrafted: TradingDecision[] = [
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
        model: "v0.4.2-paper", market: "BTC/USD", direction: "long", confidence: 82, regime: "trending", paperMode: true,
        entryPrice: 84200, targetPrice: 87000, stopLoss: 81450, positionSize: "2% of paper capital", riskReward: 2.1,
        features: { rsi14: 62.4, macdHistogram: 86.3, adx: 31.2, bbWidth: 6.2, atr14: 1850, volume24h: 42.8e9, ema20: 83180, ema50: 81450, vwap: 83920, fundingRate: 0.0082 },
        catalysts: ["Fed rate pause signal", "ETF inflows $780M", "DXY below 104", "Whale accumulation 28K BTC"],
        risks: ["Geopolitical escalation", "Resistance at $85,500", "Funding rate elevated"],
      },
      createdAt: new Date(now - 180000).toISOString(),
      updatedAt: new Date(now - 180000).toISOString(),
      decisionSource: "strategy_engine",
      executionStatus: "entered",
      confidenceThreshold: 60,
      riskAmount: 2000,
      paperCapitalImpact: 84200,
      linkedPositionId: "pos-001",
      sourceMarketSnapshotId: "snap-btc-001",
      sourceNewsIds: ["news-001", "news-002", "news-005", "news-009"],
      strategyVersion: "1.0.0",
      decisionGeneratedAt: new Date(now - 180000).toISOString(),
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
        model: "v0.4.2-paper", market: "XAUUSD", direction: "long", confidence: 78, regime: "trending", paperMode: true,
        entryPrice: 3125, targetPrice: 3180, stopLoss: 3080, positionSize: "1.5% of paper capital", riskReward: 1.22,
        features: { rsi14: 64.1, macdHistogram: 5.4, adx: 28.7, bbWidth: 4.5, atr14: 28.5, vwap: 3112 },
        catalysts: ["Central bank buying 290t Q1", "DXY below 104", "Geopolitical risk premium"],
        risks: ["Profit-taking near ATH", "DXY reversal risk"],
      },
      createdAt: new Date(now - 600000).toISOString(),
      updatedAt: new Date(now - 600000).toISOString(),
      decisionSource: "strategy_engine",
      executionStatus: "entered",
      confidenceThreshold: 60,
      riskAmount: 1500,
      paperCapitalImpact: 3125,
      linkedPositionId: "pos-002",
      sourceMarketSnapshotId: "snap-xau-001",
      sourceNewsIds: ["news-001", "news-003", "news-005", "news-008"],
      strategyVersion: "1.0.0",
      decisionGeneratedAt: new Date(now - 600000).toISOString(),
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
        model: "v0.4.2-paper", market: "ETH/USD", direction: "long", confidence: 61, regime: "ranging", paperMode: true,
        entryPrice: 1880, targetPrice: 1910, stopLoss: 1820, positionSize: "1% of paper capital", riskReward: 0.5,
        features: { rsi14: 47.8, macdHistogram: -4.3, adx: 18.4, bbWidth: 5.3, atr14: 62, stochRsi: 0.35, mfi: 42.3 },
        catalysts: ["Range low support", "Pectra upgrade catalyst"],
        risks: ["Below EMA(200)", "ETH/BTC ratio weakness", "Low volume"],
      },
      createdAt: new Date(now - 1200000).toISOString(),
      updatedAt: new Date(now - 1200000).toISOString(),
      decisionSource: "strategy_engine",
      executionStatus: "entered",
      confidenceThreshold: 60,
      riskAmount: 1000,
      paperCapitalImpact: 1880,
      linkedPositionId: "pos-003",
      sourceMarketSnapshotId: "snap-eth-001",
      sourceNewsIds: ["news-004"],
      strategyVersion: "1.0.0",
      decisionGeneratedAt: new Date(now - 1200000).toISOString(),
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
        model: "v0.4.2-paper", market: "SOL/USD", direction: "long", confidence: 74, regime: "volatile", paperMode: true,
        entryPrice: 133.50, targetPrice: 138.00, stopLoss: 128.00, positionSize: "1% of paper capital", riskReward: 0.82,
        features: { rsi14: 68.9, macdHistogram: 2.7, adx: 34.6, atr14: 8.2, volume24h: 4.8e9, stochRsi: 0.82 },
        catalysts: ["DEX volume dominance", "Ecosystem growth", "USDT mint $1B"],
        risks: ["Overbought RSI approaching 70", "High volatility environment", "Elevated slippage"],
      },
      createdAt: new Date(now - 2400000).toISOString(),
      updatedAt: new Date(now - 2400000).toISOString(),
      decisionSource: "strategy_engine",
      executionStatus: "entered",
      confidenceThreshold: 60,
      riskAmount: 1000,
      paperCapitalImpact: 133.50,
      linkedPositionId: "pos-004",
      sourceMarketSnapshotId: "snap-sol-001",
      sourceNewsIds: ["news-006", "news-011"],
      strategyVersion: "1.0.0",
      decisionGeneratedAt: new Date(now - 2400000).toISOString(),
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
        model: "v0.4.2-paper", market: "BTC/USD", direction: "long", confidence: 68, regime: "low_vol to breakout", paperMode: true,
        entryPrice: 83500, targetPrice: 87200, stopLoss: 82800, positionSize: "1% of paper capital", riskReward: 5.28,
        features: { rsi14: 58.2, bbWidth: 3.1, atr14: 1200, adx: 22.5, squeezeCandles: 14, keltnerInside: true },
        catalysts: ["BB squeeze resolution", "Fed pause signal", "Volume expansion"],
        risks: ["False breakout if volume fades", "Could re-enter range"],
      },
      createdAt: new Date(now - 3600000).toISOString(),
      updatedAt: new Date(now - 3600000).toISOString(),
      decisionSource: "strategy_engine",
      executionStatus: "filled",
      confidenceThreshold: 60,
      riskAmount: 1000,
      paperCapitalImpact: 83500,
      linkedPositionId: null,
      sourceMarketSnapshotId: "snap-btc-001",
      sourceNewsIds: ["news-001", "news-002"],
      strategyVersion: "1.0.0",
      decisionGeneratedAt: new Date(now - 3600000).toISOString(),
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
        model: "v0.4.2-paper", market: "ETH/USD", direction: "short", confidence: 55, regime: "ranging", paperMode: true,
        skipReason: "Confidence below 60% threshold — ADX too low for trend follow strategy",
        features: { rsi14: 47.8, adx: 18.4, ema20: 1910, ema50: 1925, ema200: 2180 },
      },
      createdAt: new Date(now - 5400000).toISOString(),
      updatedAt: new Date(now - 5400000).toISOString(),
      decisionSource: "strategy_engine",
      executionStatus: "rejected",
      confidenceThreshold: 60,
      riskAmount: null,
      paperCapitalImpact: null,
      linkedPositionId: null,
      sourceMarketSnapshotId: "snap-eth-001",
      sourceNewsIds: [],
      strategyVersion: "1.0.0",
      decisionGeneratedAt: new Date(now - 5400000).toISOString(),
    },
  ];

  const seeded: TradingDecision[] = [];
  for (let i = 6; i < 30; i++) {
    const markets = ["BTC/USD", "ETH/USD", "XAUUSD", "SOL/USD"];
    const strats = ["momentum_breakout", "mean_reversion", "trend_follow", "volatility_squeeze", "regime_shift", "order_flow_scalp"];
    const dirs: ("long" | "short")[] = ["long", "short"];
    const regimes = ["trending", "ranging", "volatile", "low_vol"];
    const codes = ["strong_momentum", "support_bounce", "breakout_confirmed", "regime_alignment", "volume_spike", "squeeze_breakout", "trend_pullback_bounce", "range_low_bounce", "divergence_signal"];
    const buckets: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
    const statuses = ["executed", "executed", "executed", "skipped", "pending"];
    const execStatuses: TradingDecision["executionStatus"][] = ["entered", "entered", "filled", "rejected", "pending"];
    const mkt = markets[i % markets.length];
    const dir = dirs[i % 2];
    const conf = Math.round(50 + rng() * 45);
    const ts = new Date(now - i * 720000).toISOString();

    seeded.push({
      id: `td-${1000 + i + 1}`,
      timestamp: ts,
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
      createdAt: ts,
      updatedAt: ts,
      decisionSource: "strategy_engine",
      executionStatus: execStatuses[i % execStatuses.length],
      confidenceThreshold: 60,
      riskAmount: conf >= 60 ? Math.round(500 + rng() * 1500) : null,
      paperCapitalImpact: null,
      linkedPositionId: null,
      sourceMarketSnapshotId: `snap-${mkt.split("/")[0].toLowerCase()}-001`,
      sourceNewsIds: [],
      strategyVersion: "1.0.0",
      decisionGeneratedAt: ts,
    });
  }

  return [...handCrafted, ...seeded];
}
