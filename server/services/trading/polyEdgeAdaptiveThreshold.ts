import { getPolyEdgeLearning } from "./polyEdgeLearningService";

export type PolyEdgeAdaptiveThresholdInput = {
  baseThreshold: number;
  strategy?: string | null;
  market?: string | null;
  direction?: string | null;
  confidence?: number | null;
};

export type PolyEdgeAdaptiveThresholdResult = {
  threshold: number;
  baseThreshold: number;
  adjusted: boolean;
  appliesToLiveTrading: false;
  reason: string;
  matchedSignals: Array<{
    dimension: string;
    label: string;
    learningScore?: number;
    samples?: number;
    winRate?: number;
    profitFactor?: number;
    recommendation?: string;
  }>;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function norm(value: unknown): string {
  return String(value || "unknown").trim().toLowerCase();
}

function findMatch(groups: any[] | undefined, label: unknown) {
  const target = norm(label);
  if (!groups || !target || target === "unknown") return null;
  return groups.find((g) => norm(g.label) === target) || null;
}

function asSignal(g: any) {
  return {
    dimension: String(g.dimension || "unknown"),
    label: String(g.label || "unknown"),
    learningScore: Number(g.learningScore || 0),
    samples: Number(g.samples || 0),
    winRate: Number(g.winRate || 0),
    profitFactor: Number(g.profitFactor || 0),
    recommendation: String(g.recommendation || "continue_observing"),
  };
}

export async function getPolyEdgeAdaptivePaperThreshold(
  input: PolyEdgeAdaptiveThresholdInput
): Promise<PolyEdgeAdaptiveThresholdResult> {
  const baseThreshold = clamp(Number(input.baseThreshold || 70), 50, 95);

  try {
    const learning = await getPolyEdgeLearning("admin");
    const byDimension = (learning as any).byDimension || {};

    const matches = [
      findMatch(byDimension.strategy, input.strategy),
      findMatch(byDimension.symbol, input.market),
      findMatch(byDimension.direction, input.direction),
    ].filter(Boolean);

    let threshold = baseThreshold;
    const matchedSignals = matches.map(asSignal);
    const reasons: string[] = [];

    for (const signal of matchedSignals) {
      if (signal.samples < 10) {
        reasons.push(`${signal.dimension}:${signal.label} has insufficient sample (${signal.samples})`);
        continue;
      }

      if (
        signal.recommendation === "increase_size_slightly" &&
        signal.learningScore >= 70 &&
        signal.winRate >= 58 &&
        signal.profitFactor >= 1.25
      ) {
        threshold -= 3;
        reasons.push(`${signal.dimension}:${signal.label} is strong; lowered paper threshold by 3`);
      }

      if (
        signal.recommendation === "reduce_or_pause" ||
        signal.recommendation === "avoid_until_retrained" ||
        signal.learningScore < 40 ||
        signal.profitFactor < 1
      ) {
        threshold += 7;
        reasons.push(`${signal.dimension}:${signal.label} is weak; raised paper threshold by 7`);
      }
    }

    const globalRecommended = Number((learning as any).adaptiveThreshold?.recommendedPaperConfidenceThreshold || baseThreshold);
    if (Number.isFinite(globalRecommended) && globalRecommended !== baseThreshold) {
      threshold = Math.round((threshold + globalRecommended) / 2);
      reasons.push(`blended with global learning threshold ${globalRecommended}`);
    }

    threshold = clamp(Math.round(threshold), 55, 90);

    return {
      threshold,
      baseThreshold,
      adjusted: threshold !== baseThreshold,
      appliesToLiveTrading: false,
      reason: reasons.length ? reasons.join("; ") : "No trusted learning adjustment; using base paper threshold.",
      matchedSignals,
    };
  } catch (err: any) {
    return {
      threshold: baseThreshold,
      baseThreshold,
      adjusted: false,
      appliesToLiveTrading: false,
      reason: `Learning unavailable; using base paper threshold. ${err?.message || ""}`.trim(),
      matchedSignals: [],
    };
  }
}
