// server/services/trading/wallet-monitor.ts

import { randomUUID } from "crypto";
import { listTrackedWallets } from "./wallet-registry";
import { processWalletActions } from "./wallet-to-paper-bridge";
import type { WalletAction } from "./types/trading-types";
import { runWalletScoring } from "./wallet-score-engine";

let isRunning = false;

export async function runWalletMonitorCycle(): Promise<WalletAction[]> {
  const wallets = listTrackedWallets().filter((w) => w.isActive);

  const detectedActions: WalletAction[] = [];

  for (const wallet of wallets) {
    // TEMP: simulated detection (replace with real Solana later)
    const mockAction: WalletAction = {
      id: randomUUID(),
      wallet: wallet.address,
      walletId: wallet.id,
      chain: "solana",
      txHash: randomUUID(),
      detectedAt: new Date(),
      actionType: Math.random() > 0.5 ? "BUY_OPEN" : "SELL_CLOSE",
      tokenIn: "USDC",
      tokenOut: "SOL",
      amountIn: 100,
      amountOut: 0.5,
      estimatedUsdValue: 100,
      confidence: 0.8,
    };

    detectedActions.push(mockAction);
  }

  return detectedActions;
}

export async function startWalletMonitor(_intervalMs = 5000) {
  isRunning = false;
  console.log("[WalletMonitor] Legacy in-process wallet monitor loop disabled — use durable Nexora worker");
  return {
    ok: false,
    running: false,
    mode: "disabled_pg_boss_required",
    message: "Legacy in-process wallet monitor loop disabled — use durable Nexora worker",
  };
}

export function stopWalletMonitor() {
  isRunning = false;
  console.log("[WalletMonitor] stopped");
}


/**
 * Read-only monitor state for Admin Trading Monitor.
 * Does not start/stop monitoring or mutate wallet state.
 */
export function getWalletMonitorState() {
  return {
    running: false,
    status: "available",
    mode: "read_only",
    message: "Wallet monitor module is installed. Runtime cycle state export is available.",
    availableExports: [
      "runWalletMonitorCycle",
      "startWalletMonitor",
      "stopWalletMonitor",
      "getWalletMonitorState",
    ],
    lastCheckedAt: new Date().toISOString(),
  };
}

export const getMonitorState = getWalletMonitorState;
