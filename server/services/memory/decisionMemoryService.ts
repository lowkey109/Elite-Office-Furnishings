export type DecisionMemoryEvent = {
  id: string;
  decisionId: string;
  moduleKey: string;
  intent: string;
  actionTaken: string;
  outcome?: "pending" | "won" | "lost" | "neutral" | "blocked" | "failed";
  revenueAmount?: number | null;
  marginAmount?: number | null;
  timeToOutcomeMs?: number | null;
  confidenceBefore?: number | null;
  confidenceAfter?: number | null;
  learningDelta?: number | null;
  evidence?: Record<string, unknown>;
  createdAt: string;
};

export type LearningUpdateInput = {
  decisionId: string;
  moduleKey: string;
  intent: string;
  actionTaken: string;
  outcome?: DecisionMemoryEvent["outcome"];
  revenueAmount?: number | null;
  marginAmount?: number | null;
  timeToOutcomeMs?: number | null;
  confidenceBefore?: number | null;
  evidence?: Record<string, unknown>;
};

function safeNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function scoreOutcome(input: LearningUpdateInput): number {
  const revenue = safeNumber(input.revenueAmount) ?? 0;
  const margin = safeNumber(input.marginAmount) ?? 0;

  if (input.outcome === "won") return Math.min(15, 5 + revenue / 10000 + margin / 5000);
  if (input.outcome === "lost") return -8;
  if (input.outcome === "failed") return -10;
  if (input.outcome === "blocked") return -3;
  return 0;
}

export function buildDecisionMemoryEvent(input: LearningUpdateInput): DecisionMemoryEvent {
  const confidenceBefore = safeNumber(input.confidenceBefore);
  const learningDelta = scoreOutcome(input);
  const confidenceAfter =
    confidenceBefore === null
      ? null
      : Math.max(0, Math.min(100, confidenceBefore + learningDelta));

  return {
    id: `mem_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    decisionId: input.decisionId,
    moduleKey: input.moduleKey,
    intent: input.intent,
    actionTaken: input.actionTaken,
    outcome: input.outcome ?? "pending",
    revenueAmount: safeNumber(input.revenueAmount),
    marginAmount: safeNumber(input.marginAmount),
    timeToOutcomeMs: safeNumber(input.timeToOutcomeMs),
    confidenceBefore,
    confidenceAfter,
    learningDelta,
    evidence: input.evidence ?? {},
    createdAt: new Date().toISOString(),
  };
}

export function summarizeDecisionMemory(events: DecisionMemoryEvent[]) {
  const total = events.length;
  const wins = events.filter(e => e.outcome === "won").length;
  const losses = events.filter(e => e.outcome === "lost").length;
  const failed = events.filter(e => e.outcome === "failed").length;
  const revenue = events.reduce((sum, e) => sum + (e.revenueAmount ?? 0), 0);
  const margin = events.reduce((sum, e) => sum + (e.marginAmount ?? 0), 0);

  return {
    total,
    wins,
    losses,
    failed,
    winRate: total ? wins / total : 0,
    revenue,
    margin,
    averageLearningDelta: total
      ? events.reduce((sum, e) => sum + (e.learningDelta ?? 0), 0) / total
      : 0,
  };
}
