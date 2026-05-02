export type NexoraLearningPolicyInput = {
  trades: number;
  winRate: number;
  profitFactor: number;
  pnl: number;
  recentWinRate?: number;
};

export function classifyNexoraLearningPolicy(input: NexoraLearningPolicyInput) {
  const trades = Number(input.trades || 0);
  const winRate = Number(input.winRate || 0);
  const profitFactor = Number(input.profitFactor || 0);
  const pnl = Number(input.pnl || 0);
  const recentWinRate = Number(input.recentWinRate ?? winRate);

  if (trades < 10) {
    return { mode: "exploration", allowed: true, maxOpen: 1, riskMultiplier: 0.15, reason: "Not enough samples. Tiny paper exploration allowed." };
  }

  if (profitFactor >= 1.5 && winRate >= 60 && pnl > 0) {
    return { mode: "production_candidate", allowed: true, maxOpen: 3, riskMultiplier: 1, reason: "Strong edge candidate." };
  }

  if (profitFactor >= 1 && winRate >= 50 && pnl >= 0) {
    return { mode: "research", allowed: true, maxOpen: 2, riskMultiplier: 0.35, reason: "Research edge exists but is not proven." };
  }

  if (recentWinRate >= 45 && trades >= 10) {
    return { mode: "recovery_probe", allowed: true, maxOpen: 1, riskMultiplier: 0.1, reason: "Old stats weak but recent behavior may be recovering." };
  }

  return { mode: "quarantine", allowed: false, maxOpen: 0, riskMultiplier: 0, reason: "Weak edge. Block until candidate hunter or recent stats improve." };
}
