function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function simulateNexoraPredictionOrderBook(input: any = {}) {
  const side = String(input.side || "BUY_YES");
  const limitPrice = n(input.limitPrice, n(input.marketProbability, 0.5));
  const fairProbability = n(input.fairProbability || input.modelProbability, 0.5);
  const spreadPct = n(input.spreadPct, 100);
  const liquidityUsd = n(input.liquidityUsd, 0);
  const orderUsd = n(input.orderUsd || input.positionUsd, 0);

  const fillQuality =
    liquidityUsd <= 0 ? 0 :
    Math.max(0, Math.min(1, (liquidityUsd / Math.max(1, orderUsd * 20)) * (1 - Math.min(0.9, spreadPct / 20))));

  const estimatedSlippagePct =
    liquidityUsd <= 0 ? 100 :
    Math.min(20, Math.max(0, (orderUsd / Math.max(1, liquidityUsd)) * 100 + spreadPct / 2));

  const expectedEdgePct =
    side.includes("NO")
      ? Math.round((limitPrice - fairProbability) * 10000) / 100
      : Math.round((fairProbability - limitPrice) * 10000) / 100;

  const approved = fillQuality >= 0.45 && estimatedSlippagePct <= 3 && expectedEdgePct >= 2;

  return {
    ok: true,
    service: "nexora_order_book_simulator",
    paperOnly: true,
    side,
    limitPrice,
    fairProbability,
    liquidityUsd,
    orderUsd,
    spreadPct,
    fillQuality,
    estimatedSlippagePct: Math.round(estimatedSlippagePct * 100) / 100,
    expectedEdgePct,
    approved,
    reason: approved ? "Order can likely fill with acceptable slippage." : "Order book quality insufficient.",
    rule: "Nexora simulates fill quality before any paper/live execution.",
    updatedAt: new Date().toISOString(),
  };
}
