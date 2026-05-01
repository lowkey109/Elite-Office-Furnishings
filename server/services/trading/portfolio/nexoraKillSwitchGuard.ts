import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function getNexoraKillSwitchGuard() {
  const result: any = await db.execute(sql`
    select
      count(*)::int as trades,
      avg(case when outcome = 'win' then 1 else 0 end)::numeric as win_rate,
      sum(coalesce(realized_pnl, 0))::numeric as pnl
    from (
      select *
      from paper_trade_outcomes
      order by created_at desc
      limit 80
    ) recent;
  `);

  const row = (Array.isArray(result) ? result : result.rows || [])[0] || {};
  const trades = Number(row.trades || 0);
  const winRate = Number(row.win_rate || 0) * 100;
  const pnl = Number(row.pnl || 0);

  const active =
    trades >= 40 &&
    (winRate < 35 || pnl < -250);

  return {
    ok: true,
    service: "nexora_kill_switch_guard",
    active,
    trades,
    winRate,
    pnl,
    reason: active
      ? "Kill switch active: recent paper outcomes are below safety threshold."
      : "Kill switch clear.",
    updatedAt: new Date().toISOString(),
  };
}
