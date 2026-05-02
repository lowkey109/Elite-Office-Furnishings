import { getNexoraProofMetrics } from "./nexoraProofMetrics";

export async function getNexoraPromotionGate(input: { symbol?: string; strategy?: string; direction?: string }) {
  const proof = await getNexoraProofMetrics({ ...input, limit: 150 });

  let stage = "paper_learning";
  let next = "Keep collecting paper data.";
  let tradeMode = "paper_only";

  if (proof.winRate >= 80 && proof.profitFactor >= 1.8 && proof.trades >= 100 && proof.pnl > 0 && proof.maxDrawdown > -25) {
    stage = "tiny_live_sandbox_eligible";
    next = "Eligible for tiny capped live sandbox if environment unlock is enabled.";
    tradeMode = "tiny_live_sandbox_candidate";
  } else if (proof.winRate >= 70 && proof.profitFactor >= 1.4 && proof.trades >= 75 && proof.pnl > 0) {
    stage = "scaled_paper_testing";
    next = "Scale paper testing only.";
    tradeMode = "scaled_paper";
  } else if (proof.winRate >= 60 && proof.profitFactor >= 1.1 && proof.trades >= 50) {
    stage = "tiny_paper_probe";
    next = "Allow tiny paper probes only.";
    tradeMode = "tiny_paper";
  }

  return {
    ok: true,
    service: "nexora_promotion_gate",
    paperOnly: tradeMode !== "tiny_live_sandbox_candidate",
    input,
    proof,
    stage,
    tradeMode,
    next,
    rules: {
      paperLearning: "<60% or weak PF",
      tinyPaperProbe: "60–70% with PF >= 1.1 and 50+ samples",
      scaledPaperTesting: "70–80% with PF >= 1.4 and positive PnL",
      tinyLiveSandboxEligible: "80%+ with PF >= 1.8, 100+ samples, positive PnL, drawdown controlled",
    },
    updatedAt: new Date().toISOString(),
  };
}
