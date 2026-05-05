import { listPaperTrades, paperStats } from "./nexoraCoinbasePaperLedger";

export function coinbaseLearningSnapshot() {
  const trades = listPaperTrades(1000);
  const closed = trades.filter((t) => t.status === "CLOSED");
  const open = trades.filter((t) => t.status === "OPEN");

  const wins = closed.filter((t) => (t.pnlAud || 0) > 0);
  const losses = closed.filter((t) => (t.pnlAud || 0) <= 0);

  const byStrategy: Record<string, any> = {};
  const byProduct: Record<string, any> = {};

  for (const t of closed) {
    const strategy = t.strategy || "unknown";
    const product = t.productId || "unknown";

    byStrategy[strategy] ||= { trades: 0, wins: 0, losses: 0, pnlAud: 0 };
    byProduct[product] ||= { trades: 0, wins: 0, losses: 0, pnlAud: 0 };

    for (const bucket of [byStrategy[strategy], byProduct[product]]) {
      bucket.trades += 1;
      bucket.pnlAud += t.pnlAud || 0;
      if ((t.pnlAud || 0) > 0) bucket.wins += 1;
      else bucket.losses += 1;
    }
  }

  for (const bucket of [...Object.values(byStrategy), ...Object.values(byProduct)]) {
    bucket.pnlAud = Number(bucket.pnlAud.toFixed(2));
    bucket.winRate = bucket.trades ? Number(((bucket.wins / bucket.trades) * 100).toFixed(2)) : 0;
  }

  return {
    generatedAt: new Date().toISOString(),
    stats: paperStats(),
    openTrades: open.length,
    closedTrades: closed.length,
    winRate: closed.length ? Number(((wins.length / closed.length) * 100).toFixed(2)) : 0,
    lossRate: closed.length ? Number(((losses.length / closed.length) * 100).toFixed(2)) : 0,
    byStrategy,
    byProduct,
    recommendation:
      closed.length < 20
        ? "collect_more_paper_trade_data"
        : wins.length >= losses.length
        ? "continue_current_strategy_with_limits"
        : "reduce_risk_and_adjust_strategy",
  };
}
