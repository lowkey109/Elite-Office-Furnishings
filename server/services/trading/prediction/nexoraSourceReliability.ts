function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function scoreNexoraSourceReliability(input: any = {}) {
  const source = String(input.source || "unknown");
  const historicalAccuracy = n(input.historicalAccuracy, 0.5);
  const latencyScore = n(input.latencyScore, 0.5);
  const manipulationRisk = n(input.manipulationRisk, 0.5);
  const officialness = n(input.officialness, 0.5);
  const recency = n(input.recency, 0.5);

  const reliability =
    historicalAccuracy * 0.35 +
    latencyScore * 0.15 +
    officialness * 0.25 +
    recency * 0.15 +
    (1 - manipulationRisk) * 0.1;

  return {
    ok: true,
    service: "nexora_source_reliability",
    paperOnly: true,
    source,
    reliability: Math.max(0, Math.min(1, reliability)),
    reliabilityPct: Math.round(Math.max(0, Math.min(1, reliability)) * 10000) / 100,
    blocked: reliability < 0.35,
    reason: reliability < 0.35 ? "Source reliability too weak." : "Source usable.",
    updatedAt: new Date().toISOString(),
  };
}
