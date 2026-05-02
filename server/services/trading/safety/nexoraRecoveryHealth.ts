import { getNexoraDbSafety } from "./nexoraDbSafety";

export async function getNexoraRecoveryHealth() {
  const dbSafety = await getNexoraDbSafety();

  return {
    ok: true,
    service: "nexora_recovery_health",
    paperOnly: true,
    dbSafety,
    canStartPaper: dbSafety.safeForPaperTrading,
    status: dbSafety.safeForPaperTrading ? "ready" : "blocked",
    nextAction: dbSafety.safeForPaperTrading
      ? "Run aggressive paper reset, force paper cycle, then start-fast."
      : "Keep auto-paper stopped. Run prune-small or upgrade DB storage.",
    updatedAt: new Date().toISOString(),
  };
}
