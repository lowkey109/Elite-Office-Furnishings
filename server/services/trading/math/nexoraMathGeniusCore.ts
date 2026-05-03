function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(x: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, x));
}

function normCdf(x: number) {
  return 0.5 * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
}

export function runNexoraMathGeniusCore(input: any = {}) {
  const marketProbability = clamp(n(input.marketProbability ?? input.price, 0.5));
  const modelProbability = clamp(n(input.modelProbability ?? input.fairProbability, 0.5));
  const liquidityUsd = n(input.liquidityUsd, 0);
  const spreadPct = n(input.spreadPct, 100);
  const bankrollUsd = n(input.bankrollUsd, 1000);
  const volatility = clamp(n(input.volatility, 0.35));
  const confidence = clamp(n(input.confidence, 0.65));

  const edge = modelProbability - marketProbability;
  const edgePct = Math.round(edge * 10000) / 100;

  const uncertaintyPenalty = volatility * (1 - confidence);
  const liquidityPenalty = liquidityUsd <= 0 ? 1 : clamp(1000 / liquidityUsd, 0, 1);
  const spreadPenalty = clamp(spreadPct / 10, 0, 1);

  const adjustedEdge = edge - uncertaintyPenalty * 0.05 - spreadPenalty * 0.03 - liquidityPenalty * 0.02;
  const zScore = adjustedEdge / Math.max(0.01, volatility * 0.15);
  const probabilityEdgeIsReal = normCdf(zScore);

  const kellyFractionRaw =
    marketProbability > 0 && marketProbability < 1
      ? ((modelProbability * (1 - marketProbability)) - ((1 - modelProbability) * marketProbability)) / (1 - marketProbability)
      : 0;

  const fractionalKelly = clamp(kellyFractionRaw * 0.25, 0, 0.03);
  const recommendedRiskUsd = Math.round(bankrollUsd * fractionalKelly * 100) / 100;

  const expectedValueUsd = Math.round(recommendedRiskUsd * adjustedEdge * 100) / 100;

  const approved =
    Math.abs(edgePct) >= 7 &&
    probabilityEdgeIsReal >= 0.7 &&
    liquidityUsd >= 1000 &&
    spreadPct <= 5 &&
    recommendedRiskUsd > 0;

  return {
    ok: true,
    service: "nexora_math_genius_core",
    paperOnly: true,
    temporaryMemoryMode: true,
    marketProbability,
    modelProbability,
    edgePct,
    adjustedEdgePct: Math.round(adjustedEdge * 10000) / 100,
    zScore: Math.round(zScore * 10000) / 10000,
    probabilityEdgeIsReal: Math.round(probabilityEdgeIsReal * 10000) / 100,
    fractionalKellyPct: Math.round(fractionalKelly * 10000) / 100,
    recommendedRiskUsd,
    expectedValueUsd,
    approved,
    action: approved ? (edge > 0 ? "PAPER_BUY_YES_MATH_APPROVED" : "PAPER_BUY_NO_MATH_APPROVED") : "MONITOR_ONLY",
    blockedReasons: [
      ...(Math.abs(edgePct) < 7 ? ["Edge below 7%."] : []),
      ...(probabilityEdgeIsReal < 0.7 ? ["Math confidence below 70%."] : []),
      ...(liquidityUsd < 1000 ? ["Liquidity too low."] : []),
      ...(spreadPct > 5 ? ["Spread too wide."] : []),
      ...(recommendedRiskUsd <= 0 ? ["Kelly sizing rejected position."] : []),
    ],
    mathSkills: [
      "expected value",
      "fractional Kelly sizing",
      "uncertainty penalty",
      "spread penalty",
      "liquidity penalty",
      "z-score confidence",
      "probability edge is real",
      "risk-adjusted trade approval",
    ],
    updatedAt: new Date().toISOString(),
  };
}
