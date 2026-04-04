// server/services/trading/wallet-to-paper-bridge.ts

import type { WalletAction } from "./types/trading-types";
import { runPaperTrade } from "./paperEngine";
import { assessCopyability } from "./copyability-engine";
import { evaluateRisk } from "./risk-governor";

function mapActionToTrade(action: WalletAction) {
  if (!action.estimatedUsdValue) return null;

  if (action.actionType === "BUY_OPEN" || action.actionType === "BUY_ADD") {
    return {
      side: "BUY" as const,
      token: action.tokenOut || "UNKNOWN",
      sizeUsd: action.estimatedUsdValue,
    };
  }

  if (action.actionType === "SELL_CLOSE" || action.actionType === "SELL_TRIM") {
    return {
      side: "SELL" as const,
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
      const assessment = assessCopyability(action);

      if (!assessment.shouldCopy) {
        console.log("[WalletBridge] skipped action", {
          walletId: action.walletId,
          txHash: action.txHash,
          reason: assessment.reason,
          score: assessment.score,
        });
        continue;
      }

      if (!trade) {
        console.log("[WalletBridge] skipped action", {
          walletId: action.walletId,
          txHash: action.txHash,
          reason: "unmappable_trade",
        });
        continue;
      }

      const risk = await evaluateRisk({
        walletId: action.walletId,
        symbol: trade.token,
        notionalUsd: trade.sizeUsd,
      });

      if (!risk.allowed) {
        console.log("[RiskGovernor] blocked trade", {
          walletId: action.walletId,
          txHash: action.txHash,
          symbol: trade.token,
          reason: risk.reason,
        });
        continue;
      }

      console.log("[WalletBridge] processing action → trade", {
        walletId: action.walletId,
        side: trade.side,
        token: trade.token,
        sizeUsd: trade.sizeUsd,
      });

      await runPaperTrade({
        symbol: trade.token,
        side: trade.side,
        notionalUsd: trade.sizeUsd,
        source: "SMART_WALLET",
        meta: {
          walletId: action.walletId,
          txHash: action.txHash,
          actionType: action.actionType,
          copyabilityScore: assessment.score,
        },
      });
    } catch (err) {
      console.error("[WalletBridge] error processing action:", err);
    }
  }
}
