import { db } from "../../db";
import { paperTradeOutcomes, paperTradingDecisions } from "@shared/schema";
import { desc } from "drizzle-orm";
import type { TradingParameters } from "./tradingConfig";
import type { ParameterProposal } from "./ruleUpdateEngine";

export interface ShadowResult {
  proposalIndex: number;
  parameterKey: string;
  currentConfigMetrics: ShadowMetrics;
  proposedConfigMetrics: ShadowMetrics;
  improvement: boolean;
  deltaExpectancy: number;
  deltaWinRate: number;
  deltaDrawdown: number;
  sampleSize: number;
  notes: string;
}

interface ShadowMetrics {
  winRate: number;
  expectancy: number;
  totalPnl: number;
  tradeCount: number;
  maxDrawdown: number;
}

function wouldPassFilter(decision: any, outcome: any, config: TradingParameters, proposal: ParameterProposal): boolean {
  if (proposal.parameterKey === "minConfidence") {
    return decision.confidence >= proposal.proposedValue;
  }
  if (proposal.parameterKey.startsWith("enabledStrategies.remove.")) {
    const strategy = proposal.parameterKey.replace("enabledStrategies.remove.", "");
    return outcome.strategy !== strategy;
  }
  return true;
}

function computeMetrics(outcomes: any[]): ShadowMetrics {
  if (outcomes.length === 0) {
    return { winRate: 0, expectancy: 0, totalPnl: 0, tradeCount: 0, maxDrawdown: 0 };
  }
  const wins = outcomes.filter(o => o.outcome === "win");
  const totalPnl = outcomes.reduce((s, o) => s + o.realizedPnl, 0);
  let peak = 0, maxDD = 0, cum = 0;
  for (const o of outcomes) {
    cum += o.realizedPnl;
    if (cum > peak) peak = cum;
    const dd = peak > 0 ? ((peak - cum) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return {
    winRate: (wins.length / outcomes.length) * 100,
    expectancy: totalPnl / outcomes.length,
    totalPnl,
    tradeCount: outcomes.length,
    maxDrawdown: maxDD,
  };
}

export async function runShadowValidation(
  currentConfig: TradingParameters,
  proposals: ParameterProposal[],
): Promise<ShadowResult[]> {
  const outcomes = await db.select().from(paperTradeOutcomes).orderBy(paperTradeOutcomes.createdAt);
  const decisions = await db.select().from(paperTradingDecisions);
  const decisionMap = new Map(decisions.map(d => [d.id, d]));

  const results: ShadowResult[] = [];

  for (let i = 0; i < proposals.length; i++) {
    const proposal = proposals[i];

    const currentMetrics = computeMetrics(outcomes);

    const filteredOutcomes = outcomes.filter(o => {
      const decision = decisionMap.get(o.linkedDecisionId);
      if (!decision) return true;
      return wouldPassFilter(decision, o, currentConfig, proposal);
    });

    const proposedMetrics = computeMetrics(filteredOutcomes);

    const deltaExpectancy = proposedMetrics.expectancy - currentMetrics.expectancy;
    const deltaWinRate = proposedMetrics.winRate - currentMetrics.winRate;
    const deltaDrawdown = currentMetrics.maxDrawdown - proposedMetrics.maxDrawdown;

    const improvement = deltaExpectancy >= 0 && deltaDrawdown >= 0;

    let notes = "";
    if (filteredOutcomes.length < outcomes.length * 0.3) {
      notes = "Warning: proposal would filter out >70% of trades — high impact";
    } else if (improvement) {
      notes = `Positive: expectancy ${deltaExpectancy >= 0 ? "+" : ""}${deltaExpectancy.toFixed(2)}, drawdown ${deltaDrawdown >= 0 ? "-" : "+"}${Math.abs(deltaDrawdown).toFixed(1)}%`;
    } else {
      notes = "Neutral or negative impact on historical outcomes";
    }

    results.push({
      proposalIndex: i,
      parameterKey: proposal.parameterKey,
      currentConfigMetrics: currentMetrics,
      proposedConfigMetrics: proposedMetrics,
      improvement,
      deltaExpectancy,
      deltaWinRate,
      deltaDrawdown,
      sampleSize: outcomes.length,
      notes,
    });
  }

  return results;
}
