// ─── Signal Classification Service ───────────────────────────────────────────
// Classifies raw signal types into canonical workspace intelligence categories.

export type WorkspaceSignalClass =
  | "office_move"
  | "expansion"
  | "sublease"
  | "new_market"
  | "consolidation"
  | "unknown";

export type CommercialTier = "premium" | "upper" | "mid" | "entry";

interface SignalClassification {
  classification: WorkspaceSignalClass;
  commercialTier: CommercialTier;
  primaryCategory: string;
  tags: string[];
}

const SIGNAL_TYPE_MAP: Record<string, WorkspaceSignalClass> = {
  office_move: "office_move",
  relocation_signal: "office_move",
  building_move_signal: "office_move",
  new_lease: "office_move",
  lease_activity: "office_move",
  hiring_growth: "expansion",
  hiring_surge: "expansion",
  hiring_spike: "expansion",
  funding: "expansion",
  funding_growth: "expansion",
  new_office_signal: "new_market",
  new_office_opening: "new_market",
  startup_expansion: "new_market",
  coworking_exit: "new_market",
  sublease: "sublease",
  tenant_move_in: "consolidation",
  refurbishment: "consolidation",
};

const INDUSTRY_TIER_MAP: Record<string, CommercialTier> = {
  finance: "premium",
  banking: "premium",
  legal: "premium",
  consulting: "upper",
  technology: "upper",
  tech: "upper",
  software: "upper",
  healthcare: "mid",
  retail: "mid",
  education: "mid",
  manufacturing: "entry",
  logistics: "entry",
  construction: "entry",
};

export function classifySignalType(signalType: string): WorkspaceSignalClass {
  return SIGNAL_TYPE_MAP[signalType] ?? "unknown";
}

export function inferCommercialTier(industry?: string, estimatedProjectValue?: number): CommercialTier {
  if (estimatedProjectValue) {
    if (estimatedProjectValue >= 500_000) return "premium";
    if (estimatedProjectValue >= 200_000) return "upper";
    if (estimatedProjectValue >= 50_000) return "mid";
    return "entry";
  }

  if (industry) {
    const lower = industry.toLowerCase();
    for (const [key, tier] of Object.entries(INDUSTRY_TIER_MAP)) {
      if (lower.includes(key)) return tier;
    }
  }

  return "mid";
}

export function buildSignalTags(params: {
  signalType: string;
  city: string;
  industry?: string;
  confidenceScore: number;
  relocationProbability: number;
}): string[] {
  const tags: string[] = [];

  if (params.relocationProbability >= 75) tags.push("high-relocation-probability");
  if (params.relocationProbability >= 50) tags.push("relocation-likely");
  if (params.confidenceScore >= 80) tags.push("high-confidence");
  if (params.confidenceScore < 40) tags.push("low-confidence");

  const cities = ["sydney", "melbourne", "brisbane", "perth", "adelaide"];
  if (cities.includes(params.city.toLowerCase())) tags.push("tier-1-city");
  else tags.push("regional");

  if (params.industry) tags.push(`industry:${params.industry.toLowerCase()}`);
  tags.push(`signal:${params.signalType}`);

  return tags;
}

export function classify(params: {
  signalType: string;
  industry?: string;
  city: string;
  confidenceScore: number;
  relocationProbability: number;
  estimatedProjectValue?: number;
}): SignalClassification {
  const classification = classifySignalType(params.signalType);
  const commercialTier = inferCommercialTier(params.industry, params.estimatedProjectValue);
  const tags = buildSignalTags(params);

  return {
    classification,
    commercialTier,
    primaryCategory: params.signalType,
    tags,
  };
}
