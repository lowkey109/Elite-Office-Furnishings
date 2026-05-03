import { runNexoraMemorySafeScanner } from "../orchestration/nexoraMemorySafeScanner";
import { getNexoraAdminControls, createNexoraAlert } from "./nexoraAdminControls";

export async function runNexoraControlledMemoryScanner(input: any = {}) {
  const controls = getNexoraAdminControls();
  const settings = controls.settings;

  if (!settings.scannerEnabled) {
    return {
      ok: true,
      service: "nexora_controlled_memory_scanner",
      paperOnly: true,
      action: "SCANNER_PAUSED",
      settings,
      decisions: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const allowedCategories = new Set(settings.categories.map((x: string) => x.toLowerCase()));

  const markets = Array.isArray(input.markets)
    ? input.markets.filter((m: any) => allowedCategories.has(String(m.category || "general").toLowerCase()))
    : [];

  const result: any = await runNexoraMemorySafeScanner({
    ...input,
    bankrollUsd: input.bankrollUsd || settings.bankrollUsd,
    minLiquidityUsd: input.minLiquidityUsd || settings.minLiquidityUsd,
    maxSpreadPct: input.maxSpreadPct || settings.maxSpreadPct,
    maxMarkets: input.maxMarkets || settings.maxMarkets,
    markets,
  });

  for (const d of result.decisions || []) {
    if (d.approved && Math.abs(Number(d.edgePct || 0)) >= settings.alertEdgePct) {
      createNexoraAlert({
        type: "high_edge_memory_signal",
        severity: "high",
        marketId: d.marketId,
        title: d.title,
        edgePct: d.edgePct,
        decision: d,
      });
    }
  }

  return {
    ok: true,
    service: "nexora_controlled_memory_scanner",
    paperOnly: true,
    settings,
    result,
    updatedAt: new Date().toISOString(),
  };
}
