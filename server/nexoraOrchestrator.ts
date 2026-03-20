import { runOfficeMovRadarScan } from "./services/officeMovRadarService";
import { runDealHunterScan } from "./services/dealHunter";
import { runManufacturerOutreach } from "./services/aiManufacturerOutreach";

export async function runNexoraEngine() {
  try {
    console.log("🚀 NEXORA STARTED");

    const radarResultsRaw = await runOfficeMovRadarScan();
    const dealResultsRaw = await runDealHunterScan();

    const radarResults = Array.isArray(radarResultsRaw) ? radarResultsRaw : [];
    const dealResults = Array.isArray(dealResultsRaw) ? dealResultsRaw : [];

    const opportunities = [...radarResults, ...dealResults];

    console.log(`📡 Signals found: ${opportunities.length}`);

    let outreachRuns = 0;

    for (const opp of opportunities) {
      try {
        await runManufacturerOutreach(
          { body: { opportunity: opp } } as any,
          {
            json: () => {},
            status: () => ({
              json: () => {},
            }),
          } as any
        );

        outreachRuns += 1;
      } catch (err) {
        console.error("Outreach failed:", err);
      }
    }

    console.log("✅ NEXORA COMPLETE");

    return {
      success: true,
      processed: opportunities.length,
      outreachRuns,
      message: `Nexora complete — processed ${opportunities.length} opportunities`,
    };
  } catch (err: any) {
    console.error("❌ NEXORA FAILED:", err);

    return {
      success: false,
      error: err?.message || "Nexora failed",
    };
  }
}