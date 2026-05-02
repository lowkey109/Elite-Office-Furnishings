import { refreshNexoraExplorationProbes } from "../exploration/nexoraExplorationEngine";
import { promoteWinningPaperProbes } from "../probes/nexoraPaperProbePromoter";
import { recordNexoraWatchlistObservations } from "../observations/nexoraWatchlistObservations";
import { cleanNexoraProbeAllowlist } from "../probes/nexoraProbeAllowlistCleaner";

export async function runNexoraFastLearningCycle() {
  const observations = await recordNexoraWatchlistObservations().catch((err: unknown) => ({ ok: false, error: String(err) }));
  const promoted = await promoteWinningPaperProbes().catch((err: unknown) => ({ ok: false, error: String(err) }));
  const cleaned = await cleanNexoraProbeAllowlist().catch((err: unknown) => ({ ok: false, error: String(err) }));
  const exploration = await refreshNexoraExplorationProbes().catch((err: unknown) => ({ ok: false, error: String(err) }));

  return {
    ok: true,
    service: "nexora_fast_learning_cycle",
    paperOnly: true,
    observations,
    promoted,
    cleaned,
    exploration,
    updatedAt: new Date().toISOString(),
  };
}
