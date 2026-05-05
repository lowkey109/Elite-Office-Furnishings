import {
  listPaperTrades,
  closePaperTrade,
} from "./nexoraCoinbasePaperLedger";

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function autoCloseCoinbasePaperTrades() {
  const openTrades = listPaperTrades(500)
    .filter((t) => t.status === "OPEN");

  const closed = [];

  for (const trade of openTrades) {
    // ~45% chance to close each cycle
    if (Math.random() > 0.45) {
      continue;
    }

    const variance = rand(-0.08, 0.08);

    const exitPrice =
      trade.entryPrice * (1 + variance);

    const result = closePaperTrade(
      trade.id,
      exitPrice
    );

    closed.push(result);
  }

  return {
    ok: true,
    closedTrades: closed.length,
  };
}
