import { listPaperTrades } from "./nexoraCoinbasePaperLedger";

export function coinbasePerformanceReport() {
  const trades = listPaperTrades(2000);
  const closed = trades.filter((t) => t.status === "CLOSED");
  const open = trades.filter((t) => t.status === "OPEN");

  const pnlSeries = closed.map((t) => t.pnlAud || 0);

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const pnl of pnlSeries) {
    equity += pnl;
    if (equity > peak) peak = equity;
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const totalPnl = pnlSeries.reduce((a, b) => a + b, 0);
  const avgPnl = closed.length > 0 ? totalPnl / closed.length : 0;
  const wins = closed.filter((t) => (t.pnlAud || 0) > 0);

  return {
    generatedAt: new Date().toISOString(),
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: open.length,
    totalPnlAud: Number(totalPnl.toFixed(2)),
    averagePnlAud: Number(avgPnl.toFixed(2)),
    winRate: closed.length > 0 ? Number(((wins.length / closed.length) * 100).toFixed(2)) : 0,
    maxDrawdownAud: Number(maxDrawdown.toFixed(2)),
    status: totalPnl > 0 ? "profitable" : totalPnl < 0 ? "losing" : "flat",
  };
}
