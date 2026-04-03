import { db } from "../../db";
import { tradingAdaptationProposals } from "@shared/schema";
import { desc } from "drizzle-orm";
import { getActiveConfig, type TradingParameters } from "./tradingConfig";
import { getLearningRecommendations, type RecommendationOutput } from "./learningRecommendations";

export interface ParameterProposal {
  recommendationId?: string;
  proposalType: string;
  parameterKey: string;
  currentValue: any;
  proposedValue: any;
  reason: string;
  sampleSize: number;
  confidence: number;
  evidence: Record<string, any>;
}

export async function generateParameterProposals(): Promise<ParameterProposal[]> {
  const { config } = await getActiveConfig();
  const recommendations = await getLearningRecommendations();

  if (recommendations.length === 0) return [];

  const proposals: ParameterProposal[] = [];

  for (const rec of recommendations) {
    switch (rec.recommendationType) {
      case "raise_confidence_threshold": {
        if (config.minConfidence < 75) {
          const newVal = Math.min(config.minConfidence + 5, 80);
          proposals.push({
            proposalType: "parameter_change",
            parameterKey: "minConfidence",
            currentValue: config.minConfidence,
            proposedValue: newVal,
            reason: rec.description,
            sampleSize: (rec.evidence as any)?.totalReviewed ?? 0,
            confidence: rec.confidence,
            evidence: rec.evidence,
          });
        }
        break;
      }
      case "disable_strategy": {
        if (rec.strategy && config.enabledStrategies.includes(rec.strategy)) {
          proposals.push({
            proposalType: "strategy_disable",
            parameterKey: `enabledStrategies.remove.${rec.strategy}`,
            currentValue: true,
            proposedValue: false,
            reason: rec.description,
            sampleSize: (rec.evidence as any)?.tradeCount ?? 0,
            confidence: rec.confidence,
            evidence: rec.evidence,
          });
        }
        break;
      }
      case "reduce_exposure": {
        if (rec.symbol) {
          const current = config.symbolRiskMultipliers[rec.symbol] ?? 1.0;
          const newVal = Math.max(0.3, current - 0.2);
          proposals.push({
            proposalType: "risk_adjustment",
            parameterKey: `symbolRiskMultipliers.${rec.symbol}`,
            currentValue: current,
            proposedValue: newVal,
            reason: rec.description,
            sampleSize: (rec.evidence as any)?.tradeCount ?? 0,
            confidence: rec.confidence,
            evidence: rec.evidence,
          });
        }
        break;
      }
      case "avoid_weak_setup": {
        proposals.push({
          proposalType: "setup_filter",
          parameterKey: `setupFilter.${rec.strategy ?? "general"}.${rec.symbol ?? "all"}`,
          currentValue: "enabled",
          proposedValue: "filtered",
          reason: rec.description,
          sampleSize: (rec.evidence as any)?.tradeCount ?? 0,
          confidence: rec.confidence,
          evidence: rec.evidence,
        });
        break;
      }
    }
  }

  return proposals.slice(0, 3);
}

export async function persistProposals(proposals: ParameterProposal[]): Promise<string[]> {
  const ids: string[] = [];
  for (const p of proposals) {
    const [inserted] = await db.insert(tradingAdaptationProposals).values({
      recommendationId: p.recommendationId ?? null,
      proposalType: p.proposalType,
      proposalJson: {
        parameterKey: p.parameterKey,
        currentValue: p.currentValue,
        proposedValue: p.proposedValue,
        reason: p.reason,
      },
      sampleSize: p.sampleSize,
      confidence: p.confidence,
      guardrailStatus: "pending",
      approvalStatus: "pending",
    }).returning({ id: tradingAdaptationProposals.id });
    ids.push(inserted.id);
  }
  return ids;
}

export async function getPendingProposals(): Promise<any[]> {
  return db
    .select()
    .from(tradingAdaptationProposals)
    .orderBy(desc(tradingAdaptationProposals.createdAt))
    .limit(20);
}
