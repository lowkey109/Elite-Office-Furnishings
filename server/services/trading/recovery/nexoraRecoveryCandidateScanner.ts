import { getNexoraStrategyQuarantine } from "../quality/nexoraStrategyQuarantine";
import { getNexoraDecayedPerformance } from "../learning/nexoraDecayedPerformance";

export async function scanNexoraRecoveryCandidates() {
  const quarantine = await getNexoraStrategyQuarantine();
  const rows = Array.isArray((quarantine as any).rows) ? (quarantine as any).rows : [];
  const candidates = [];

  for (const row of rows.slice(0, 80)) {
    const perf = await getNexoraDecayedPerformance({
      symbol: row.symbol,
      strategy: row.strategy,
      direction: row.direction,
      limit: 30,
    }).catch(() => null);

    if (!perf) continue;

    const decayedWinRate = Number((perf as any).decayedWinRate || 0);
    const decayedProfitFactor = Number((perf as any).decayedProfitFactor || 0);
    const decayedPnl = Number((perf as any).decayedPnl || 0);

    if (decayedWinRate >= 45 && decayedProfitFactor >= 0.75 && decayedPnl >= -5) {
      candidates.push({
        id: row.id,
        symbol: row.symbol,
        strategy: row.strategy,
        direction: row.direction,
        quarantineReason: row.reason,
        decayedWinRate,
        decayedProfitFactor,
        decayedPnl,
        recommendation: "eligible_for_tiny_recovery_probe",
      });
    }
  }

  return {
    ok: true,
    service: "nexora_recovery_candidate_scanner",
    paperOnly: true,
    candidates,
    count: candidates.length,
    updatedAt: new Date().toISOString(),
  };
}
