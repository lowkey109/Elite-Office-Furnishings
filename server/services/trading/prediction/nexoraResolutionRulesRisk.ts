function includesAny(text: string, patterns: string[]) {
  return patterns.some((p) => text.includes(p));
}

export function checkNexoraResolutionRules(input: any = {}) {
  const title = String(input.title || "");
  const rules = String(input.rules || input.resolutionRules || "");
  const text = `${title} ${rules}`.toLowerCase();

  const vagueFlags = [
    "unclear",
    "ambiguous",
    "subject to",
    "at discretion",
    "may resolve",
    "unofficial",
    "rumor",
    "rumour",
    "according to social media",
    "will be determined",
    "to be announced",
    "tba",
    "other sources",
    "substantially",
    "materially",
    "intent",
    "credible reports",
  ];

  const strongFlags = [
    "official",
    "published by",
    "final result",
    "settled by",
    "according to",
    "reported by",
    "certified",
    "court filing",
    "government",
    "exchange",
    "league",
    "federal reserve",
    "bureau",
  ];

  const vague = includesAny(text, vagueFlags);
  const hasStrongSource = includesAny(text, strongFlags);
  const hasRules = rules.trim().length >= 40;

  const riskScore =
    (!hasRules ? 40 : 0) +
    (vague ? 35 : 0) +
    (!hasStrongSource ? 20 : 0);

  const clear = riskScore < 40;

  const blockedReasons: string[] = [];
  if (!hasRules) blockedReasons.push("Resolution rules are missing or too short.");
  if (vague) blockedReasons.push("Resolution language appears vague or discretionary.");
  if (!hasStrongSource) blockedReasons.push("No strong official resolution source detected.");

  return {
    ok: true,
    service: "nexora_resolution_rules_risk",
    paperOnly: true,
    marketId: input.marketId || null,
    title,
    clear,
    riskScore,
    riskLevel: riskScore >= 70 ? "high" : riskScore >= 40 ? "medium" : "low",
    tradeAllowed: clear,
    blockedReasons,
    rule: "If resolution rules are unclear, vague, discretionary, or lack official source grounding, Nexora does not trade.",
    updatedAt: new Date().toISOString(),
  };
}
