// ─── Confidence Scoring Service ───────────────────────────────────────────────
// Produces composite confidence, signal strength, and opportunity scores.

export interface CanonicalScore {
  signalStrength: number;
  confidenceScore: number;
  relocationProbability: number;
  tenantMovementScore: number;
  vacancyRiskScore: number;
  suburbDemandScore: number;
  opportunityScore: number;
  zoneScore: number;
  commercialTier: string;
}

interface ScoringInput {
  signalType: string;
  sourceType?: string;
  city: string;
  industry?: string;
  employeeEstimate?: number;
  signalCount?: number;
  evidenceCount?: number;
  rawStrength?: number;
  rawConfidence?: number;
  rawRelocationProb?: number;
  estimatedProjectValue?: number;
  daysOld?: number;
}

const SOURCE_CREDIBILITY: Record<string, number> = {
  rss: 0.6,
  job_board: 0.75,
  property_feed: 0.85,
  sublease: 0.9,
  funding: 0.8,
  visitor_intent: 0.7,
  manual: 1.0,
};

const SIGNAL_TYPE_BASE_SCORES: Record<string, { strength: number; relocation: number }> = {
  office_move: { strength: 85, relocation: 90 },
  relocation_signal: { strength: 80, relocation: 85 },
  new_lease: { strength: 75, relocation: 70 },
  lease_activity: { strength: 70, relocation: 65 },
  sublease: { strength: 75, relocation: 60 },
  hiring_growth: { strength: 60, relocation: 40 },
  hiring_surge: { strength: 70, relocation: 50 },
  funding: { strength: 65, relocation: 35 },
  funding_growth: { strength: 65, relocation: 35 },
  new_office_signal: { strength: 80, relocation: 75 },
  new_office_opening: { strength: 80, relocation: 75 },
  coworking_exit: { strength: 70, relocation: 70 },
};

const TIER_1_CITIES = new Set(["sydney", "melbourne", "brisbane", "perth", "adelaide", "canberra"]);

function cityMultiplier(city: string): number {
  return TIER_1_CITIES.has(city.toLowerCase()) ? 1.0 : 0.85;
}

function freshnessMultiplier(daysOld: number): number {
  if (daysOld <= 7) return 1.0;
  if (daysOld <= 30) return 0.9;
  if (daysOld <= 90) return 0.75;
  return 0.6;
}

function evidenceBonus(count: number): number {
  return Math.min(15, count * 5);
}

export function computeScore(input: ScoringInput): CanonicalScore {
  const baseScores = SIGNAL_TYPE_BASE_SCORES[input.signalType] ?? { strength: 50, relocation: 30 };
  const credibility = SOURCE_CREDIBILITY[input.sourceType ?? "manual"] ?? 0.8;
  const cityMult = cityMultiplier(input.city);
  const freshness = freshnessMultiplier(input.daysOld ?? 0);
  const evBonus = evidenceBonus(input.evidenceCount ?? 0);
  const signalCountBonus = Math.min(10, (input.signalCount ?? 1) * 2);

  const rawStrength = input.rawStrength ?? baseScores.strength;
  const rawRelocation = input.rawRelocationProb ?? baseScores.relocation;
  const rawConfidence = input.rawConfidence ?? 50;

  const signalStrength = Math.min(100, rawStrength * credibility * cityMult * freshness + evBonus);
  const confidenceScore = Math.min(100, rawConfidence * credibility * freshness + signalCountBonus);
  const relocationProbability = Math.min(100, rawRelocation * cityMult * freshness);

  const tenantMovementScore = Math.min(
    100,
    relocationProbability * 0.5 + signalStrength * 0.3 + confidenceScore * 0.2
  );

  const vacancyRiskScore = Math.min(100, relocationProbability * 0.6 + signalStrength * 0.2);

  const suburbDemandScore = Math.min(100, signalStrength * 0.5 + cityMult * 20);

  const opportunityScore = Math.min(
    100,
    tenantMovementScore * 0.4 + signalStrength * 0.35 + confidenceScore * 0.25
  );

  const zoneScore = Math.min(100, cityMult * 50 + suburbDemandScore * 0.3 + opportunityScore * 0.2);

  const commercialTier =
    (input.estimatedProjectValue ?? 0) >= 500_000
      ? "premium"
      : (input.estimatedProjectValue ?? 0) >= 200_000
      ? "upper"
      : (input.estimatedProjectValue ?? 0) >= 50_000
      ? "mid"
      : "entry";

  return {
    signalStrength: Math.round(signalStrength),
    confidenceScore: Math.round(confidenceScore),
    relocationProbability: Math.round(relocationProbability),
    tenantMovementScore: Math.round(tenantMovementScore),
    vacancyRiskScore: Math.round(vacancyRiskScore),
    suburbDemandScore: Math.round(suburbDemandScore),
    opportunityScore: Math.round(opportunityScore),
    zoneScore: Math.round(zoneScore),
    commercialTier,
  };
}

export function scoreBatch(inputs: ScoringInput[]): CanonicalScore[] {
  return inputs.map(computeScore);
}
