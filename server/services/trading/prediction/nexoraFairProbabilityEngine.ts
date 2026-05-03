type SourceSignal = {
  source: string;
  probability?: number;
  confidence?: number;
  reliability?: number;
  weight?: number;
};

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function calculateNexoraFairProbability(input: any = {}) {
  const signals: SourceSignal[] = Array.isArray(input.signals) ? input.signals : [];

  const normalized = signals
    .map((s) => {
      const probability = clamp01(n(s.probability));
      const confidence = clamp01(n(s.confidence, 0.5));
      const reliability = clamp01(n(s.reliability, 0.5));
      const manualWeight = n(s.weight, 1);
      const effectiveWeight = Math.max(0, manualWeight * confidence * reliability);

      return {
        source: String(s.source || "unknown"),
        probability,
        confidence,
        reliability,
        manualWeight,
        effectiveWeight,
      };
    })
    .filter((s) => s.effectiveWeight > 0);

  const totalWeight = normalized.reduce((sum, s) => sum + s.effectiveWeight, 0);
  const fairProbability =
    totalWeight > 0
      ? normalized.reduce((sum, s) => sum + s.probability * s.effectiveWeight, 0) / totalWeight
      : clamp01(n(input.priorProbability, 0.5));

  const disagreement =
    normalized.length > 1
      ? normalized.reduce((sum, s) => sum + Math.abs(s.probability - fairProbability), 0) / normalized.length
      : 0;

  const confidence = clamp01(
    totalWeight / Math.max(1, normalized.length) * (1 - Math.min(0.5, disagreement))
  );

  return {
    ok: true,
    service: "nexora_fair_probability_engine",
    paperOnly: true,
    marketId: input.marketId || null,
    title: input.title || null,
    fairProbability: Math.round(fairProbability * 10000) / 10000,
    fairProbabilityPct: Math.round(fairProbability * 10000) / 100,
    confidence: Math.round(confidence * 10000) / 10000,
    confidencePct: Math.round(confidence * 10000) / 100,
    disagreement: Math.round(disagreement * 10000) / 10000,
    sourceCount: normalized.length,
    sources: normalized,
    rule: "Combine odds, polls, sentiment, macro, crypto, sports, news and historical signals into one calibrated fair probability.",
    updatedAt: new Date().toISOString(),
  };
}
