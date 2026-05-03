import { runNexoraAdvancedPredictionCore } from "../prediction/nexoraAdvancedPredictionCore";
import { simulateNexoraPredictionOrderBook } from "../prediction/nexoraOrderBookSimulator";
import { runNexoraMonteCarloSimulation } from "../simulation/nexoraOmegaSimulationGrid";
import { runNexoraInstitutionalExecutionPreflight } from "../execution/nexoraInstitutionalExecutionLayer";
import { queueNexoraPaperExecution } from "../execution/nexoraInstitutionalExecutionLayerTwo";

export async function runNexoraAlphaOrchestrator(input: any = {}) {
  const markets = Array.isArray(input.markets) ? input.markets : [];
  const bankrollUsd = Number(input.bankrollUsd || 1000);

  const decisions = [];

  for (const market of markets.slice(0, 20)) {
    const core = await runNexoraAdvancedPredictionCore({ ...market, bankrollUsd });

    const fallback = (core as any).fallbackDecision;
    const approvedCandidate = Array.isArray(fallback?.approved) ? fallback.approved[0] : null;

    const modelProbability = Number((core as any).fairProbability?.fairProbability || market.modelProbability || 0.5);
    const marketProbability = Number(market.marketProbability || market.price || 0.5);
    const edgePct = Math.round((modelProbability - marketProbability) * 10000) / 100;

    const amountUsd =
      Math.abs(edgePct) >= 15 ? bankrollUsd * 0.03 :
      Math.abs(edgePct) >= 10 ? bankrollUsd * 0.02 :
      Math.abs(edgePct) >= 7 ? bankrollUsd * 0.01 :
      0;

    const orderBook = simulateNexoraPredictionOrderBook({
      side: approvedCandidate?.finalAction || approvedCandidate?.selected?.direction || "NO_TRADE",
      limitPrice: marketProbability,
      fairProbability: modelProbability,
      liquidityUsd: Number(market.liquidityUsd || 0),
      spreadPct: Number(market.spreadPct || 100),
      orderUsd: amountUsd,
    });

    const simulation = await runNexoraMonteCarloSimulation({
      marketId: market.marketId,
      strategy: approvedCandidate?.selected?.name || "unknown",
      edgePct,
      bankrollUsd,
      runs: Number(input.simulationRuns || 500),
    });

    const preflight = await runNexoraInstitutionalExecutionPreflight({
      marketId: market.marketId,
      direction: approvedCandidate?.finalAction || "NO_TRADE",
      limitPrice: marketProbability,
      bankrollUsd,
      openRiskUsd: amountUsd,
      dailyPnl: Number(input.dailyPnl || 0),
      paperSampleSize: Number(input.paperSampleSize || 0),
      requiresPromotion: false,
    });

    const approved =
      Boolean((core as any).approved) &&
      Boolean(orderBook.approved) &&
      Boolean(preflight.allowed) &&
      Number(simulation.confidence || 0) >= 70 &&
      amountUsd > 0;

    let queue = null;

    if (approved) {
      queue = await queueNexoraPaperExecution({
        marketId: market.marketId,
        direction: approvedCandidate?.finalAction || "PAPER_SIGNAL",
        limitPrice: marketProbability,
        amountUsd,
        bankrollUsd,
        marketType: "prediction_market",
        country: input.country || "AU",
      });
    }

    decisions.push({
      marketId: market.marketId,
      title: market.title,
      approved,
      finalAction: approved ? approvedCandidate?.finalAction : "MONITOR_ONLY",
      amountUsd: approved ? Math.round(amountUsd * 100) / 100 : 0,
      edgePct,
      core,
      orderBook,
      simulation,
      preflight,
      queue,
      reason: approved
        ? "Alpha orchestrator approved paper execution."
        : "Monitor only: one or more institutional gates failed.",
    });
  }

  return {
    ok: true,
    service: "nexora_alpha_orchestrator",
    paperOnly: true,
    scannedCount: markets.length,
    decisionCount: decisions.length,
    approvedCount: decisions.filter((d) => d.approved).length,
    decisions,
    rule: "Advanced core → fallback stack → order-book sim → Monte Carlo → institutional preflight → paper queue.",
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraAlphaOrchestratorStatus() {
  return {
    ok: true,
    service: "nexora_alpha_orchestrator",
    paperOnly: true,
    systemsConnected: [
      "advanced prediction core",
      "fallback strategy stack",
      "order-book simulator",
      "Monte Carlo simulator",
      "institutional preflight",
      "paper execution queue",
      "risk-off monitor mode"
    ],
    status: "Alpha orchestration layer active.",
    updatedAt: new Date().toISOString(),
  };
}
