import { getNexoraDbSafety, pruneNexoraSmallDb } from "./nexoraDbSafety";

export async function runNexoraDbMaintenance() {
  const before = await getNexoraDbSafety();
  const pruned = await pruneNexoraSmallDb().catch((err: any) => ({
    ok: false,
    service: "nexora_small_db_pruner",
    paperOnly: true,
    skipped: true,
    reason: `Maintenance prune failed safely: ${String(err?.message || err)}`,
    safety: before,
    updatedAt: new Date().toISOString(),
  }));
  const after = await getNexoraDbSafety();

  return {
    ok: Boolean((pruned as any)?.ok) && after.safeForPaperTrading,
    service: "nexora_db_maintenance",
    paperOnly: true,
    before,
    pruned,
    after,
    recommendation: after.safeForPaperTrading
      ? "DB safe. Paper trader may be started."
      : "Keep paper trader stopped until DB storage is upgraded or rows are reduced.",
    updatedAt: new Date().toISOString(),
  };
}
