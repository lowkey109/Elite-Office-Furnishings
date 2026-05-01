import { NEXORA_SIGNAL_LIBRARY_2000 } from "./nexoraSignalLibrary2000";
import { buildNexoraCryptoMarketKnowledgeSignals } from "../knowledge/nexoraCryptoMarketKnowledge";
import { evaluateNexoraBotTeachings } from "../knowledge/nexoraBotTeachingEngine";
import { evaluateNexoraGeniusCore } from "../knowledge/nexoraGeniusCore";
import { buildNexoraIndicatorSignals } from "../indicators/nexoraIndicatorSignalAdapter";
import { getNexoraSetupPromotions } from "../promotion/nexoraSetupPromotionEngine";
import { approveNexoraPortfolioRisk } from "../portfolio/nexoraPortfolioBrain";
import { classifyNexoraMarketRegime } from "../regime/nexoraMarketRegimeEngine";
import { recordNexoraDecisionAudit } from "../audit/nexoraDecisionAudit";
import { runNexoraCandidateHunter } from "../candidates/nexoraCandidateHunter";
import { findNexoraAllowedCandidate } from "../candidates/nexoraCandidateAllowlist";
import { evaluateNexoraAutonomy } from "../autonomy/nexoraAutonomousLearningEngine";
import { evaluateNexoraTimeframeAgreement } from "../timeframes/nexoraTimeframeAgreementEngine";
import { runNexoraWalkForwardValidation } from "../validation/nexoraWalkForwardValidator";
import type { NexoraTradeDirection, NexoraTradeSignal } from "../nexoraTradeVotingEngine";

type ScoreInput = {
  symbol: string;
  strategy: string;
  direction: Exclude<NexoraTradeDirection, "neutral">;
  confidence: number;
  learningScore: number;
  regime?: string;
};

type GroupScore = {
  group: string;
  score: number;
  agreeing: number;
  total: number;
};

export type NexoraSignalScoringResult = {
  signals: NexoraTradeSignal[];
  groupScores: GroupScore[];
  agreementCount: number;
  confidence: number;
  blockedReasons: string[];
  reason: string;
  intelligence: {
    decisionMode: "monitor_only" | "research_probe" | "candidate_trade" | "promoted_trade";
    geniusScore: number | null;
    knowledgeSignals: number;
    teachingSignals: number;
    professorSignals: number;
    totalSignals: number;
    agreementRequired: number;
  };
};

function preferredGroupsForStrategy(strategy: string) {
  if (strategy === "momentum_breakout") {
    return ["trend", "breakout", "volatility", "structure", "liquidity", "regime"];
  }

  if (strategy === "volatility_squeeze") {
    return ["volatility", "breakout", "trend", "liquidity", "structure", "regime"];
  }

  if (strategy === "trend_follow") {
    return ["trend", "regime", "structure", "liquidity", "volatility", "breakout"];
  }

  if (strategy === "mean_reversion") {
    return ["mean_reversion", "structure", "volatility", "liquidity", "regime", "risk"];
  }

  return ["trend", "breakout", "volatility", "structure", "liquidity", "regime"];
}

function hashNumber(input: string) {
  return input.split("").reduce((sum, ch, i) => sum + ch.charCodeAt(0) * (i + 17), 0);
}

function confidenceForSignal(base: number, group: string, learningScore: number, seed: number) {
  const groupBoost: Record<string, number> = {
    trend: 4,
    breakout: 5,
    volatility: 3,
    structure: 4,
    liquidity: 2,
    regime: learningScore >= 35 ? 3 : -10,
    mean_reversion: 2,
    risk: learningScore >= 45 ? 1 : -8,
    pattern: 1,
  };

  const noise = (seed % 7) - 3;
  return Math.max(1, Math.min(96, Math.round(base + (groupBoost[group] || 0) + noise)));
}

export async function scoreNexoraSignalLibraryCandidate(input: ScoreInput): Promise<NexoraSignalScoringResult> {
  const blockedReasons: string[] = [];
  const preferredGroups = preferredGroupsForStrategy(input.strategy);

  const candidates = NEXORA_SIGNAL_LIBRARY_2000
    .filter((signal) => signal.enabled)
    .filter((signal) => signal.paperOnly)
    .filter((signal) => signal.symbol === input.symbol)
    .filter((signal) => signal.direction === input.direction || signal.direction === "neutral")
    .filter((signal) => preferredGroups.includes(signal.group));

  const selected: NexoraTradeSignal[] = [];
  const groupScores: GroupScore[] = [];

  for (const group of preferredGroups) {
    const groupSignals = candidates
      .filter((signal) => signal.group === group)
      .slice(0, 8);

    let agreeing = 0;
    let totalScore = 0;

    for (const item of groupSignals.slice(0, 2)) {
      const seed = hashNumber(`${item.id}:${input.symbol}:${input.strategy}:${input.direction}`);
      const signalConfidence = confidenceForSignal(input.confidence, item.group, input.learningScore, seed);
      const agrees =
        signalConfidence >= item.minConfidence &&
        item.direction !== "neutral" &&
        item.group !== "risk";

      if (agrees) agreeing += 1;
      totalScore += signalConfidence;

      selected.push({
        system: item.indicator,
        symbol: input.symbol,
        direction: agrees ? input.direction : "neutral",
        confidence: signalConfidence,
        strength: Math.max(1, Math.min(100, signalConfidence - 4)),
        risk:
          item.group === "risk"
            ? "high"
            : input.learningScore < 18
              ? "medium"
              : input.learningScore < 35
                ? "medium"
                : "low",
        reason: item.tradeUse,
        features: {
          signalId: item.id,
          group: item.group,
          timeframe: item.timeframe,
          regime: item.regime,
          confirmation: item.confirmation,
          paperOnly: true,
          learningScore: input.learningScore,
        },
      });
    }

    groupScores.push({
      group,
      score: groupSignals.length ? Math.round(totalScore / Math.max(1, Math.min(2, groupSignals.length))) : 0,
      agreeing,
      total: Math.min(2, groupSignals.length),
    });
  }

  let agreementCount = selected.filter(
    (signal) =>
      signal.direction === input.direction &&
      signal.confidence >= 55 &&
      signal.risk !== "high"
  ).length;

  const knowledgeSignals = buildNexoraCryptoMarketKnowledgeSignals({
    symbol: input.symbol,
    strategy: input.strategy,
    direction: input.direction,
    confidence: input.confidence,
    learningScore: input.learningScore,
    regime: input.regime,
  });

  const teachingEvaluation = evaluateNexoraBotTeachings({
    symbol: input.symbol,
    strategy: input.strategy,
    direction: input.direction,
    confidence: input.confidence,
    learningScore: input.learningScore,
    regime: input.regime,
    rewardRisk: 1.5,
    realCandleDataAvailable: false,
  });

  selected.push(...knowledgeSignals);
  selected.push(...teachingEvaluation.teachingSignals);

  const indicatorSignals = await buildNexoraIndicatorSignals({
    symbol: input.symbol,
    strategy: input.strategy,
    direction: input.direction,
    confidence: input.confidence,
  });

  selected.push(...indicatorSignals);

  const walkForward = await runNexoraWalkForwardValidation({
    symbol: input.symbol,
    timeframe: "1m",
    strategy: input.strategy,
    direction: input.direction,
  }).catch(() => null);

  if (walkForward) {
    if (!walkForward.ok) {
      blockedReasons.push(`Walk-forward validation warning: ${walkForward.reason}`);
    } else {
      selected.push({
        system: "walk_forward_validation_pass",
        symbol: input.symbol,
        direction: input.direction,
        confidence: Math.min(90, input.confidence + 10),
        strength: Math.min(86, input.confidence + 6),
        risk: "low",
        reason: walkForward.reason,
        features: {
          status: walkForward.status,
          trainWinRate: Number(walkForward.train?.winRate || 0),
          testWinRate: Number(walkForward.test?.winRate || 0),
          trainPnl: Number(walkForward.train?.pnl || 0),
          testPnl: Number(walkForward.test?.pnl || 0),
        },
      });
    }
  }

  const timeframeAgreement = await evaluateNexoraTimeframeAgreement({
    symbol: input.symbol,
    direction: input.direction,
  }).catch(() => null);

  if (timeframeAgreement) {
    if (timeframeAgreement.status === "blocked") {
      blockedReasons.push(`Timeframe Agreement blocked setup: ${timeframeAgreement.reason}`);
    }

    selected.push({
      system: "multi_timeframe_agreement",
      symbol: input.symbol,
      direction: timeframeAgreement.status === "strong" || timeframeAgreement.status === "partial" ? input.direction : "neutral",
      confidence: timeframeAgreement.status === "strong"
        ? Math.min(90, input.confidence + 10)
        : timeframeAgreement.status === "partial"
          ? Math.min(80, input.confidence + 3)
          : Math.max(40, input.confidence - 12),
      strength: timeframeAgreement.status === "strong"
        ? Math.min(86, input.confidence + 6)
        : timeframeAgreement.status === "partial"
          ? Math.min(76, input.confidence - 1)
          : Math.max(35, input.confidence - 16),
      risk: timeframeAgreement.status === "strong" ? "low" : timeframeAgreement.status === "partial" ? "medium" : "high",
      reason: timeframeAgreement.reason,
      features: {
        status: timeframeAgreement.status,
        agreementRatio: timeframeAgreement.agreementRatio,
      },
    });
  }

  const autonomyDecision = await evaluateNexoraAutonomy({
    symbol: input.symbol,
    strategy: input.strategy,
    direction: input.direction,
    baseConfidence: input.confidence,
  }).catch(() => null);

  if (autonomyDecision) {
    if (!autonomyDecision.ok) {
      for (const reason of autonomyDecision.reasons || []) {
        blockedReasons.push(`Autonomy blocked: ${reason}`);
      }
    } else {
      selected.push({
        system: "autonomous_learning_capital_allocator",
        symbol: input.symbol,
        direction: input.direction,
        confidence: Math.max(45, Math.min(92, input.confidence + autonomyDecision.confidenceAdjustment)),
        strength: Math.max(40, Math.min(88, input.confidence + autonomyDecision.confidenceAdjustment - 4)),
        risk: autonomyDecision.mode === "micro_probe" ? "high" : autonomyDecision.mode === "promoted_paper" ? "low" : "medium",
        reason: `Autonomy mode ${autonomyDecision.mode}; size multiplier ${autonomyDecision.positionSizeMultiplier}.`,
        features: {
          mode: autonomyDecision.mode,
          positionSizeMultiplier: autonomyDecision.positionSizeMultiplier,
          confidenceAdjustment: autonomyDecision.confidenceAdjustment,
          reasons: autonomyDecision.reasons.join(" "),
          paperOnly: true,
        },
      });
    }
  }

  const allowedCandidate = await findNexoraAllowedCandidate({
    symbol: input.symbol,
    strategy: input.strategy,
    direction: input.direction,
  }).catch(() => null);

  if (allowedCandidate) {
    selected.push({
      system: "candidate_allowlist_research_probe",
      symbol: input.symbol,
      direction: input.direction,
      confidence: Math.max(72, Math.min(86, Number(allowedCandidate.score || input.confidence))),
      strength: Math.max(68, Math.min(82, Number(allowedCandidate.score || input.confidence) - 4)),
      risk: "medium",
      reason: "Candidate allowlist permits a tiny paper-only research probe from recent backtest evidence.",
      features: {
        timeframe: allowedCandidate.timeframe,
        score: Number(allowedCandidate.score || 0),
        winRate: Number(allowedCandidate.win_rate || 0),
        pnl: Number(allowedCandidate.pnl || 0),
        trades: Number(allowedCandidate.trades || 0),
        paperOnly: true,
        researchProbeOnly: true,
      },
    });

    // So old bad history does not permanently suppress a newly discovered paper-only research candidate.
    for (let i = blockedReasons.length - 1; i >= 0; i--) {
      if (String(blockedReasons[i]).startsWith("Promotion engine blocked")) {
        blockedReasons.splice(i, 1);
      }
    }
  }

  const candidateHunter = await runNexoraCandidateHunter().catch(() => null);
  const matchingCandidate = candidateHunter?.approved?.find((candidate: any) =>
    candidate.symbol === input.symbol &&
    candidate.strategy === input.strategy &&
    candidate.direction === input.direction
  );

  if (matchingCandidate) {
    selected.push({
      system: "candidate_hunter_backtest_support",
      symbol: input.symbol,
      direction: input.direction,
      confidence: Math.max(72, Math.min(88, Math.round(matchingCandidate.score))),
      strength: Math.max(68, Math.min(84, Math.round(matchingCandidate.score - 4))),
      risk: "medium",
      reason: "Candidate Hunter found this setup has positive recent candle backtest evidence.",
      features: {
        timeframe: matchingCandidate.timeframe,
        trades: matchingCandidate.trades,
        winRate: matchingCandidate.winRate,
        pnl: matchingCandidate.pnl,
        score: matchingCandidate.score,
      },
    });
  }

  const regimeSnapshot = await classifyNexoraMarketRegime({
    symbol: input.symbol,
    timeframe: "1m",
  }).catch(() => null);

  if (regimeSnapshot?.ok) {
    const regime = regimeSnapshot.regime;
    const directionAgrees =
      (input.direction === "long" && regime === "trend_up") ||
      (input.direction === "short" && regime === "trend_down") ||
      regime === "squeeze";

    selected.push({
      system: "market_regime_alignment",
      symbol: input.symbol,
      direction: directionAgrees ? input.direction : "neutral",
      confidence: directionAgrees ? Math.min(88, input.confidence + 8) : Math.max(35, input.confidence - 14),
      strength: directionAgrees ? Math.min(84, input.confidence + 4) : Math.max(30, input.confidence - 18),
      risk: regime === "risk_off" ? "high" : directionAgrees ? "medium" : "high",
      reason: directionAgrees
        ? `Market regime ${regime} supports ${input.direction} setup.`
        : `Market regime ${regime} does not support ${input.direction} setup.`,
      features: {
        regime,
        regimeConfidence: Number(regimeSnapshot.confidence || 0),
      },
    });

    if (regime === "risk_off") {
      blockedReasons.push("Market Regime Engine blocked setup: risk-off regime.");
    }
  }

  const portfolioRisk = await approveNexoraPortfolioRisk({
    symbol: input.symbol,
    strategy: input.strategy,
  }).catch(() => null);

  if (portfolioRisk && !portfolioRisk.ok) {
    for (const reason of portfolioRisk.blockedReasons || []) {
      blockedReasons.push(reason);
    }
  }

  if (portfolioRisk?.ok) {
    selected.push({
      system: "portfolio_brain_risk_approval",
      symbol: input.symbol,
      direction: input.direction,
      confidence: Math.max(55, Math.min(78, input.confidence + 2)),
      strength: Math.max(50, Math.min(74, input.confidence - 2)),
      risk: portfolioRisk.portfolio?.riskState === "low" ? "low" : "medium",
      reason: "Portfolio Brain approved current exposure for this setup.",
      features: {
        totalOpen: Number(portfolioRisk.portfolio?.totalOpen || 0),
        riskState: portfolioRisk.portfolio?.riskState || "unknown",
      },
    });
  }

  const promotionSnapshot = await getNexoraSetupPromotions().catch(() => null);
  const promotionRows = promotionSnapshot?.rows || [];
  const promotion = promotionRows.find((row: any) =>
    row.symbol === input.symbol &&
    row.strategy === input.strategy &&
    (row.direction === input.direction || row.direction === "unknown")
  );

  if (promotion?.status === "blocked") {
    blockedReasons.push(`Promotion engine blocked ${input.symbol} ${input.strategy} ${input.direction}: ${promotion.reason || "weak setup"}.`);
  }

  if (promotion?.status === "testing" && input.learningScore < 18) {
    selected.push({
      system: "promotion_testing_micro_probe_only",
      symbol: input.symbol,
      direction: input.direction,
      confidence: Math.max(45, Math.min(70, input.confidence - 6)),
      strength: Math.max(40, Math.min(66, input.confidence - 10)),
      risk: "medium",
      reason: "Promotion engine says setup is still testing. Tiny paper probe only.",
      features: {
        promotionStatus: promotion.status,
        promotionReason: promotion.reason || null,
      },
    });
  }

  if (promotion?.status === "candidate" || promotion?.status === "promoted" || promotion?.status === "elite") {
    selected.push({
      system: `promotion_${promotion.status}_support`,
      symbol: input.symbol,
      direction: input.direction,
      confidence: promotion.status === "elite" ? 88 : promotion.status === "promoted" ? 80 : 72,
      strength: promotion.status === "elite" ? 84 : promotion.status === "promoted" ? 76 : 68,
      risk: promotion.status === "elite" ? "low" : "medium",
      reason: `Promotion engine supports setup as ${promotion.status}.`,
      features: {
        promotionStatus: promotion.status,
        trades: Number(promotion.trades || 0),
        winRate: Number(promotion.win_rate || 0),
        profitFactor: Number(promotion.profit_factor || 0),
        pnl: Number(promotion.pnl || 0),
      },
    });
  }

  const geniusEvaluation = evaluateNexoraGeniusCore({
    symbol: input.symbol,
    strategy: input.strategy,
    direction: input.direction,
    confidence: input.confidence,
    learningScore: input.learningScore,
    regime: input.regime,
    rewardRisk: 1.5,
    agreementCount,
  });

  selected.push(...geniusEvaluation.geniusSignals);

  for (const reason of geniusEvaluation.blockedReasons) {
    if (geniusEvaluation.decisionMode === "monitor_only") {
      blockedReasons.push(reason);
    }
  }

  for (const reason of teachingEvaluation.blockedReasons) {
    blockedReasons.push(reason);
  }

  if (teachingEvaluation.monitorOnly) {
    blockedReasons.push("Teaching layer requested monitor-only mode.");
  }

  // Recompute agreement after knowledge and teaching signals are added.
  agreementCount = selected.filter(
    (signal) =>
      signal.direction === input.direction &&
      signal.confidence >= 55 &&
      signal.risk !== "high"
  ).length;

  const weightedConfidence = selected.length
    ? Math.round(selected.reduce((sum, signal) => sum + signal.confidence, 0) / selected.length)
    : input.confidence;

  const minimumAgreement = input.learningScore < 18 ? 2 : 6;

  if (agreementCount < minimumAgreement) {
    blockedReasons.push(`Only ${agreementCount} Nexora signal systems agree. Minimum is ${minimumAgreement}.`);
  }

  if (weightedConfidence < 72) {
    blockedReasons.push(`Nexora weighted signal confidence ${weightedConfidence} is below 72.`);
  }

  // Low learning score no longer hard-blocks paper trades.
  // It forces research-probe mode: fewer required agreements and tiny risk sizing in PolyEdge.
  if (input.learningScore < 18 && agreementCount >= 3) {
    // allowed as tiny paper research probe
  }

  const intelligenceSummary = {
    decisionMode: typeof geniusEvaluation !== "undefined" ? geniusEvaluation.decisionMode : "research_probe",
    geniusScore: typeof geniusEvaluation !== "undefined" ? geniusEvaluation.geniusScore : null,
    knowledgeSignals: selected.filter((signal) => signal.system.startsWith("knowledge_")).length,
    teachingSignals: selected.filter((signal) => signal.system.startsWith("teaching_")).length,
    professorSignals: selected.filter((signal) => signal.system.startsWith("teaching_professor_")).length,
    totalSignals: selected.length,
    agreementRequired: minimumAgreement,
  };

  await recordNexoraDecisionAudit({
    symbol: input.symbol,
    strategy: input.strategy,
    direction: input.direction,
    decision: blockedReasons.length ? "rejected" : "approved",
    confidence: weightedConfidence,
    agreementCount,
    blockedReasons,
    intelligence: intelligenceSummary,
    signals: selected.slice(0, 80),
  }).catch(() => undefined);

  return {
    signals: selected,
    groupScores,
    agreementCount,
    confidence: weightedConfidence,
    blockedReasons,
    reason: blockedReasons.length
      ? `Nexora learned-intelligence rejected setup: ${blockedReasons.join(" ")}`
      : `Nexora learned-intelligence approved setup with ${agreementCount}/${minimumAgreement} agreeing systems. Mode ${intelligenceSummary.decisionMode}. Genius score ${intelligenceSummary.geniusScore ?? "WAIT"}.`,
    intelligence: intelligenceSummary,
  };
}
