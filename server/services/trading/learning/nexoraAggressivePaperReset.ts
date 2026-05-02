import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { refreshNexoraExplorationProbes } from "../exploration/nexoraExplorationEngine";

export async function resetNexoraAggressivePaperLearning() {
  await db.execute(sql`delete from nexora_probe_cooldowns;`).catch(() => null);
  await db.execute(sql`delete from nexora_candidate_allowlist where status in ('research_probe', 'recovery_probe');`).catch(() => null);
  const exploration = await refreshNexoraExplorationProbes();

  return {
    ok: true,
    service: "nexora_aggressive_paper_reset",
    paperOnly: true,
    mode: "aggressive_paper_learning",
    cooldownsCleared: true,
    oldPaperProbesCleared: true,
    exploration,
    updatedAt: new Date().toISOString(),
  };
}
