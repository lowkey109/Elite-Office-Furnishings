import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function boostRecentWinningPaperEdges() {
  const result: any = await db.execute(sql`
    select symbol, strategy, coalesce(direction, 'unknown') as direction,
      count(*)::int as trades,
      avg(case when outcome = 'win' or coalesce(realized_pnl,0) > 0 then 1 else 0 end)::numeric * 100 as win_rate,
      sum(coalesce(realized_pnl,0))::numeric as pnl
    from paper_trade_outcomes
    where created_at > now() - interval '90 minutes'
    group by symbol, strategy, coalesce(direction, 'unknown')
    having count(*) >= 3
    order by win_rate desc, pnl desc
    limit 20;
  `).catch(() => ({ rows: [] }));

  const rows = Array.isArray(result) ? result : result.rows || [];
  const boosted = [];

  for (const row of rows) {
    const winRate = Number(row.win_rate || 0);
    const pnl = Number(row.pnl || 0);
    if (winRate < 35 && pnl <= 0) continue;

    const id = [row.symbol, "5m", row.strategy, row.direction].join("|");
    const score = Math.max(45, Math.min(88, 35 + winRate / 1.5 + Math.max(0, pnl)));

    await db.execute(sql`
      insert into nexora_candidate_allowlist (
        id, symbol, timeframe, strategy, direction, score,
        win_rate, pnl, trades, status, reason, updated_at
      )
      values (${id}, ${row.symbol}, '5m', ${row.strategy}, ${row.direction}, ${score},
        ${winRate}, ${pnl}, ${Number(row.trades || 0)}, 'research_probe',
        'Boosted from recent paper outcome behavior.', now())
      on conflict(id)
      do update set score = excluded.score, win_rate = excluded.win_rate, pnl = excluded.pnl,
        trades = excluded.trades, status = excluded.status, reason = excluded.reason, updated_at = now();
    `);

    boosted.push({ id, symbol: row.symbol, strategy: row.strategy, direction: row.direction, winRate, pnl, score });
  }

  return { ok: true, service: "nexora_outcome_booster", paperOnly: true, boostedCount: boosted.length, boosted, updatedAt: new Date().toISOString() };
}
