const FALLBACK_PRICES: Record<string, number> = {
  "BTC-USD": 100000,
  "ETH-USD": 5000,
  "SOL-USD": 200,
};

export async function getCoinbaseSpotPrice(productId: string): Promise<{
  ok: boolean;
  productId: string;
  price: number;
  source: string;
  error?: string;
}> {
  const normalized = productId.toUpperCase();

  try {
    const url = `https://api.coinbase.com/v2/prices/${encodeURIComponent(normalized)}/spot`;
    const res = await fetch(url);
    const data: any = await res.json();

    const price = Number(data?.data?.amount);

    if (Number.isFinite(price) && price > 0) {
      return {
        ok: true,
        productId: normalized,
        price,
        source: "coinbase_spot",
      };
    }

    throw new Error("invalid_coinbase_price_response");
  } catch (error: any) {
    return {
      ok: false,
      productId: normalized,
      price: FALLBACK_PRICES[normalized] || 1000,
      source: "fallback",
      error: error?.message || String(error),
    };
  }
}
