import { getNexoraProbeQuality } from "../probes/nexoraProbeQuality";
import { getNexoraCandidateWatchlistV3 } from "../candidates/nexoraCandidateWatchlistV3";
import { cleanNexoraProbeAllowlist } from "../probes/nexoraProbeAllowlistCleaner";

export async function getNexoraLearningHealth() {
  const [probe, watchlist, cleaner] = await Promise.all([
    getNexoraProbeQuality({}).catch((err: unknown) => ({ ok: false, error: String(err) })),
    getNexoraCandidateWatchlistV3().catch((err: unknown) => ({ ok: false, watchlist: [], error: String(err) })),
    cleanNexoraProbeAllowlist().catch((err: unknown) => ({ ok: false, remaining: [], error: String(err) })),
  ]);

  const watchlistRows = Array.isArray((watchlist as any).watchlist) ? (watchlist as any).watchlist : [];
  const remaining = Array.isArray((cleaner as any).remaining) ? (cleaner as any).remaining : [];

  return {
    ok: true,
    service: "nexora_learning_health",
    paperOnly: true,
    probe,
    watchlistCount: watchlistRows.length,
    activeAllowlistCount: remaining.length,
    shouldExplore: watchlistRows.length > 0,
    shouldCooldown: Boolean((probe as any).shouldCooldown),
    nextAction: Boolean((probe as any).shouldCooldown)
      ? "clean_and_rotate_probe"
      : remaining.length > 0
      ? "continue_paper_probes"
      : "refresh_exploration",
    updatedAt: new Date().toISOString(),
  };
}
