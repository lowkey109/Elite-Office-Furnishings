function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0.5;
  return Math.max(0.001, Math.min(0.999, x));
}

function logit(p: number) {
  p = clamp01(p);
  return Math.log(p / (1 - p));
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

export function updateNexoraBayesianProbability(input: any = {}) {
  const prior = clamp01(Number(input.priorProbability ?? 0.5));
  const evidence = Array.isArray(input.evidence) ? input.evidence : [];

  let score = logit(prior);

  const applied = evidence.map((e: any) => {
    const likelihood = clamp01(Number(e.likelihood ?? e.probability ?? 0.5));
    const strength = Math.max(0, Math.min(1, Number(e.strength ?? e.confidence ?? 0.5)));
    const reliability = Math.max(0, Math.min(1, Number(e.reliability ?? 0.5)));
    const delta = (logit(likelihood) - logit(0.5)) * strength * reliability;
    score += delta;
    return {
      source: String(e.source || "unknown"),
      likelihood,
      strength,
      reliability,
      delta: Math.round(delta * 10000) / 10000,
    };
  });

  const posterior = sigmoid(score);

  return {
    ok: true,
    service: "nexora_bayesian_updater",
    paperOnly: true,
    priorProbability: prior,
    posteriorProbability: Math.round(posterior * 10000) / 10000,
    posteriorProbabilityPct: Math.round(posterior * 10000) / 100,
    appliedEvidence: applied,
    evidenceCount: applied.length,
    rule: "Update fair probability continuously as new evidence arrives.",
    updatedAt: new Date().toISOString(),
  };
}
