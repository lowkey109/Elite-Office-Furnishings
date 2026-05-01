const CRYPTO_RISK_BUCKETS: Record<string, string> = {
  "BTC/USD": "crypto_major",
  "ETH/USD": "crypto_major",
  "SOL/USD": "crypto_high_beta",
  XAUUSD: "gold_macro",
};

export function evaluateNexoraCorrelationExposure(input: {
  symbol: string;
  openPositions: Array<{ symbol?: string; direction?: string }>;
  direction: "long" | "short";
}) {
  const bucket = CRYPTO_RISK_BUCKETS[input.symbol] || "unknown";
  const sameBucket = input.openPositions.filter((p) => {
    const pBucket = CRYPTO_RISK_BUCKETS[String(p.symbol || "")] || "unknown";
    return pBucket === bucket;
  });

  const sameDirection = sameBucket.filter((p) => p.direction === input.direction);

  const blocked = sameBucket.length >= 4 || sameDirection.length >= 3;

  return {
    ok: !blocked,
    service: "nexora_correlation_exposure_guard",
    symbol: input.symbol,
    bucket,
    sameBucketOpen: sameBucket.length,
    sameDirectionOpen: sameDirection.length,
    blocked,
    reason: blocked
      ? "Correlation guard blocked setup: too much same-bucket exposure."
      : "Correlation exposure is acceptable.",
    updatedAt: new Date().toISOString(),
  };
}
