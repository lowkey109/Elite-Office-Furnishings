import { runNexoraAdvancedPredictionCore } from "./nexoraAdvancedPredictionCore";
import { simulateNexoraPredictionOrderBook } from "./nexoraOrderBookSimulator";
import { recordNexoraPredictionPaperDecision } from "./nexoraPredictionPaperJournal";

export async function runNexoraPredictionAutoPaperLoop(input: any = {}) {
  const markets = Array.isArray(input.markets) ? input.markets : [];
  const bankrollUsd = Number(input.bankrollUsd || 1000);

  const decisions = [];

  for (const market of markets.slice(0, 25)) {
    const core = await runNexoraAdvancedPredictionCore({ ...market, bankrollUsd });

    const approved = Array.isArray((core as any).fallbackDecision?.approved)
      ? (core as any).fallbackDecision.approved[0]
      : null;

    const edge = approved?.edge || {};
    const positionUsd = Number(edge?.risk?.positionUsd || 0);

    const orderBook = simulateNexoraPredictionOrderBook({
      side: approved?.finalAction || approved?.selected?.direction || edge.direction,
      limitPrice: Number(market.marketProbability || market.price || 0.5),
      fairProbability: Number((core as any).fairProbability?.fairProbability || market.modelProbability || 0.5),
      liquidityUsd: Number(market.liquidityUsd || 0),
      spreadPct: Number(market.spreadPct || 100),
      orderUsd: positionUsd,
    });

    const finalApproved = Boolean((core as any).approved) && Boolean(orderBook.approved) && positionUsd > 0;

    const decision = {
      ok: true,
      paperOnly: true,
      marketId: market.marketId,
      title: market.title,
      category: market.category || "unknown",
      finalApproved,
      finalAction: finalApproved ? approved.finalAction : "MONITOR_ONLY",
      core,
      orderBook,
      positionUsd: finalApproved ? positionUsd : 0,
      reason: finalApproved ? "Prediction paper signal approved." : "Monitor only: one or more gates failed.",
      updatedAt: new Date().toISOString(),
    };

    if (finalApproved) {
      await recordNexoraPredictionPaperDecision({
        id: `${market.marketId || market.title || "market"}|${Date.now()}`,
        marketId: market.marketId,
        title: market.title,
        category: market.category,
        strategy: "advanced_prediction_market_stack",
        direction: decision.finalAction,
        marketProbability: Number(market.marketProbability || market.price || 0),
        modelProbability: Number((core as any).fairProbability?.fairProbability || 0),
        edgePct: Number(approved?.edge?.edgePct || 0),
        positionUsd,
        status: "open",
        decision,
      });
    }

    decisions.push(decision);
  }

  return {
    ok: true,
    service: "nexora_prediction_auto_paper_loop",
    paperOnly: true,
    scannedCount: markets.length,
    decisionCount: decisions.length,
    approvedCount: decisions.filter((d) => d.finalApproved).length,
    decisions,
    rule: "Score → advanced core → fallback selector → order-book sim → paper journal → learning loop.",
    updatedAt: new Date().toISOString(),
  };
}
