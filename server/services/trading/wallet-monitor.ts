// server/services/trading/wallet-monitor.ts

import { listTrackedWallets } from "./wallet-registry";
import type { WalletAction } from "./types/trading-types";
import { randomUUID } from "crypto";

let isRunning = false;

export async function runWalletMonitorCycle(): Promise<WalletAction[]> {
  const wallets = listTrackedWallets().filter((w) => w.isActive);

  const detectedActions: WalletAction[] = [];

  for (const wallet of wallets) {
    // TEMP: simulated detection (replace with real Solana later)

    const mockAction: WalletAction = {
      id: randomUUID(),
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

export async function startWalletMonitor(intervalMs = 5000) {
  if (isRunning) return;

  isRunning = true;

  console.log("[WalletMonitor] started");

  while (isRunning) {
    try {
      const actions = await runWalletMonitorCycle();

      if (actions.length > 0) {
        console.log(
          `[WalletMonitor] detected ${actions.length} wallet actions`,
        );
      }

      // TODO: send actions into decision engine
      // next step will connect this to paperEngine

    } catch (err) {
      console.error("[WalletMonitor] error:", err);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export function stopWalletMonitor() {
  isRunning = false;
  console.log("[WalletMonitor] stopped");
}
