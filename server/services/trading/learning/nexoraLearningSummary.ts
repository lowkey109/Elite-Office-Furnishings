import { getNexoraProbeQuality } from "../probes/nexoraProbeQuality";
import { getNexoraCandidateWatchlistV3 } from "../candidates/nexoraCandidateWatchlistV3";
import { getNexoraPromotionGate } from "../promotion/nexoraPromotionGate";

export async function getNexoraLearningSummary() {
  const [probe, watchlist, promotion] = await Promise.all([
    getNexoraProbeQuality({}).catch((err) => ({ ok: false, error: String(err) })),
    getNexoraCandidateWatchlistV3().catch((err) => ({ ok: false, watchlist: [], error: String(err) })),
    getNexoraPromotionGate({}).catch((err) => ({ ok: false, error: String(err) })),
  ]);

  return {
    ok: true,
    service: "nexora_learning_summary",
    paperOnly: true,
    probe,
    watchlistCount: Array.isArray((watchlist as any).watchlist) ? (watchlist as any).watchlist.length : 0,
    watchlist: (watchlist as any).watchlist || [],
    promotion,
    nextAction:
      (probe as any).shouldCooldown ? "rotate_probe" :
      ((watchlist as any).watchlist || []).length ? "continue_paper_learning" :
      "wait_for_better_market",
    updatedAt: new Date().toISOString(),
  };
}
