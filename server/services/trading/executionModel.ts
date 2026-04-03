import { db } from "../../db";
import { executionProfiles } from "@shared/schema";

export interface ExecutionEstimate {
  expectedEntry: number;
  simulatedEntry: number;
  entrySlippage: number;
  spreadEstimate: number;
  volatilityFactor: number;
}

export interface ExitExecutionEstimate {
  expectedExit: number;
  simulatedExit: number;
  exitSlippage: number;
}

const DEFAULT_PROFILES: Record<string, { avgSpread: number; avgSlippage: number; volatilityMultiplier: number }> = {
  BTC: { avgSpread: 0.0005, avgSlippage: 0.0008, volatilityMultiplier: 1.0 },
  ETH: { avgSpread: 0.0008, avgSlippage: 0.0012, volatilityMultiplier: 1.1 },
  SOL: { avgSpread: 0.0015, avgSlippage: 0.0025, volatilityMultiplier: 1.4 },
  XAUUSD: { avgSpread: 0.0003, avgSlippage: 0.0005, volatilityMultiplier: 0.7 },
};

export async function getExecutionProfiles(): Promise<Record<string, { avgSpread: number; avgSlippage: number; volatilityMultiplier: number }>> {
  try {
    const rows = await db.select().from(executionProfiles);
    if (rows.length > 0) {
      const profiles: Record<string, any> = {};
      for (const r of rows) {
        profiles[r.symbol] = { avgSpread: r.avgSpread, avgSlippage: r.avgSlippage, volatilityMultiplier: r.volatilityMultiplier };
      }
      return profiles;
    }
  } catch (err) {
    console.error("[executionModel] Failed to load execution profiles from DB, using defaults:", err instanceof Error ? err.message : err);
  }
  return { ...DEFAULT_PROFILES };
}

export function simulateEntryExecution(
  symbol: string,
  expectedPrice: number,
  side: "long" | "short",
  profile: { avgSpread: number; avgSlippage: number; volatilityMultiplier: number },
): ExecutionEstimate {
  const spreadCost = expectedPrice * profile.avgSpread;
  const slippageCost = expectedPrice * profile.avgSlippage * profile.volatilityMultiplier;

  const direction = side === "long" ? 1 : -1;
  const simulatedEntry = expectedPrice + (spreadCost / 2 + slippageCost) * direction;

  return {
    expectedEntry: expectedPrice,
    simulatedEntry: Math.round(simulatedEntry * 100) / 100,
    entrySlippage: Math.round(Math.abs(simulatedEntry - expectedPrice) * 100) / 100,
    spreadEstimate: Math.round(spreadCost * 100) / 100,
    volatilityFactor: profile.volatilityMultiplier,
  };
}

export function simulateExitExecution(
  symbol: string,
  expectedExitPrice: number,
  side: "long" | "short",
  exitReason: string,
  profile: { avgSpread: number; avgSlippage: number; volatilityMultiplier: number },
): ExitExecutionEstimate {
  let slippageMultiplier = 1.0;
  if (exitReason === "stop_hit") slippageMultiplier = 1.5;
  if (exitReason === "timeout") slippageMultiplier = 1.2;

  const slippageCost = expectedExitPrice * profile.avgSlippage * profile.volatilityMultiplier * slippageMultiplier;

  const direction = side === "long" ? -1 : 1;
  const simulatedExit = expectedExitPrice + slippageCost * direction;

  return {
    expectedExit: expectedExitPrice,
    simulatedExit: Math.round(simulatedExit * 100) / 100,
    exitSlippage: Math.round(Math.abs(simulatedExit - expectedExitPrice) * 100) / 100,
  };
}
