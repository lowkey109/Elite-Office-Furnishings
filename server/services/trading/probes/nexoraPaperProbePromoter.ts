import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function promoteWinningPaperProbes() {
  const result: any = await db.execute(sql`
    select
      symbol,
      strategy,
      coalesce(direction, 'unknown') as direction,
      count(*)::int as trades,
      avg(case when outcome = 'win' or coalesce(realized_pnl, 0) > 0 then 1 else 0 end)::numeric * 100 as win_rate,
      sum(coalesce(realized_pnl, 0))::numeric as pnl
    from paper_trade_outcomes
    group by symbol, strategy, coalesce(direction, 'unknown')
    having count(*) >= 10
    order by win_rate desc, pnl desc
    limit 20;
  `).catch(() => ({ rows: [] }));

  const rows = Array.isArray(result) ? result : result.rows || [];
  const promoted = [];

  for (const row of rows) {
    const winRate = Number(row.win_rate || 0);
    const pnl = Number(row.pnl || 0);
    const trades = Number(row.trades || 0);

    if (winRate < 45 || pnl <= 0) continue;

    const id = [row.symbol, "5m", row.strategy, row.direction].join("|");

    await db.execute(sql`
      insert into nexora_candidate_allowlist (
        id, symbol, timeframe, strategy, direction, score,
        win_rate, pnl, trades, status, reason, updated_at
      )
      values (
        ${id}, ${row.symbol}, '5m', ${row.strategy}, ${row.direction},
        ${Math.min(85, 40 + winRate / 2)},
        ${winRate}, ${pnl}, ${trades},
        'research_probe',
        'Auto-promoted from recent winning paper probe outcomes.',
        now()
      )
      on conflict(id)
      do update set
        score = excluded.score,
        win_rate = excluded.win_rate,
        pnl = excluded.pnl,
        trades = excluded.trades,
        status = excluded.status,
        reason = excluded.reason,
        updated_at = now();
    `);

    promoted.push({ id, symbol: row.symbol, strategy: row.strategy, direction: row.direction, winRate, pnl, trades });
  }

  return {
    ok: true,
    service: "nexora_paper_probe_promoter",
    paperOnly: true,
    promoted,
    promotedCount: promoted.length,
    updatedAt: new Date().toISOString(),
  };
}
