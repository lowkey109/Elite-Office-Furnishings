import { runOfficeMovRadarScan } from "./services/officeMovRadarService";
import { runDealHunterScan } from "./services/dealHunter";

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

  const durationMs = Date.now() - start;
  const success = errors.length === 0;

  const message = opportunities.length === 0
    ? "Nexora complete — no new signals found this cycle"
    : `Nexora complete — ${opportunities.length} signals captured (${radarResults.length} radar, ${dealResults.length} deal) in ${(durationMs / 1000).toFixed(1)}s`;

  console.log(success ? `✅ NEXORA COMPLETE — ${message}` : `⚠️  NEXORA FINISHED WITH ERRORS — ${errors.length} error(s)`);

  return {
    success,
    processed: opportunities.length,
    outreachRuns: 0,
    outreachFailed: 0,
    radarSignals: radarResults.length,
    dealSignals: dealResults.length,
    errors,
    message,
    durationMs,
  };
}
