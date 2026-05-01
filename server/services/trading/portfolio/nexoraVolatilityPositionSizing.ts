export function calculateNexoraVolatilityPositionSizing(input: {
  confidence: number;
  atr: number;
  price: number;
  portfolioRiskState?: "low" | "medium" | "high";
}) {
  const confidence = Number(input.confidence || 50);
  const atr = Math.max(0.0001, Number(input.atr || 0));
  const price = Math.max(0.0001, Number(input.price || 1));

  const normalizedVolatility = atr / price;

  let baseRisk =
    confidence >= 80
      ? 0.02
      : confidence >= 70
        ? 0.015
        : 0.01;

  if (input.portfolioRiskState === "high") {
    baseRisk *= 0.4;
  } else if (input.portfolioRiskState === "medium") {
    baseRisk *= 0.7;
  }

  const positionSizeMultiplier =
    normalizedVolatility >= 0.02
      ? 0.4
      : normalizedVolatility >= 0.01
        ? 0.7
        : 1;

  const finalRisk = baseRisk * positionSizeMultiplier;

  return {
    ok: true,
    service: "nexora_volatility_position_sizing",
    confidence,
    atr,
    price,
    normalizedVolatility,
    baseRisk,
    positionSizeMultiplier,
    finalRisk,
    suggestedLeverage:
      normalizedVolatility >= 0.02
        ? 1
        : normalizedVolatility >= 0.01
          ? 2
          : 3,
    updatedAt: new Date().toISOString(),
  };
}
