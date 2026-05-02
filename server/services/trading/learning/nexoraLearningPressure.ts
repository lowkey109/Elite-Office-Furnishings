import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function getNexoraLearningPressure() {
  const result: any = await db.execute(sql`
    select
      count(*)::int as recent_trades,
      sum(coalesce(realized_pnl,0))::numeric as pnl,
      avg(case when outcome = 'win' or coalesce(realized_pnl,0) > 0 then 1 else 0 end)::numeric * 100 as win_rate
    from paper_trade_outcomes
    where created_at > now() - interval '30 minutes';
  `).catch(() => ({ rows: [] }));

  const row = (Array.isArray(result) ? result : result.rows || [])[0] || {};
  const recentTrades = Number(row.recent_trades || 0);
  const winRate = Number(row.win_rate || 0);
  const pnl = Number(row.pnl || 0);

  return {
    ok: true,
    service: "nexora_learning_pressure",
    paperOnly: true,
    recentTrades,
    winRate,
    pnl,
    mode: recentTrades < 20 ? "needs_more_reps" : winRate >= 45 ? "learning_improving" : "keep_exploring",
    updatedAt: new Date().toISOString(),
  };
}
