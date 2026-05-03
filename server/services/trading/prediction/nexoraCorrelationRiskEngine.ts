function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function checkNexoraCorrelationRisk(input: any = {}) {
  const bankrollUsd = n(input.bankrollUsd, 1000);
  const proposedRiskUsd = n(input.proposedRiskUsd, 0);
  const category = String(input.category || "unknown");
  const eventKey = String(input.correlatedEventKey || input.eventKey || input.marketId || "unknown");

  const exposureByEvent = input.exposureByEvent && typeof input.exposureByEvent === "object" ? input.exposureByEvent : {};
  const exposureByCategory = input.exposureByCategory && typeof input.exposureByCategory === "object" ? input.exposureByCategory : {};

  const currentEventExposureUsd = n(exposureByEvent[eventKey], 0);
  const currentCategoryExposureUsd = n(exposureByCategory[category], 0);

  const newEventExposurePct = bankrollUsd > 0 ? (currentEventExposureUsd + proposedRiskUsd) / bankrollUsd : 1;
  const newCategoryExposurePct = bankrollUsd > 0 ? (currentCategoryExposureUsd + proposedRiskUsd) / bankrollUsd : 1;

  const maxEventExposurePct = n(input.maxEventExposurePct, 0.08);
  const maxCategoryExposurePct = n(input.maxCategoryExposurePct, 0.15);

  const eventOk = newEventExposurePct <= maxEventExposurePct;
  const categoryOk = newCategoryExposurePct <= maxCategoryExposurePct;

  const blockedReasons: string[] = [];
  if (!eventOk) blockedReasons.push("Correlated event exposure would exceed limit.");
  if (!categoryOk) blockedReasons.push("Category exposure would exceed limit.");

  return {
    ok: true,
    service: "nexora_correlation_risk_engine",
    paperOnly: true,
    bankrollUsd,
    category,
    correlatedEventKey: eventKey,
    proposedRiskUsd,
    currentEventExposureUsd,
    currentCategoryExposureUsd,
    newEventExposurePct: Math.round(newEventExposurePct * 10000) / 100,
    newCategoryExposurePct: Math.round(newCategoryExposurePct * 10000) / 100,
    maxEventExposurePct: Math.round(maxEventExposurePct * 10000) / 100,
    maxCategoryExposurePct: Math.round(maxCategoryExposurePct * 10000) / 100,
    tradeAllowed: eventOk && categoryOk,
    blockedReasons,
    rule: "Avoid hidden duplicate bets across correlated markets, events and categories.",
    updatedAt: new Date().toISOString(),
  };
}
