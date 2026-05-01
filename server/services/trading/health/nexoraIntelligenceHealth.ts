
import { getMarketCandleCoverage } from "../marketData/nexoraMarketCandlesService";
import { calculateNexoraIndicatorSnapshot } from "../indicators/nexoraIndicatorEngine";
import { getNexoraSetupPromotions } from "../promotion/nexoraSetupPromotionEngine";

export async function getNexoraIntelligenceHealth() {
  const [coverage, indicators, promotions] = await Promise.allSettled([
    getMarketCandleCoverage(),
    calculateNexoraIndicatorSnapshot({ symbols: ["BTC/USD", "ETH/USD", "SOL/USD"], timeframes: ["1m", "5m"] }),
    getNexoraSetupPromotions(),
  ]);

  return {
    ok: true,
    service: "nexora_intelligence_health",
    paperOnly: true,
    candles: coverage.status === "fulfilled" ? coverage.value : { ok: false, error: String(coverage.reason) },
    indicators: indicators.status === "fulfilled" ? indicators.value : { ok: false, error: String(indicators.reason) },
    promotions: promotions.status === "fulfilled" ? promotions.value : { ok: false, error: String(promotions.reason) },
    updatedAt: new Date().toISOString(),
  };
}
