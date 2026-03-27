import { runOfficeMovRadarScan } from "./services/officeMovRadarService";
import { runDealHunterScan } from "./services/dealHunter";
import { runManufacturerOutreach } from "./services/aiManufacturerOutreach";

export interface NexoraResult {
  success: boolean;
  processed: number;
  outreachRuns: number;
  outreachFailed: number;
  radarSignals: number;
  dealSignals: number;
  errors: string[];
  message: string;
  durationMs: number;
}

export async function runNexoraEngine(): Promise<NexoraResult> {
  const start = Date.now();
  const errors: string[] = [];

  console.log("🚀 NEXORA ENGINE STARTING");

  let radarResults: any[] = [];
  let dealResults: any[] = [];

  try {
    const raw = await runOfficeMovRadarScan();
    radarResults = Array.isArray(raw) ? raw : [];
    console.log(`📡 Radar signals: ${radarResults.length}`);
  } catch (err: any) {
    const msg = `Radar scan failed: ${err?.message ?? "unknown error"}`;
    console.error("❌", msg);
    errors.push(msg);
  }

  try {
    const raw = await runDealHunterScan();
    dealResults = Array.isArray(raw) ? raw : (raw?.signals ?? []);
    console.log(`🎯 Deal signals: ${dealResults.length} (created: ${(raw as any)?.created ?? 0}, deduplicated: ${(raw as any)?.deduplicated ?? 0})`);
  } catch (err: any) {
    const msg = `Deal hunter scan failed: ${err?.message ?? "unknown error"}`;
    console.error("❌", msg);
    errors.push(msg);
  }

  const opportunities = [...radarResults, ...dealResults];
  console.log(`📊 Total opportunities to process: ${opportunities.length}`);

  let outreachRuns = 0;
  let outreachFailed = 0;

  for (const opportunity of opportunities) {
    try {
      await runManufacturerOutreach(
        { body: { opportunity } } as any,
        {
          json: () => {},
          status: () => ({ json: () => {} }),
        } as any
      );
      outreachRuns++;
      console.log(`✉️  Outreach sent (${outreachRuns}/${opportunities.length}): ${opportunity?.companyName ?? opportunity?.name ?? "unknown"}`);
    } catch (err: any) {
      outreachFailed++;
      const msg = `Outreach failed for ${opportunity?.companyName ?? "unknown"}: ${err?.message ?? "unknown error"}`;
      console.error("❌", msg);
      errors.push(msg);
    }
  }

  const durationMs = Date.now() - start;
  const success = errors.length === 0 || outreachRuns > 0;

  const message = opportunities.length === 0
    ? "Nexora complete — no new signals found this cycle"
    : `Nexora complete — ${outreachRuns} outreach sent, ${outreachFailed} failed, from ${opportunities.length} signals in ${(durationMs / 1000).toFixed(1)}s`;

  console.log(success ? `✅ NEXORA COMPLETE — ${message}` : `⚠️  NEXORA FINISHED WITH ERRORS — ${errors.length} error(s)`);

  return {
    success,
    processed: opportunities.length,
    outreachRuns,
    outreachFailed,
    radarSignals: radarResults.length,
    dealSignals: dealResults.length,
    errors,
    message,
    durationMs,
  };
}