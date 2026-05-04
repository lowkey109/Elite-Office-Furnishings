export function getNexoraLocalScoring() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_scoring",
    generatedAt: new Date().toISOString(),
    scoring: {
      readinessScore: 100,
      paperLearningScore: 100,
      riskGateScore: 100,
      liveExecutionScore: 0
    },
    safety: {
      liveTradingEnabled: false,
      privateKeysInsideNexora: false,
      walletSigningInsideNexora: false,
      humanApprovalRequired: true
    }
  };
}

export function getNexoraLocalScoringStatus() {
  return getNexoraLocalScoring();
}

export default {
  getNexoraLocalScoring,
  getNexoraLocalScoringStatus
};
