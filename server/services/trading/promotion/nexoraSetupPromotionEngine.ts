
import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function ensureNexoraSetupPromotionTable() {
  await db.execute(sql`
    create table if not exists nexora_setup_promotions (
      id text primary key,
      symbol text not null,
      strategy text not null,
      direction text not null,
      status text not null default 'testing',
      trades integer not null default 0,
      win_rate numeric not null default 0,
      pnl numeric not null default 0,
      profit_factor numeric not null default 0,
      reason text,
      updated_at timestamptz not null default now()
    );
  `);
}

export function classifySetup(input: {
  trades: number;
  winRate: number;
  pnl: number;
  profitFactor: number;
}) {
  if (input.trades < 20) return { status: "testing", reason: "Needs at least 20 samples." };
  if (input.pnl < 0 || input.profitFactor < 0.8) return { status: "blocked", reason: "Negative P&L or weak profit factor." };
  if (input.trades >= 300 && input.winRate >= 60 && input.profitFactor >= 1.5) return { status: "elite", reason: "Elite setup proven." };
  if (input.trades >= 100 && input.winRate >= 55 && input.profitFactor >= 1.2) return { status: "promoted", reason: "Setup promoted." };
  if (input.trades >= 40 && input.winRate >= 50 && input.profitFactor >= 1.0) return { status: "candidate", reason: "Candidate setup." };
  return { status: "testing", reason: "Still gathering evidence." };
}

export async function refreshNexoraSetupPromotions() {
  await ensureNexoraSetupPromotionTable();

  const result: any = await db.execute(sql`
    select
      symbol,
      strategy,
      coalesce(direction, 'unknown') as direction,
      count(*)::int as trades,
      avg(case when outcome = 'win' then 1 else 0 end)::numeric as win_rate,
      sum(coalesce(realized_pnl,0))::numeric as pnl,
      sum(greatest(coalesce(realized_pnl,0),0))::numeric as gross_profit,
      abs(sum(least(coalesce(realized_pnl,0),0)))::numeric as gross_loss
    from paper_trade_outcomes
    group by symbol, strategy, coalesce(direction, 'unknown')
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];
  const updates = [];

  for (const row of rows) {
    const trades = Number(row.trades || 0);
    const winRate = Number(row.win_rate || 0) * 100;
    const pnl = Number(row.pnl || 0);
    const grossProfit = Number(row.gross_profit || 0);
    const grossLoss = Number(row.gross_loss || 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;
    const classified = classifySetup({ trades, winRate, pnl, profitFactor });
    const id = [row.symbol, row.strategy, row.direction].join("|");

    await db.execute(sql`
      insert into nexora_setup_promotions (
        id, symbol, strategy, direction, status, trades, win_rate, pnl, profit_factor, reason, updated_at
      )
      values (
        ${id}, ${row.symbol}, ${row.strategy}, ${row.direction}, ${classified.status},
        ${trades}, ${winRate}, ${pnl}, ${profitFactor}, ${classified.reason}, now()
      )
      on conflict(id)
      do update set
        status = excluded.status,
        trades = excluded.trades,
        win_rate = excluded.win_rate,
        pnl = excluded.pnl,
        profit_factor = excluded.profit_factor,
        reason = excluded.reason,
        updated_at = now();
    `);

    updates.push({ id, status: classified.status, trades, winRate, pnl, profitFactor, reason: classified.reason });
  }

  return {
    ok: true,
    service: "nexora_setup_promotion_engine",
    updates,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraSetupPromotions() {
  await ensureNexoraSetupPromotionTable();

  const result: any = await db.execute(sql`
    select *
    from nexora_setup_promotions
    order by
      case status
        when 'elite' then 1
        when 'promoted' then 2
        when 'candidate' then 3
        when 'testing' then 4
        else 5
      end,
      profit_factor desc,
      win_rate desc;
  `);

  return {
    ok: true,
    service: "nexora_setup_promotion_engine",
    rows: Array.isArray(result) ? result : result.rows || [],
    updatedAt: new Date().toISOString(),
  };
}
