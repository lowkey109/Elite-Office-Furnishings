import { seedAggressivePaperProbes } from "./nexoraAggressiveProbeSeeder";
import { boostRecentWinningPaperEdges } from "./nexoraOutcomeBooster";
import { demoteBadPaperProbes } from "./nexoraBadProbeDemoter";
import { refreshNexoraExplorationProbes } from "../exploration/nexoraExplorationEngine";

export async function runForcePaperLearningCycle() {
  const seeded = await seedAggressivePaperProbes().catch((err: unknown) => ({ ok: false, error: String(err) }));
  const boosted = await boostRecentWinningPaperEdges().catch((err: unknown) => ({ ok: false, error: String(err) }));
  const demoted = await demoteBadPaperProbes().catch((err: unknown) => ({ ok: false, error: String(err) }));
  const exploration = await refreshNexoraExplorationProbes().catch((err: unknown) => ({ ok: false, error: String(err) }));

  return {
    ok: true,
    service: "nexora_force_paper_learning_cycle",
    paperOnly: true,
    seeded,
    boosted,
    demoted,
    exploration,
    updatedAt: new Date().toISOString(),
  };
}
