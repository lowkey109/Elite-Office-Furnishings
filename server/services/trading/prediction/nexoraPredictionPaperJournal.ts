import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function ensurePredictionPaperJournal() {
  await db.execute(sql`
    create table if not exists nexora_prediction_paper_journal (
      id text primary key,
      market_id text,
      title text,
      category text,
      strategy text not null,
      direction text not null,
      market_probability numeric,
      model_probability numeric,
      edge_pct numeric,
      position_usd numeric,
      status text not null default 'open',
      decision jsonb,
      result jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    create index if not exists nexora_prediction_paper_journal_created_idx
    on nexora_prediction_paper_journal(created_at desc);
  `);

  return true;
}

export async function recordNexoraPredictionPaperDecision(input: any = {}) {
  await ensurePredictionPaperJournal();

  const id = String(input.id || `${input.marketId || "market"}|${Date.now()}`);
  const decision = input.decision || input;

  await db.execute(sql`
    insert into nexora_prediction_paper_journal (
      id, market_id, title, category, strategy, direction,
      market_probability, model_probability, edge_pct, position_usd, status, decision, updated_at
    ) values (
      ${id},
      ${String(input.marketId || "")},
      ${String(input.title || "")},
      ${String(input.category || "unknown")},
      ${String(input.strategy || "prediction_edge_stack")},
      ${String(input.direction || input.finalAction || "MONITOR_ONLY")},
      ${String(input.marketProbability ?? 0)},
      ${String(input.modelProbability ?? input.fairProbability ?? 0)},
      ${String(input.edgePct ?? 0)},
      ${String(input.positionUsd ?? 0)},
      ${String(input.status || "open")},
      ${JSON.stringify(decision)}::jsonb,
      now()
    )
    on conflict (id) do update set
      status = excluded.status,
      decision = excluded.decision,
      updated_at = now();
  `);

  return {
    ok: true,
    service: "nexora_prediction_paper_journal",
    paperOnly: true,
    recorded: true,
    id,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraPredictionPaperJournal(limit = 50) {
  await ensurePredictionPaperJournal();

  const rows: any = await db.execute(sql`
    select *
    from nexora_prediction_paper_journal
    order by created_at desc
    limit ${Number(limit) || 50};
  `);

  return {
    ok: true,
    service: "nexora_prediction_paper_journal",
    paperOnly: true,
    rows: rows.rows || [],
    updatedAt: new Date().toISOString(),
  };
}
