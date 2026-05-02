import { getNexoraStrategyQuarantine } from "./nexoraStrategyQuarantine";
import { getNexoraCandidateAllowlist } from "../candidates/nexoraCandidateAllowlist";
import { getNexoraLearningPolicySnapshot } from "../learning/nexoraLearningPolicyService";

export async function getNexoraQualityHealth() {
  const [quarantine, allowlist, learning] = await Promise.allSettled([
    getNexoraStrategyQuarantine(),
    getNexoraCandidateAllowlist(),
    getNexoraLearningPolicySnapshot({}),
  ]);

  const quarantineRows =
    quarantine.status === "fulfilled" && Array.isArray((quarantine.value as any).rows)
      ? (quarantine.value as any).rows
      : [];

  const allowlistRows =
    allowlist.status === "fulfilled" && Array.isArray((allowlist.value as any).rows)
      ? (allowlist.value as any).rows
      : [];

  const blockedCount = quarantineRows.filter((r: any) => r.status === "blocked").length;
  const researchCount = allowlistRows.filter((r: any) => r.status === "research_probe").length;

  return {
    ok: true,
    service: "nexora_quality_health",
    paperOnly: true,
    blockedStrategies: blockedCount,
    allowlistedResearchCandidates: researchCount,
    learning: learning.status === "fulfilled" ? learning.value : { ok: false, error: String(learning.reason) },
    status:
      blockedCount > 20 && researchCount === 0 ? "strict_learning_lock" :
      blockedCount > 10 ? "defensive_learning" :
      "adaptive_learning",
    reason:
      blockedCount > 20 && researchCount === 0
        ? "Most known strategies are quarantined and no research candidates are currently clean."
        : "Quality controls are active.",
    updatedAt: new Date().toISOString(),
  };
}
