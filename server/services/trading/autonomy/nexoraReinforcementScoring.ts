import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { ensureNexoraAutonomyTables } from "./nexoraAutonomousLearningEngine";

export async function runNexoraReinforcementScoring() {
  await ensureNexoraAutonomyTables();

  const result: any = await db.execute(sql`
    select
      symbol,
      strategy,
      coalesce(direction, 'unknown') as direction,
      count(*)::int as trades,
      avg(case when outcome = 'win' then 1 else 0 end)::numeric as win_rate,
      sum(coalesce(realized_pnl, 0))::numeric as pnl,
      avg(coalesce(realized_pnl, 0))::numeric as avg_pnl
    from paper_trade_outcomes
    group by symbol, strategy, coalesce(direction, 'unknown');
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];
  const updates = [];

  for (const row of rows) {
    const trades = Number(row.trades || 0);
    const winRate = Number(row.win_rate || 0) * 100;
    const pnl = Number(row.pnl || 0);
    const avgPnl = Number(row.avg_pnl || 0);

    let reward = 0;
    reward += (winRate - 50) * 0.6;
    reward += pnl > 0 ? 15 : -15;
    reward += avgPnl > 0 ? 10 : -10;
    reward += trades >= 100 ? 5 : 0;

    const score = Math.max(1, Math.min(99, Math.round(50 + reward)));
    const decayScore = Math.max(0, Math.min(99, Math.round(100 - score)));

    const id = [row.symbol, row.strategy, row.direction, "reinforcement"].join("|");
    const status =
      score >= 75 ? "active" :
      score < 45 ? "disabled" :
      "testing";

    await db.execute(sql`
      insert into nexora_strategy_memory (
        id, symbol, strategy, direction, regime, score, decay_score, activation_status, last_reason, updated_at
      )
      values (
        ${id},
        ${row.symbol},
        ${row.strategy},
        ${row.direction},
        'reinforcement',
        ${score},
        ${decayScore},
        ${status},
        ${`Reinforcement score ${score}. Trades ${trades}, winRate ${winRate.toFixed(2)}, pnl ${pnl.toFixed(2)}.`},
        now()
      )
      on conflict(id)
      do update set
        score = excluded.score,
        decay_score = excluded.decay_score,
        activation_status = excluded.activation_status,
        last_reason = excluded.last_reason,
        updated_at = now();
    `);

    updates.push({
      id,
      trades,
      winRate,
      pnl,
      avgPnl,
      score,
      decayScore,
      status,
    });
  }

  return {
    ok: true,
    service: "nexora_reinforcement_scoring",
    updates,
    updatedAt: new Date().toISOString(),
  };
}
