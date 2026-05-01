import { classifyNexoraMarketRegime } from "../regime/nexoraMarketRegimeEngine";

export async function evaluateNexoraTimeframeAgreement(input: {
  symbol: string;
  direction: "long" | "short";
}) {
  const snapshots = await Promise.allSettled([
    classifyNexoraMarketRegime({ symbol: input.symbol, timeframe: "1m" }),
    classifyNexoraMarketRegime({ symbol: input.symbol, timeframe: "5m" }),
  ]);

  const regimes = snapshots
    .map((s) => (s.status === "fulfilled" ? s.value : null))
    .filter((s: any) => s?.ok);

  const supports = regimes.filter((r: any) => {
    if (r.regime === "squeeze") return true;
    if (input.direction === "long") return r.regime === "trend_up";
    if (input.direction === "short") return r.regime === "trend_down";
    return false;
  });

  const riskOff = regimes.some((r: any) => r.regime === "risk_off");
  const agreementRatio = regimes.length ? supports.length / regimes.length : 0;

  let status: "blocked" | "weak" | "partial" | "strong" = "weak";
  if (riskOff) status = "blocked";
  else if (agreementRatio >= 1) status = "strong";
  else if (agreementRatio >= 0.5) status = "partial";

  return {
    ok: status !== "blocked",
    service: "nexora_timeframe_agreement_engine",
    symbol: input.symbol,
    direction: input.direction,
    status,
    agreementRatio,
    regimes,
    reason: riskOff
      ? "A timeframe is risk-off."
      : `${supports.length}/${regimes.length} timeframes support ${input.direction}.`,
    updatedAt: new Date().toISOString(),
  };
}
