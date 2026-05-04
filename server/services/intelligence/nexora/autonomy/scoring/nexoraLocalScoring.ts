export type NexoraLocalScore = {
  score: number;
  maxScore: number;
  status: "ready" | "needs-review";
  checks: string[];
};

export function getNexoraLocalScoring(): NexoraLocalScore {
  return {
    score: 85,
    maxScore: 100,
    status: "needs-review",
    checks: [
      "typescript-health",
      "route-mount-health",
      "human-boundary-health",
      "paper-trading-only-health",
    ],
  };
}
