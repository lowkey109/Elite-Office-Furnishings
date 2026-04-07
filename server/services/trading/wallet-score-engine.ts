// server/services/trading/wallet-score-engine.ts

import { getWalletPerformance } from "./wallet-ledger";
import { listTrackedWallets, updateTrackedWalletScores } from "./wallet-registry";

export type WalletScoreResult = {
  walletId: string;
  score: number;
  winRate: number;
  pnl: number;
  tradeCount: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function calculateScore(winRate: number, pnl: number, tradeCount: number) {
  // normalize inputs
  const winScore = winRate * 100; // 0–100
  const pnlScore = Math.tanh(pnl / 1000) * 100; // smooth scaling
  const activityScore = Math.min(tradeCount * 2, 100);

  // weighted score
  const score =
    winScore * 0.4 +
    pnlScore * 0.4 +
    activityScore * 0.2;

  return clamp(score, 0, 100);
}

export function runWalletScoring(): WalletScoreResult[] {
  const wallets = listTrackedWallets();

  const results: WalletScoreResult[] = [];

  for (const wallet of wallets) {
    const perf = getWalletPerformance(wallet.id);

    const score = calculateScore(
      perf.winRate,
      perf.pnl,
      perf.tradeCount
    );

    // update registry (this feeds your identity system)
    updateTrackedWalletScores(wallet.id, {
      walletQualityScore: score,
      copyabilityScore: score, // temp: same value (we split later)
    });

    results.push({
      walletId: wallet.id,
      score,
      winRate: perf.winRate,
      pnl: perf.pnl,
      tradeCount: perf.tradeCount,
    });

    console.log("[WalletScore] updated", {
      walletId: wallet.id,
      score,
      winRate: perf.winRate,
      pnl: perf.pnl,
      trades: perf.tradeCount,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
