export function coinbaseSafetyEnvelope() {
  const liveEnabled = process.env.COINBASE_LIVE_TRADING_ENABLED === "true";
  const dryRunMode = process.env.COINBASE_DRY_RUN_MODE !== "false";

  return {
    exchange: "coinbase",

    // Live can only be true if explicitly enabled AND dry-run is off.
    liveEnabled: liveEnabled && !dryRunMode,

    // Hard locked forever at app layer.
    withdrawalsLocked: true,

    // Default safe mode.
    dryRunMode,

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
