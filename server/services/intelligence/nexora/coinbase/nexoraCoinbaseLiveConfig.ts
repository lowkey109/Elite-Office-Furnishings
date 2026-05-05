export function coinbaseSafetyEnvelope() {
  return {
    exchange: "coinbase",
    liveEnabled: process.env.COINBASE_LIVE_TRADING_ENABLED === "true",
    withdrawalsLocked: process.env.COINBASE_ALLOW_WITHDRAWALS !== "true",
    dryRunMode: process.env.COINBASE_DRY_RUN_MODE !== "false",
    apiKeyPresent: Boolean(process.env.COINBASE_API_KEY),
    apiSecretPresent: Boolean(process.env.COINBASE_API_SECRET),
    maxPositionAud: Number(process.env.COINBASE_MAX_POSITION_AUD || 5),
    allowedProducts: String(process.env.COINBASE_ALLOWED_PRODUCTS || "BTC-USD,ETH-USD,SOL-USD")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  };
}

export function assertCoinbaseProductAllowed(productId: string) {
  const safety = coinbaseSafetyEnvelope();
  const normalized = productId.toUpperCase();

  if (!safety.allowedProducts.includes(normalized)) {
    return {
      ok: false,
      reason: "product_not_whitelisted",
      safety,
    };
  }

  return {
    ok: true,
    reason: "product_allowed",
    safety,
  };
}
