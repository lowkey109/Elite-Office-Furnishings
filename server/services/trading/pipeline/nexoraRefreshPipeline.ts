import { syncNexoraMarketCandles } from "../marketData/nexoraMarketCandlesService";
import { refreshNexoraSetupPromotions } from "../promotion/nexoraSetupPromotionEngine";
import { refreshNexoraCandidateAllowlist } from "../candidates/nexoraCandidateAllowlist";
import { getNexoraPlatformSummary } from "../platform/nexoraPlatformSummary";
import { runNexoraReinforcementScoring } from "../autonomy/nexoraReinforcementScoring";
import { runNexoraStrategyDecayDetection } from "../autonomy/nexoraStrategyDecayEngine";
import { runNexoraStrategyEvolution } from "../autonomy/nexoraStrategyEvolution";

export async function runNexoraRefreshPipeline() {
  const candles = await syncNexoraMarketCandles({
    symbols: ["BTC/USD", "ETH/USD", "SOL/USD"],
    timeframes: ["1m", "5m"],
    limit: 200,
  }).catch((err) => ({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }));

  const promotions = await refreshNexoraSetupPromotions().catch((err) => ({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }));

  const allowlist = await refreshNexoraCandidateAllowlist().catch((err) => ({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }));

  const reinforcement = await runNexoraReinforcementScoring().catch((err) => ({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }));

  const decay = await runNexoraStrategyDecayDetection().catch((err) => ({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }));

  const evolution = await runNexoraStrategyEvolution().catch((err) => ({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }));

  const summary = await getNexoraPlatformSummary().catch((err) => ({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }));

  return {
    ok: true,
    service: "nexora_refresh_pipeline",
    paperOnly: true,
    candles,
    promotions,
    allowlist,
    reinforcement,
    decay,
    evolution,
    summary,
    updatedAt: new Date().toISOString(),
  };
}
