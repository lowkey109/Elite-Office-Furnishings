import type { ScenarioImpact } from "./portfolioStressCalculator";

export interface StrategyStressSensitivity {
  strategy: string;
  avgImpact: number;
  worstImpact: number;
  worstScenario: string;
  sensitivityScore: number;
  label: "resilient" | "moderate" | "fragile";
}

export function calculateStrategyStressSensitivity(
  scenarioResults: ScenarioImpact[],
): StrategyStressSensitivity[] {
  const strategyData: Record<string, { impacts: number[]; scenarios: { name: string; impact: number }[] }> = {};

  for (const result of scenarioResults) {
    for (const [strategy, impact] of Object.entries(result.strategyImpacts)) {
      if (!strategyData[strategy]) strategyData[strategy] = { impacts: [], scenarios: [] };
      strategyData[strategy].impacts.push(impact);
      strategyData[strategy].scenarios.push({ name: result.scenarioName, impact });
    }
  }

  const sensitivities: StrategyStressSensitivity[] = [];

  for (const [strategy, data] of Object.entries(strategyData)) {
    const avgImpact = Math.round(data.impacts.reduce((s, i) => s + i, 0) / data.impacts.length * 100) / 100;
    const worst = data.scenarios.reduce((w, s) => s.impact < w.impact ? s : w, data.scenarios[0]);
    const worstImpact = Math.round(worst.impact * 100) / 100;

    const absAvg = Math.abs(avgImpact);
    let sensitivityScore: number;
    let label: StrategyStressSensitivity["label"];

    if (absAvg > 500) {
      sensitivityScore = Math.min(100, Math.round(absAvg / 10));
      label = "fragile";
    } else if (absAvg > 100) {
      sensitivityScore = Math.round(30 + (absAvg / 500) * 40);
      label = "moderate";
    } else {
      sensitivityScore = Math.round((absAvg / 100) * 30);
      label = "resilient";
    }

    sensitivities.push({
      strategy,
      avgImpact,
      worstImpact,
      worstScenario: worst.name,
      sensitivityScore: Math.min(100, sensitivityScore),
      label,
    });
  }

  return sensitivities.sort((a, b) => Math.abs(b.worstImpact) - Math.abs(a.worstImpact));
}
