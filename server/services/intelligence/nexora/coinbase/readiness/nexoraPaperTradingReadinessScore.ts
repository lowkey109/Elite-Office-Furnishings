import fs from "fs";
import path from "path";

const GOV = path.join(
  process.cwd(),
  "data/nexora/local/coinbase-paper/learning-governor.json"
);

export function getPaperTradingReadinessScore() {
  let governor: any = {};

  try {
    governor = JSON.parse(fs.readFileSync(GOV, "utf8"));
  } catch {
    governor = {};
  }

  const totalRuns = Number(governor.totalRuns || 0);
  const wins = Number(governor.wins || 0);

  const accuracy =
    totalRuns > 0
      ? Math.round((wins / totalRuns) * 100)
      : 0;

  const readinessScore = Math.min(
    100,
    Math.round(
      accuracy * 0.7 +
      Math.min(totalRuns, 100) * 0.3
    )
  );

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    readinessScore,
    paperRuns: totalRuns,
    wins,
    losses: Number(governor.losses || 0),
    confidence: Number(governor.confidence || 35),
    liveTradingEnabled: false,
    recommendation:
      readinessScore >= 85
        ? "ready_for_tiny_live_sandbox"
        : readinessScore >= 60
        ? "continue_paper_learning"
        : "not_ready",
  };
}
