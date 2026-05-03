export function critiqueNexoraPredictionTrade(input: any = {}) {
  const risks: string[] = [];

  if (Number(input.edgePct || 0) < 7) risks.push("Edge may be too small after fees/slippage.");
  if (Number(input.liquidityUsd || 0) < 1000) risks.push("Liquidity may be too weak.");
  if (Number(input.spreadPct || 100) > 3) risks.push("Spread may damage expected value.");
  if (input.resolutionClear === false) risks.push("Resolution rules may be unclear.");
  if (Number(input.modelConfidence || 0) < 0.6) risks.push("Model confidence may be weak.");
  if (Number(input.correlationExposurePct || 0) > 8) risks.push("Hidden correlated exposure may be too high.");

  return {
    ok: true,
    service: "nexora_self_critique",
    paperOnly: true,
    passed: risks.length === 0,
    risks,
    verdict: risks.length === 0 ? "TRADE_CAN_PROCEED_TO_PAPER" : "MONITOR_ONLY",
    rule: "Before every trade Nexora must ask: what could make this edge fake?",
    updatedAt: new Date().toISOString(),
  };
}
