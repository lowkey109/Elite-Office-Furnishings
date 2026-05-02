import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { getNexoraCandidateWatchlistV3 } from "../candidates/nexoraCandidateWatchlistV3";

export async function ensureNexoraWatchlistObservationsTable() {
  await db.execute(sql`
    create table if not exists nexora_watchlist_observations (
      id text primary key,
      symbol text not null,
      timeframe text not null,
      strategy text not null,
      direction text not null,
      watch_score numeric not null default 0,
      quarantined boolean not null default false,
      reason text,
      quarantine_reason text,
      status text not null default 'observing',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
}

export async function recordNexoraWatchlistObservations() {
  await ensureNexoraWatchlistObservationsTable();

  const watch = await getNexoraCandidateWatchlistV3();
  const rows = Array.isArray((watch as any).watchlist) ? (watch as any).watchlist : [];
  const recorded = [];

  for (const row of rows) {
    const id = [
      row.symbol,
      row.timeframe,
      row.strategy,
      row.direction,
      new Date().toISOString().slice(0, 13),
    ].join("|");

    await db.execute(sql`
      insert into nexora_watchlist_observations (
        id, symbol, timeframe, strategy, direction, watch_score,
        quarantined, reason, quarantine_reason, updated_at
      )
      values (
        ${id}, ${row.symbol}, ${row.timeframe}, ${row.strategy}, ${row.direction},
        ${Number(row.watchScore || 0)}, ${Boolean(row.quarantined)},
        ${row.reason || null}, ${row.quarantineReason || null}, now()
      )
      on conflict(id)
      do update set
        watch_score = excluded.watch_score,
        quarantined = excluded.quarantined,
        reason = excluded.reason,
        quarantine_reason = excluded.quarantine_reason,
        updated_at = now();
    `);

    recorded.push({ id, ...row });
  }

  return {
    ok: true,
    service: "nexora_watchlist_observations",
    paperOnly: true,
    recordedCount: recorded.length,
    recorded,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraWatchlistObservations() {
  await ensureNexoraWatchlistObservationsTable();

  const result: any = await db.execute(sql`
    select *
    from nexora_watchlist_observations
    order by created_at desc
    limit 100;
  `);

  return {
    ok: true,
    service: "nexora_watchlist_observations",
    rows: Array.isArray(result) ? result : result.rows || [],
    updatedAt: new Date().toISOString(),
  };
}
