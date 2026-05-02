import { getNexoraChartIntelligence } from "../chartIntel/nexoraChartIntelligenceEngine";
import { isNexoraStrategyQuarantined } from "../quality/nexoraStrategyQuarantine";

const SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD"];
const TIMEFRAMES = ["5m", "15m", "1h"];

function chooseSetup(chart: any) {
  const structure = chart?.chart?.structure;
  const trend = chart?.chart?.trend;
  const bias = String(chart?.chart?.bias || "");
  const rsi = Number(chart?.indicators?.rsi || 50);

  if (structure === "breakout" && bias.includes("bullish")) return { strategy: "momentum_breakout", direction: "long" as const };
  if (structure === "breakdown" && bias.includes("bearish")) return { strategy: "momentum_breakout", direction: "short" as const };
  if (trend === "uptrend" && rsi < 65) return { strategy: "trend_follow", direction: "long" as const };
  if (trend === "downtrend" && rsi > 35) return { strategy: "trend_follow", direction: "short" as const };
  if (chart?.chart?.nearSupport && rsi < 40) return { strategy: "mean_reversion", direction: "long" as const };
  if (chart?.chart?.nearResistance && rsi > 60) return { strategy: "mean_reversion", direction: "short" as const };

  return null;
}

export async function discoverNexoraCandidatesV2() {
  const discovered: any[] = [];
  const rejected: any[] = [];

  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES) {
      const chart = await getNexoraChartIntelligence({ symbol, timeframe, limit: 120 }).catch(() => null);

      if (!chart?.ok) {
        rejected.push({ symbol, timeframe, reason: "Chart intelligence unavailable." });
        continue;
      }

      const setup = chooseSetup(chart);

      if (!setup) {
        rejected.push({ symbol, timeframe, reason: "No strong chart setup.", chart: chart.chart });
        continue;
      }

      const quarantined = await isNexoraStrategyQuarantined({
        symbol,
        strategy: setup.strategy,
        direction: setup.direction,
      }).catch(() => null);

      if (quarantined) {
        rejected.push({
          symbol,
          timeframe,
          ...setup,
          reason: "Rejected by quarantine.",
          quarantineReason: quarantined.reason,
        });
        continue;
      }

      const score =
        Number(chart.chart?.confidence || 50) +
        (timeframe === "1h" ? 8 : timeframe === "15m" ? 5 : 0);

      discovered.push({
        symbol,
        timeframe,
        ...setup,
        score,
        chart: chart.chart,
        indicators: chart.indicators,
        reason: "Fresh chart-intelligence setup passed quarantine.",
      });
    }
  }

  return {
    ok: true,
    service: "nexora_candidate_discovery_v2",
    paperOnly: true,
    discovered: discovered.sort((a, b) => b.score - a.score),
    rejected,
    updatedAt: new Date().toISOString(),
  };
}
