nano server/services/trading/wallet-to-paper-bridge.ts// server/services/trading/wallet-to-paper-bridge.ts

import type { WalletAction } from "./types/trading-types";

// IMPORTANT: adjust this import if your path differs
import { runPaperTrade } from "./paperEngine";

function mapActionToTrade(action: WalletAction) {
  if (!action.estimatedUsdValue) return null;

  if (action.actionType === "BUY_OPEN" || action.actionType === "BUY_ADD") {
    return {
      side: "BUY",
      token: action.tokenOut || "UNKNOWN",
      sizeUsd: action.estimatedUsdValue,
    };
  }

  if (action.actionType === "SELL_CLOSE" || action.actionType === "SELL_TRIM") {
    return {
      side: "SELL",
      token: action.tokenIn || "UNKNOWN",
      sizeUsd: action.estimatedUsdValue,
    };
  }

  return null;
}

export async function processWalletActions(actions: WalletAction[]) {
  for (const action of actions) {
    try {
      const trade = mapActionToTrade(action);

      if (!trade) continue;

      console.log("[WalletBridge] processing action → trade", {
        walletId: action.walletId,
        side: trade.side,
        token: trade.token,
        sizeUsd: trade.sizeUsd,
      });

      // 🔥 THIS IS THE KEY LINE
      await runPaperTrade({
        symbol: trade.token,
        side: trade.side,
        notionalUsd: trade.sizeUsd,
        source: "SMART_WALLET",
        meta: {
          walletId: action.walletId,
          txHash: action.txHash,
        },
      });
    } catch (err) {
      console.error("[WalletBridge] error processing action:", err);
    }
  }
}
