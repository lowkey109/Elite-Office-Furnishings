import { runOfficeMoveRadarScan } from "./officeMovRadarService";
import { runDealHunterScan } from "./dealHunter";
import { runManufacturerOutreach } from "./aiManufacturerOutreach";

export async function runNexoraEngine() {
  try {
    console.log("🚀 NEXORA STARTED");

    // 1. SIGNALS
    const radarResults = await runOfficeMoveRadarScan();
    const dealResults = await runDealHunterScan();

    const opportunities = [
      ...(radarResults || []),
      ...(dealResults || [])
    ];

    console.log(`📡 Signals found: ${opportunities.length}`);

    // 2. PROCESS + DECIDE
    for (const opp of opportunities) {
      try {
        // 👇 SIMPLE LOGIC FOR NOW (we upgrade later)
        if (opp?.type === "company" || opp?.signalType) {
          console.log(`📨 Outreach triggered for: ${opp.companyName || "Unknown"}`);

          await runManufacturerOutreach(
            { body: {} } as any,
            {
              status: () => ({ json: () => {} }),
              json: () => {}
            } as any
          );
        }
      } catch (err) {
        console.error("⚠️ Error processing opportunity:", err);
      }
    }

    console.log("✅ NEXORA COMPLETE");

    return {
      success: true,
      processed: opportunities.length
    };

  } catch (error) {
    console.error("❌ NEXORA FAILED:", error);

    return {
      success: false,
      error: (error as any)?.message
    };
  }
}