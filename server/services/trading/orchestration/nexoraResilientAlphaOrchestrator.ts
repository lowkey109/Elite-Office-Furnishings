import { getNexoraDbHealthGate } from "../resilience/nexoraDbHealthGate";
import { runNexoraAlphaOrchestrator } from "./nexoraAlphaOrchestrator";

export async function runNexoraResilientAlphaOrchestrator(input: any = {}) {
  const db = await getNexoraDbHealthGate();

  if (!db.safeForWrites) {
    return {
      ok: true,
      service: "nexora_resilient_alpha_orchestrator",
      paperOnly: true,
      db,
      scannedCount: Array.isArray(input.markets) ? input.markets.length : 0,
      decisionCount: 0,
      approvedCount: 0,
      decisions: [],
      action: "MONITOR_ONLY",
      reason: "DB gate blocked paper writes. Nexora will observe only.",
      updatedAt: new Date().toISOString(),
    };
  }

  const result = await runNexoraAlphaOrchestrator(input);

  return {
    ok: true,
    service: "nexora_resilient_alpha_orchestrator",
    paperOnly: true,
    db,
    ...result,
    updatedAt: new Date().toISOString(),
  };
}
