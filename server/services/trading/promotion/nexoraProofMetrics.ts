import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function getNexoraProofMetrics(input: { symbol?: string; strategy?: string; direction?: string; limit?: number }) {
  const limit = Math.max(50, Math.min(500, Number(input.limit || 150)));

  const result: any = await db.execute(sql`
    select symbol, strategy, coalesce(direction, 'unknown') as direction, outcome,
           coalesce(realized_pnl, 0)::numeric as pnl, created_at
    from paper_trade_outcomes
    where (${input.symbol || null}::text is null or symbol = ${input.symbol || null})
      and (${input.strategy || null}::text is null or strategy = ${input.strategy || null})
      and (${input.direction || null}::text is null or coalesce(direction, 'unknown') = ${input.direction || null})
    order by created_at desc
    limit ${limit};
  `).catch(() => ({ rows: [] }));

  const rows = Array.isArray(result) ? result : result.rows || [];
  const trades = rows.length;
  const wins = rows.filter((r: any) => String(r.outcome) === "win" || Number(r.pnl || 0) > 0).length;
  const winRate = trades ? (wins / trades) * 100 : 0;
  const pnl = rows.reduce((sum: number, r: any) => sum + Number(r.pnl || 0), 0);
  const grossProfit = rows.reduce((sum: number, r: any) => sum + Math.max(0, Number(r.pnl || 0)), 0);
  const grossLoss = rows.reduce((sum: number, r: any) => sum + Math.abs(Math.min(0, Number(r.pnl || 0))), 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  [...rows].reverse().forEach((r: any) => {
    equity += Number(r.pnl || 0);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  });

  return {
    ok: true,
    service: "nexora_proof_metrics",
    paperOnly: true,
    input,
    trades,
    wins,
    losses: trades - wins,
    winRate,
    pnl,
    profitFactor,
    maxDrawdown,
    updatedAt: new Date().toISOString(),
  };
}
