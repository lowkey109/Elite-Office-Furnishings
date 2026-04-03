import { db } from "../../db";
import { stressAlerts } from "@shared/schema";
import type { PortfolioState } from "./portfolioState";
import type { ScenarioImpact } from "./portfolioStressCalculator";
import type { ResilienceResult } from "./portfolioResilience";
import { desc } from "drizzle-orm";

export interface StressAlertOutput {
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  relatedScenario: string | null;
}

export function generateStressAlerts(
  portfolio: PortfolioState,
  scenarioResults: ScenarioImpact[],
  resilience: ResilienceResult,
): StressAlertOutput[] {
  const alerts: StressAlertOutput[] = [];

  if (portfolio.openPositionsCount === 0) return alerts;

  if (resilience.fragilityLabel === "high") {
    alerts.push({
      alertType: "high_fragility",
      severity: "critical",
      description: `Portfolio fragility is HIGH (resilience score: ${resilience.overallScore})`,
      relatedScenario: null,
    });
  }

  const worstScenario = scenarioResults.reduce((w, s) => s.projectedPnlImpact < (w?.projectedPnlImpact ?? 0) ? s : w, scenarioResults[0]);
  if (worstScenario && worstScenario.projectedDrawdown > 15) {
    alerts.push({
      alertType: "severe_worst_case",
      severity: "critical",
      description: `Worst case "${worstScenario.scenarioName}" projects ${worstScenario.projectedDrawdown.toFixed(1)}% drawdown`,
      relatedScenario: worstScenario.scenarioName,
    });
  }

  const cryptoExposure = portfolio.exposureByCluster["crypto"] || 0;
  if (cryptoExposure > portfolio.totalEquity * 0.5) {
    alerts.push({
      alertType: "crypto_cluster_overexposed",
      severity: "high",
      description: `Crypto cluster exposure ${Math.round(cryptoExposure / portfolio.totalEquity * 100)}% of equity — reduce crypto concentration`,
      relatedScenario: "All Crypto -12%",
    });
  }

  for (const flag of resilience.riskFlags) {
    if (flag === "one_strategy_dominates_allocation") {
      alerts.push({
        alertType: "strategy_concentration",
        severity: "medium",
        description: "Single strategy dominates portfolio allocation — diversify strategies",
        relatedScenario: null,
      });
    }
    if (flag === "high_drawdown_sensitivity") {
      alerts.push({
        alertType: "drawdown_sensitivity",
        severity: "high",
        description: "Portfolio is highly sensitive to drawdown under stress — consider reducing exposure",
        relatedScenario: worstScenario?.scenarioName || null,
      });
    }
  }

  return alerts;
}

export async function persistStressAlerts(alerts: StressAlertOutput[]): Promise<void> {
  for (const alert of alerts) {
    try {
      await db.insert(stressAlerts).values({
        alertType: alert.alertType,
        severity: alert.severity,
        description: alert.description,
        relatedScenario: alert.relatedScenario,
      });
    } catch {}
  }
}

export async function getRecentAlerts(limit = 20): Promise<any[]> {
  return db.select().from(stressAlerts).orderBy(desc(stressAlerts.createdAt)).limit(limit);
}
