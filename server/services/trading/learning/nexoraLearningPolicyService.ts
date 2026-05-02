import { getNexoraDecayedPerformance } from "./nexoraDecayedPerformance";
import { classifyNexoraLearningPolicy } from "./nexoraAdaptiveLearningPolicy";

export async function getNexoraLearningPolicySnapshot(input: {
  symbol?: string;
  strategy?: string;
  direction?: string;
}) {
  const perf = await getNexoraDecayedPerformance(input);

  const policy = classifyNexoraLearningPolicy({
    trades: perf.sampleSize,
    winRate: perf.decayedWinRate,
    profitFactor: perf.decayedProfitFactor,
    pnl: perf.decayedPnl,
    recentWinRate: perf.decayedWinRate,
  });

  return {
    ok: true,
    service: "nexora_learning_policy",
    paperOnly: true,
    input,
    performance: perf,
    policy,
    updatedAt: new Date().toISOString(),
  };
}
