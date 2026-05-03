import { calculateNexoraFairProbability } from "./nexoraFairProbabilityEngine";
import { checkNexoraResolutionRules } from "./nexoraResolutionRulesRisk";
import { checkNexoraCorrelationRisk } from "./nexoraCorrelationRiskEngine";
import { runNexoraPredictionFallbackStack } from "./nexoraPredictionFallbackStrategies";

export async function runNexoraAdvancedPredictionCore(input: any = {}) {
  const fair = calculateNexoraFairProbability(input);
  const resolution = checkNexoraResolutionRules(input);

  const marketProbability = Number(input.marketProbability || input.price || 0);
  const modelProbability = fair.fairProbability;
  const bankrollUsd = Number(input.bankrollUsd || 1000);

  const proposedRiskUsd = Math.max(
    0,
    Math.round(bankrollUsd * (Math.abs(modelProbability - marketProbability) >= 0.15 ? 0.03 : Math.abs(modelProbability - marketProbability) >= 0.1 ? 0.02 : Math.abs(modelProbability - marketProbability) >= 0.07 ? 0.01 : 0) * 100) / 100
  );

  const correlation = checkNexoraCorrelationRisk({
    ...input,
    bankrollUsd,
    proposedRiskUsd,
  });

  const fallback = await runNexoraPredictionFallbackStack({
    bankrollUsd,
    exposureByEvent: input.exposureByEvent || {},
    markets: [
      {
        ...input,
        modelProbability,
        resolutionClear: resolution.clear,
      },
    ],
  });

  const approved =
    Boolean(resolution.tradeAllowed) &&
    Boolean(correlation.tradeAllowed) &&
    Array.isArray(fallback.approved) &&
    fallback.approved.length > 0;

  return {
    ok: true,
    service: "nexora_advanced_prediction_core",
    paperOnly: true,
    approved,
    decision: approved ? "PAPER_SIGNAL_APPROVED" : "MONITOR_ONLY",
    fairProbability: fair,
    resolutionRisk: resolution,
    correlationRisk: correlation,
    fallbackDecision: fallback,
    hardRule: "Nexora only trades when fair probability edge, liquidity, spread, clear resolution, and correlation exposure are all proven.",
    updatedAt: new Date().toISOString(),
  };
}
