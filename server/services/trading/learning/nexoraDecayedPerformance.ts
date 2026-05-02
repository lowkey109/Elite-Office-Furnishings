import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function getNexoraDecayedPerformance(input: {
  symbol?: string;
  strategy?: string;
  direction?: string;
  limit?: number;
}) {
  const limit = Math.max(20, Math.min(300, Number(input.limit || 80)));

  const result: any = await db.execute(sql`
    select
      symbol,
      strategy,
      coalesce(direction, 'unknown') as direction,
      outcome,
      coalesce(realized_pnl, 0)::numeric as pnl,
      created_at
    from paper_trade_outcomes
    where (${input.symbol || null}::text is null or symbol = ${input.symbol || null})
      and (${input.strategy || null}::text is null or strategy = ${input.strategy || null})
      and (${input.direction || null}::text is null or coalesce(direction, 'unknown') = ${input.direction || null})
    order by created_at desc
    limit ${limit};
  `).catch(() => ({ rows: [] }));

  const rows = Array.isArray(result) ? result : result.rows || [];

  let weightedWins = 0;
  let weightedTotal = 0;
  let weightedPnl = 0;
  let weightedProfit = 0;
  let weightedLoss = 0;

  rows.forEach((row: any, index: number) => {
    const weight = Math.pow(0.96, index);
    const pnl = Number(row.pnl || 0);

    weightedTotal += weight;
    if (String(row.outcome) === "win" || pnl > 0) weightedWins += weight;
    weightedPnl += pnl * weight;
    if (pnl > 0) weightedProfit += pnl * weight;
    if (pnl < 0) weightedLoss += Math.abs(pnl) * weight;
  });

  const decayedWinRate = weightedTotal ? (weightedWins / weightedTotal) * 100 : 0;
  const decayedProfitFactor = weightedLoss > 0 ? weightedProfit / weightedLoss : weightedProfit > 0 ? 99 : 0;

  return {
    ok: true,
    service: "nexora_decayed_performance",
    sampleSize: rows.length,
    decayedWinRate,
    decayedPnl: weightedPnl,
    decayedProfitFactor,
    rows: rows.slice(0, 25),
    updatedAt: new Date().toISOString(),
  };
}
