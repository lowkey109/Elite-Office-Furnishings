import { getNexoraStrategyQuarantine } from "./nexoraStrategyQuarantine";
import { getNexoraCandidateAllowlist } from "../candidates/nexoraCandidateAllowlist";

export async function getNexoraQualityHealth() {
  const [quarantine, allowlist] = await Promise.all([
    getNexoraStrategyQuarantine().catch((err) => ({ ok: false, rows: [], error: String(err) })),
    getNexoraCandidateAllowlist().catch((err) => ({ ok: false, rows: [], error: String(err) })),
  ]);

  const blockedStrategies = Array.isArray((quarantine as any).rows)
    ? (quarantine as any).rows.filter((r: any) => r.status === "blocked").length
    : 0;

  const allowlistedResearchCandidates = Array.isArray((allowlist as any).rows)
    ? (allowlist as any).rows.filter((r: any) => r.status === "research_probe").length
    : 0;

  return {
    ok: true,
    service: "nexora_quality_health",
    paperOnly: true,
    blockedStrategies,
    allowlistedResearchCandidates,
    status: blockedStrategies > 10 ? "defensive_learning" : "adaptive_learning",
    reason: "Quality controls active. Quarantined setups should not be used for new allowlist refreshes.",
    updatedAt: new Date().toISOString(),
  };
}
