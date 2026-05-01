
import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function getNexoraPortfolioBrain() {
  const result: any = await db.execute(sql`
    select
      symbol,
      strategy,
      count(*)::int as open_positions,
      sum(coalesce(size, 0))::numeric as total_size,
      sum(coalesce(unrealized_pnl, 0))::numeric as unrealized_pnl
    from paper_trading_positions
    where status = 'open'
    group by symbol, strategy
    order by open_positions desc;
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];

  const totalOpen = rows.reduce((sum: number, r: any) => sum + Number(r.open_positions || 0), 0);
  const totalUnrealizedPnl = rows.reduce((sum: number, r: any) => sum + Number(r.unrealized_pnl || 0), 0);

  const symbolExposure: Record<string, number> = {};
  for (const row of rows) {
    symbolExposure[row.symbol] = (symbolExposure[row.symbol] || 0) + Number(row.open_positions || 0);
  }

  const riskState =
    totalOpen >= 10 ? "high" :
    totalOpen >= 5 ? "medium" :
    "low";

  return {
    ok: true,
    service: "nexora_portfolio_brain",
    paperOnly: true,
    totalOpen,
    totalUnrealizedPnl,
    riskState,
    symbolExposure,
    rows,
    rules: {
      maxOpenPositions: 10,
      maxSymbolPositions: 4,
      reduceRiskWhenUnrealizedPnlNegative: true,
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function approveNexoraPortfolioRisk(input: {
  symbol: string;
  strategy: string;
}) {
  const brain = await getNexoraPortfolioBrain();
  const symbolOpen = Number(brain.symbolExposure[input.symbol] || 0);

  const blockedReasons: string[] = [];

  if (brain.totalOpen >= brain.rules.maxOpenPositions) {
    blockedReasons.push("Portfolio Brain blocked setup: max open paper positions reached.");
  }

  if (symbolOpen >= brain.rules.maxSymbolPositions) {
    blockedReasons.push("Portfolio Brain blocked setup: symbol exposure is too high.");
  }

  if (brain.totalUnrealizedPnl < -100) {
    blockedReasons.push("Portfolio Brain blocked setup: portfolio drawdown protection active.");
  }

  return {
    ok: blockedReasons.length === 0,
    service: "nexora_portfolio_risk_approval",
    symbol: input.symbol,
    strategy: input.strategy,
    blockedReasons,
    portfolio: brain,
    updatedAt: new Date().toISOString(),
  };
}
