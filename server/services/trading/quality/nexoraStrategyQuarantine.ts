import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function ensureNexoraStrategyQuarantineTable() {
  await db.execute(sql`
    create table if not exists nexora_strategy_quarantine (
      id text primary key,
      symbol text not null,
      strategy text not null,
      direction text not null,
      trades integer not null default 0,
      win_rate numeric not null default 0,
      pnl numeric not null default 0,
      profit_factor numeric not null default 0,
      status text not null default 'blocked',
      reason text,
      updated_at timestamptz not null default now()
    );
  `);
}

export async function refreshNexoraStrategyQuarantine() {
  await ensureNexoraStrategyQuarantineTable();

  const result: any = await db.execute(sql`
    select
      symbol,
      strategy,
      coalesce(direction, 'unknown') as direction,
      count(*)::int as trades,
      avg(case when outcome = 'win' then 1 else 0 end)::numeric * 100 as win_rate,
      sum(coalesce(realized_pnl, 0))::numeric as pnl,
      case
        when sum(case when realized_pnl < 0 then abs(realized_pnl) else 0 end) = 0
        then 99
        else sum(case when realized_pnl > 0 then realized_pnl else 0 end)
          / nullif(sum(case when realized_pnl < 0 then abs(realized_pnl) else 0 end), 0)
      end::numeric as profit_factor
    from paper_trade_outcomes
    group by symbol, strategy, coalesce(direction, 'unknown')
    having count(*) >= 10;
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];
  const updates = [];

  for (const row of rows) {
    const trades = Number(row.trades || 0);
    const winRate = Number(row.win_rate || 0);
    const pnl = Number(row.pnl || 0);
    const profitFactor = Number(row.profit_factor || 0);

    const blocked = trades >= 10 && (winRate < 40 || pnl < 0 || profitFactor < 0.8);
    const status = blocked ? "blocked" : "watch";
    const reason = blocked
      ? `Quarantined: weak edge. Win rate ${winRate.toFixed(2)}%, PnL ${pnl.toFixed(2)}, PF ${profitFactor.toFixed(2)}.`
      : `Watch only. Win rate ${winRate.toFixed(2)}%, PF ${profitFactor.toFixed(2)}.`;

    const id = [row.symbol, row.strategy, row.direction].join("|");

    await db.execute(sql`
      insert into nexora_strategy_quarantine (
        id, symbol, strategy, direction, trades, win_rate, pnl, profit_factor, status, reason, updated_at
      )
      values (
        ${id}, ${row.symbol}, ${row.strategy}, ${row.direction},
        ${trades}, ${winRate}, ${pnl}, ${profitFactor}, ${status}, ${reason}, now()
      )
      on conflict(id)
      do update set
        trades = excluded.trades,
        win_rate = excluded.win_rate,
        pnl = excluded.pnl,
        profit_factor = excluded.profit_factor,
        status = excluded.status,
        reason = excluded.reason,
        updated_at = now();
    `);

    updates.push({ id, trades, winRate, pnl, profitFactor, status, reason });
  }

  return {
    ok: true,
    service: "nexora_strategy_quarantine",
    updates,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraStrategyQuarantine() {
  await ensureNexoraStrategyQuarantineTable();

  const result: any = await db.execute(sql`
    select *
    from nexora_strategy_quarantine
    order by status asc, profit_factor asc, win_rate asc
    limit 200;
  `);

  return {
    ok: true,
    service: "nexora_strategy_quarantine",
    rows: Array.isArray(result) ? result : result.rows || [],
    updatedAt: new Date().toISOString(),
  };
}

export async function isNexoraStrategyQuarantined(input: {
  symbol: string;
  strategy: string;
  direction: string;
}) {
  await ensureNexoraStrategyQuarantineTable();

  const id = [input.symbol, input.strategy, input.direction].join("|");

  const result: any = await db.execute(sql`
    select *
    from nexora_strategy_quarantine
    where id = ${id}
      and status = 'blocked'
    limit 1;
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];
  return rows[0] || null;
}
