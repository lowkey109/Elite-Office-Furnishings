export type PropertyScoreInput = {
  signalType?: string | null;
  sourceType?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  sourcePublishedAt?: string | null;
  city?: string | null;
  state?: string | null;
  estimatedSeats?: number | null;
  estimatedSqm?: number | null;
  estimatedProjectValue?: number | null;
  listingStatus?: string | null;
  projectStage?: string | null;
  extractedAt?: string | null;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function ageDays(date?: string | null) {
  if (!date) return 999;
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return 999;
  return Math.max(0, Math.round((Date.now() - t) / 86400000));
}

export function scorePropertyOpportunity(input: PropertyScoreInput) {
  const signal = String(input.signalType || "").toLowerCase();
  const sourceType = String(input.sourceType || "").toLowerCase();
  const stage = String(input.projectStage || input.listingStatus || "").toLowerCase();
  const days = ageDays(input.sourcePublishedAt || input.extractedAt);

  const sourceReliability =
    input.sourceUrl ? 25 :
    sourceType.includes("manual") ? 18 :
    sourceType.includes("map") ? 16 :
    10;

  const freshness =
    days <= 7 ? 25 :
    days <= 30 ? 18 :
    days <= 90 ? 10 :
    3;

  const projectValue =
    (input.estimatedProjectValue || 0) >= 250000 ? 20 :
    (input.estimatedSqm || 0) >= 1000 ? 16 :
    (input.estimatedSeats || 0) >= 80 ? 14 :
    (input.estimatedSeats || 0) >= 20 ? 8 :
    4;

  const relocationLikelihood =
    signal.includes("relocation") || signal.includes("office_move") ? 20 :
    signal.includes("lease") || signal.includes("tenant") ? 14 :
    signal.includes("new_office") || signal.includes("expansion") ? 12 :
    5;

  const fitoutLikelihood =
    signal.includes("fitout") || signal.includes("new_office") || signal.includes("expansion") ? 18 :
    stage.includes("construction") || stage.includes("planning") || stage.includes("listing") ? 10 :
    4;

  const furnitureLikelihood =
    signal.includes("office") || signal.includes("fitout") || signal.includes("display") ? 18 :
    (input.estimatedSeats || 0) > 0 ? 12 :
    5;

  const financeLikelihood =
    (input.estimatedProjectValue || 0) >= 100000 ? 14 :
    (input.estimatedSeats || 0) >= 40 ? 8 :
    3;

  const residentialSaleLikelihood =
    signal.includes("house_for_sale") ? 20 :
    signal.includes("unit_for_sale") ? 16 :
    signal.includes("townhouse_for_sale") ? 16 :
    signal.includes("land_for_sale") ? 14 :
    signal.includes("residential_listing") ? 18 :
    signal.includes("new_home_listing") ? 18 :
    signal.includes("builder_inventory") ? 20 :
    signal.includes("display_home") ? 16 :
    signal.includes("development_site") ? 18 :
    signal.includes("project_marketing") ? 14 :
    0;

  const confidenceScore = clamp(sourceReliability + freshness + relocationLikelihood + fitoutLikelihood);
  const opportunityScore = clamp(projectValue + relocationLikelihood + fitoutLikelihood + furnitureLikelihood + financeLikelihood + residentialSaleLikelihood);
  const urgencyScore = clamp(freshness + relocationLikelihood + (stage.includes("active") ? 20 : 0));

  return {
    confidenceScore,
    opportunityScore,
    urgencyScore,
    scoreBreakdown: {
      sourceReliability,
      freshness,
      projectValue,
      relocationLikelihood,
      fitoutLikelihood,
      furnitureLikelihood,
      financeLikelihood,
      dataAgeDays: days,
    },
  };
}
