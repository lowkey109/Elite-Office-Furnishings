import { getNexoraResearchProbeMonitor } from "./nexoraResearchProbeMonitor";
import { getNexoraPortfolioHeatScore } from "../portfolio/nexoraPortfolioHeatScore";
import { getNexoraKillSwitchGuard } from "../portfolio/nexoraKillSwitchGuard";

export async function getNexoraResearchProbeSafety() {
  const [monitor, heat, kill] = await Promise.all([
    getNexoraResearchProbeMonitor(),
    getNexoraPortfolioHeatScore().catch((err) => ({ ok: false, error: String(err), heatScore: 999, state: "unknown" })),
    getNexoraKillSwitchGuard().catch((err) => ({ ok: false, error: String(err), active: true })),
  ]);

  const openCount = Number(monitor.openCount || 0);
  const heatScore = Number((heat as any).heatScore || 0);
  const killActive = Boolean((kill as any).active);

  const maxOpenResearchProbes = killActive ? 1 : heatScore >= 50 ? 1 : 3;

  const allowed = openCount < maxOpenResearchProbes && heatScore < 75;

  return {
    ok: true,
    service: "nexora_research_probe_safety",
    paperOnly: true,
    allowed,
    openCount,
    maxOpenResearchProbes,
    heat,
    killSwitch: kill,
    reason: allowed
      ? "Research probe capacity available."
      : "Research probe capacity blocked by open count, heat, or kill switch.",
    updatedAt: new Date().toISOString(),
  };
}
