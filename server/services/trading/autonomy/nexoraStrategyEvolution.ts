import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { ensureNexoraAutonomyTables } from "./nexoraAutonomousLearningEngine";

export async function ensureNexoraStrategyEvolutionTable() {
  await db.execute(sql`
    create table if not exists nexora_strategy_evolution (
      id text primary key,
      parent_id text,
      symbol text not null,
      strategy text not null,
      direction text not null,
      variant text not null,
      mutation jsonb,
      status text not null default 'proposed',
      score numeric not null default 50,
      reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
}

export async function runNexoraStrategyEvolution() {
  await ensureNexoraAutonomyTables();
  await ensureNexoraStrategyEvolutionTable();

  const result: any = await db.execute(sql`
    select *
    from nexora_strategy_memory
    where score >= 60
    order by score desc
    limit 25;
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];
  const variants = [];

  for (const row of rows) {
    const mutations = [
      { name: "tighter_entry", confidenceBoost: 3, note: "reduce false entries" },
      { name: "wider_stop", confidenceBoost: 1, note: "survive noise" },
      { name: "faster_exit", confidenceBoost: 2, note: "protect gains" },
      { name: "mtf_confirmed", confidenceBoost: 4, note: "requires multi-timeframe agreement" },
    ];

    for (const mutation of mutations) {
      const id = [row.id, mutation.name].join("|");
      const score = Math.min(99, Number(row.score || 50) + Number(mutation.confidenceBoost || 0));

      await db.execute(sql`
        insert into nexora_strategy_evolution (
          id, parent_id, symbol, strategy, direction, variant, mutation, status, score, reason, updated_at
        )
        values (
          ${id},
          ${row.id},
          ${row.symbol},
          ${row.strategy},
          ${row.direction},
          ${mutation.name},
          ${JSON.stringify(mutation)},
          'proposed',
          ${score},
          ${`Generated from strategy memory score ${row.score}.`},
          now()
        )
        on conflict(id)
        do update set
          score = excluded.score,
          mutation = excluded.mutation,
          reason = excluded.reason,
          updated_at = now();
      `);

      variants.push({
        id,
        parentId: row.id,
        symbol: row.symbol,
        strategy: row.strategy,
        direction: row.direction,
        variant: mutation.name,
        score,
      });
    }
  }

  return {
    ok: true,
    service: "nexora_strategy_evolution",
    variants,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraStrategyEvolution() {
  await ensureNexoraStrategyEvolutionTable();

  const result: any = await db.execute(sql`
    select *
    from nexora_strategy_evolution
    order by score desc, updated_at desc
    limit 100;
  `);

  return {
    ok: true,
    service: "nexora_strategy_evolution",
    rows: Array.isArray(result) ? result : result.rows || [],
    updatedAt: new Date().toISOString(),
  };
}
