const basePrices: Record<string, number> = {
  "BTC/USD": 84500,
  "ETH/USD": 1900,
  "XAUUSD": 3125,
  "SOL/USD": 134,
};

const volatility: Record<string, number> = {
  "BTC/USD": 0.003,
  "ETH/USD": 0.004,
  "XAUUSD": 0.001,
  "SOL/USD": 0.006,
};

const currentPrices: Record<string, number> = { ...basePrices };
let lastTick = Date.now();

export function tickPrices(): void {
  const now = Date.now();
  const elapsed = (now - lastTick) / 1000;
  lastTick = now;

  for (const symbol of Object.keys(currentPrices)) {
    const vol = volatility[symbol] || 0.003;
    const drift = (Math.random() - 0.48) * vol * Math.sqrt(elapsed / 60);
    currentPrices[symbol] = Math.round(currentPrices[symbol] * (1 + drift) * 100) / 100;
  }
}

export function getPrice(symbol: string): number {
  return currentPrices[symbol] || basePrices[symbol] || 0;
}

export function getAllPrices(): Record<string, number> {
  return { ...currentPrices };
}

export function get24hChange(symbol: string): { change: number; pct: number } {
  const base = basePrices[symbol] || 1;
  const current = currentPrices[symbol] || base;
  const change = Math.round((current - base) * 100) / 100;
  const pct = Math.round((change / base) * 10000) / 100;
  return { change, pct };
}
