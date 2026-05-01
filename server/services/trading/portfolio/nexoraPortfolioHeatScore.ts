import { getNexoraPortfolioBrain } from "./nexoraPortfolioBrain";

export async function getNexoraPortfolioHeatScore() {
  const brain = await getNexoraPortfolioBrain();

  const exposureScore = Math.min(40, Number(brain.totalOpen || 0) * 4);
  const drawdownScore = Number(brain.totalUnrealizedPnl || 0) < 0
    ? Math.min(35, Math.abs(Number(brain.totalUnrealizedPnl || 0)) / 5)
    : 0;

  const concentrationScore = Math.min(
    25,
    Math.max(...Object.values(brain.symbolExposure || {}).map((v) => Number(v || 0)), 0) * 6
  );

  const heatScore = Math.round(exposureScore + drawdownScore + concentrationScore);

  return {
    ok: true,
    service: "nexora_portfolio_heat_score",
    heatScore,
    state: heatScore >= 75 ? "critical" : heatScore >= 50 ? "hot" : heatScore >= 25 ? "warm" : "cool",
    components: { exposureScore, drawdownScore, concentrationScore },
    portfolio: brain,
    updatedAt: new Date().toISOString(),
  };
}
