import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function getNexoraPredictionStrategyLeaderboard() {
  const rows: any = await db.execute(sql`
    select
      strategy,
      count(*)::int as trades,
      avg(edge_pct)::numeric as avg_edge,
      sum(case when status = 'won' then 1 else 0 end)::int as wins,
      sum(case when status = 'lost' then 1 else 0 end)::int as losses
    from nexora_prediction_paper_journal
    group by strategy
    order by trades desc
    limit 20;
  `).catch(() => ({ rows: [] }));

  return {
    ok: true,
    service: "nexora_prediction_strategy_leaderboard",
    paperOnly: true,
    rows: rows.rows || [],
    rule: "Nexora should allocate more attention to strategies with better calibrated paper results.",
    updatedAt: new Date().toISOString(),
  };
}
