function bucket(p: number) {
  return Math.round(Math.max(0, Math.min(1, p)) * 10) / 10;
}

export function evaluateNexoraCalibration(input: any = {}) {
  const rows = Array.isArray(input.outcomes) ? input.outcomes : [];

  const buckets: Record<string, { predicted: number; wins: number; total: number }> = {};

  for (const r of rows) {
    const p = Number(r.predictedProbability ?? r.modelProbability ?? 0.5);
    const b = String(bucket(p));
    if (!buckets[b]) buckets[b] = { predicted: Number(b), wins: 0, total: 0 };
    buckets[b].total += 1;
    if (Boolean(r.won ?? r.resolvedYes ?? r.success)) buckets[b].wins += 1;
  }

  const calibration = Object.values(buckets).map((b) => {
    const actual = b.total ? b.wins / b.total : 0;
    return {
      bucket: b.predicted,
      predictedPct: Math.round(b.predicted * 10000) / 100,
      actualPct: Math.round(actual * 10000) / 100,
      total: b.total,
      errorPct: Math.round(Math.abs(actual - b.predicted) * 10000) / 100,
    };
  });

  const avgErrorPct =
    calibration.length
      ? Math.round((calibration.reduce((s, b) => s + b.errorPct, 0) / calibration.length) * 100) / 100
      : null;

  return {
    ok: true,
    service: "nexora_calibration_learner",
    paperOnly: true,
    sampleSize: rows.length,
    avgErrorPct,
    calibration,
    status: rows.length < 50 ? "needs_more_samples" : avgErrorPct !== null && avgErrorPct <= 8 ? "well_calibrated" : "needs_recalibration",
    rule: "A 70% model should win around 70% over enough samples.",
    updatedAt: new Date().toISOString(),
  };
}
