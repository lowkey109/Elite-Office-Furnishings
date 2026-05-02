import { getNexoraDbSafety, pruneNexoraSmallDb } from "./nexoraDbSafety";

export async function runNexoraDbMaintenance() {
  const before = await getNexoraDbSafety();
  const pruned = await pruneNexoraSmallDb();
  const after = await getNexoraDbSafety();

  return {
    ok: true,
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
