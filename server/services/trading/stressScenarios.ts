export interface StressScenario {
  name: string;
  group: "price_shock" | "correlated_shock" | "execution_shock" | "strategy_shock";
  description: string;
  shocks: Record<string, number>;
  slippageMultiplier?: number;
  volatilityMultiplier?: number;
}

export const STRESS_SCENARIOS: StressScenario[] = [
  { name: "BTC -5%", group: "price_shock", description: "Bitcoin drops 5%", shocks: { BTC: -0.05 } },
  { name: "BTC -10%", group: "price_shock", description: "Bitcoin drops 10%", shocks: { BTC: -0.10 } },
  { name: "ETH -8%", group: "price_shock", description: "Ethereum drops 8%", shocks: { ETH: -0.08 } },
  { name: "SOL -12%", group: "price_shock", description: "Solana drops 12%", shocks: { SOL: -0.12 } },
  { name: "XAUUSD -3%", group: "price_shock", description: "Gold drops 3%", shocks: { XAUUSD: -0.03 } },

  { name: "All Crypto -7%", group: "correlated_shock", description: "Correlated crypto selloff -7%", shocks: { BTC: -0.07, ETH: -0.07, SOL: -0.07 } },
  { name: "All Crypto -12%", group: "correlated_shock", description: "Deep crypto selloff -12%", shocks: { BTC: -0.12, ETH: -0.12, SOL: -0.12 } },
  { name: "Crypto Down Gold Up", group: "correlated_shock", description: "Risk-off rotation: crypto down, gold up", shocks: { BTC: -0.06, ETH: -0.08, SOL: -0.10, XAUUSD: 0.02 } },
  { name: "Broad Risk-On Rally", group: "correlated_shock", description: "All crypto rallies, gold flat", shocks: { BTC: 0.05, ETH: 0.06, SOL: 0.08, XAUUSD: 0.0 } },
  { name: "Volatility Spike", group: "correlated_shock", description: "High volatility across all assets", shocks: { BTC: -0.04, ETH: -0.05, SOL: -0.07, XAUUSD: -0.01 }, volatilityMultiplier: 2.0 },

  { name: "Slippage x2", group: "execution_shock", description: "Double normal slippage on all exits", shocks: {}, slippageMultiplier: 2.0 },
  { name: "Slippage x3", group: "execution_shock", description: "Triple normal slippage on all exits", shocks: {}, slippageMultiplier: 3.0 },
  { name: "Gap Through Stop", group: "execution_shock", description: "Price gaps 2% beyond stop levels", shocks: { BTC: -0.02, ETH: -0.02, SOL: -0.03 }, slippageMultiplier: 2.5 },

  { name: "Trend Follow Underperforms", group: "strategy_shock", description: "Sharp reversal hurts trend following", shocks: { BTC: -0.03, ETH: -0.04, SOL: -0.05 } },
  { name: "Mean Reversion Fails", group: "strategy_shock", description: "Continued breakdown in ranging markets", shocks: { BTC: -0.06, ETH: -0.07, SOL: -0.09 } },
  { name: "Momentum False Breakout", group: "strategy_shock", description: "Breakout reversal cluster", shocks: { BTC: -0.04, ETH: -0.05, SOL: -0.06 } },
];

export function getScenariosByGroup(group: string): StressScenario[] {
  return STRESS_SCENARIOS.filter(s => s.group === group);
}

export function getScenario(name: string): StressScenario | undefined {
  return STRESS_SCENARIOS.find(s => s.name === name);
}
