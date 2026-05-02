
import { getNexoraIntelligenceHealth } from "../health/nexoraIntelligenceHealth";
import { runNexoraAgentOrchestrator } from "../agents/nexoraAgentOrchestrator";
import { getNexoraPortfolioBrain } from "../portfolio/nexoraPortfolioBrain";
import { getNexoraMarketRegimeSnapshot } from "../regime/nexoraMarketRegimeEngine";
import { getNexoraDecisionAudit } from "../audit/nexoraDecisionAudit";
import { getNexoraResearchProbeSafety } from "../research/nexoraResearchProbeSafety";
import { getNexoraQualityHealth } from "../quality/nexoraQualityHealth";

export async function getNexoraPlatformSummary() {
  const [health, agents, portfolio, regimes, audit, researchProbes, quality] = await Promise.allSettled([
    getNexoraIntelligenceHealth(),
    runNexoraAgentOrchestrator(),
    getNexoraPortfolioBrain(),
    getNexoraMarketRegimeSnapshot(),
    getNexoraDecisionAudit(20),
    getNexoraResearchProbeSafety(),
    getNexoraQualityHealth(),
  ]);

  return {
    ok: true,
    service: "nexora_platform_summary",
    paperOnly: true,
    health: health.status === "fulfilled" ? health.value : { ok: false, error: String(health.reason) },
    agents: agents.status === "fulfilled" ? agents.value : { ok: false, error: String(agents.reason) },
    portfolio: portfolio.status === "fulfilled" ? portfolio.value : { ok: false, error: String(portfolio.reason) },
    regimes: regimes.status === "fulfilled" ? regimes.value : { ok: false, error: String(regimes.reason) },
    recentAudit: audit.status === "fulfilled" ? audit.value : { ok: false, error: String(audit.reason) },
    researchProbes: researchProbes.status === "fulfilled" ? researchProbes.value : { ok: false, error: String(researchProbes.reason) },
    quality: quality.status === "fulfilled" ? quality.value : { ok: false, error: String(quality.reason) },
    updatedAt: new Date().toISOString(),
  };
}
