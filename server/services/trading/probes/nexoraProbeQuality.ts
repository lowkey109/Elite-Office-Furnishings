import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function getNexoraProbeQuality(input: {
  symbol?: string;
  strategy?: string;
  direction?: string;
}) {
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
    limit 25;
  `).catch(() => ({ rows: [] }));

  const rows = Array.isArray(result) ? result : result.rows || [];
  const trades = rows.length;
  const wins = rows.filter((r: any) => String(r.outcome) === "win" || Number(r.pnl || 0) > 0).length;
  const pnl = rows.reduce((sum: number, r: any) => sum + Number(r.pnl || 0), 0);

  let currentLossStreak = 0;
  for (const row of rows) {
    if (Number(row.pnl || 0) < 0 || String(row.outcome) === "loss") currentLossStreak++;
    else break;
  }

  return {
    ok: true,
    service: "nexora_probe_quality",
    paperOnly: true,
    input,
    trades,
    wins,
    winRate: trades ? (wins / trades) * 100 : 0,
    pnl,
    currentLossStreak,
    shouldCooldown: currentLossStreak >= 5,
    updatedAt: new Date().toISOString(),
  };
}
