// server/services/trading/wallet-ledger.ts

import type { WalletAction, MirrorTrade } from "./types/trading-types";

const walletActionLedger: WalletAction[] = [];
const mirrorTradeLedger: MirrorTrade[] = [];

// ==========================
// WALLET ACTIONS (SOURCE)
// ==========================

export function recordWalletAction(action: WalletAction) {
  walletActionLedger.push(action);

  console.log("[WalletLedger] recorded wallet action", {
    walletId: action.walletId,
    actionType: action.actionType,
    token: action.tokenOut || action.tokenIn,
    value: action.estimatedUsdValue,
  });
}

export function getWalletActions(): WalletAction[] {
  return walletActionLedger;
}

// ==========================
// MIRROR TRADES (COPIED)
// ==========================

export function recordMirrorTrade(trade: MirrorTrade) {
  mirrorTradeLedger.push(trade);

  console.log("[WalletLedger] recorded mirror trade", {
    walletId: trade.walletId,
    token: trade.token,
    side: trade.side,
    notional: trade.notionalUsd,
  });
}

export function updateMirrorTrade(
  tradeId: string,
  updates: Partial<MirrorTrade>
) {
  const trade = mirrorTradeLedger.find((t) => t.id === tradeId);
  if (!trade) return;

  Object.assign(trade, updates);
}

export function getMirrorTrades(): MirrorTrade[] {
  return mirrorTradeLedger;
}

// ==========================
// ANALYTICS (THIS IS POWER)
// ==========================

export function getWalletPerformance(walletId: string) {
  const trades = mirrorTradeLedger.filter((t) => t.walletId === walletId);

  if (trades.length === 0) {
    return {
      tradeCount: 0,
      winRate: 0,
      pnl: 0,
    };
  }

  let wins = 0;
  let pnl = 0;

  for (const t of trades) {
    if (typeof t.realizedPnl === "number") {
      pnl += t.realizedPnl;
      if (t.realizedPnl > 0) wins++;
    }
  }

  return {
    tradeCount: trades.length,
    winRate: wins / trades.length,
    pnl,
  };
}
