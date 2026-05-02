
import { getNexoraIntelligenceHealth } from "../health/nexoraIntelligenceHealth";
import { runNexoraAgentOrchestrator } from "../agents/nexoraAgentOrchestrator";
import { getNexoraPortfolioBrain } from "../portfolio/nexoraPortfolioBrain";
import { getNexoraMarketRegimeSnapshot } from "../regime/nexoraMarketRegimeEngine";
import { getNexoraDecisionAudit } from "../audit/nexoraDecisionAudit";
import { getNexoraResearchProbeSafety } from "../research/nexoraResearchProbeSafety";

export async function getNexoraPlatformSummary() {
  const [health, agents, portfolio, regimes, audit, researchProbes] = await Promise.allSettled([
    getNexoraIntelligenceHealth(),
    runNexoraAgentOrchestrator(),
    getNexoraPortfolioBrain(),
    getNexoraMarketRegimeSnapshot(),
    getNexoraDecisionAudit(20),
    getNexoraResearchProbeSafety(),
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
    updatedAt: new Date().toISOString(),
  };
}
