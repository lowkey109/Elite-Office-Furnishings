import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { getNexoraCandidateWatchlistV3 } from "../candidates/nexoraCandidateWatchlistV3";
import { isNexoraProbeCoolingDown } from "../probes/nexoraProbeCooldown";

export async function refreshNexoraExplorationProbes() {
  const watch = await getNexoraCandidateWatchlistV3();
  const rows = Array.isArray((watch as any).watchlist) ? (watch as any).watchlist : [];

  await db.execute(sql`
    create table if not exists nexora_candidate_allowlist (
      id text primary key,
      symbol text not null,
      timeframe text not null,
      strategy text not null,
      direction text not null,
      score numeric not null default 0,
      win_rate numeric not null default 0,
      pnl numeric not null default 0,
      trades integer not null default 0,
      status text not null default 'research_probe',
      reason text,
      updated_at timestamptz not null default now()
    );
  `);

  const ranked = rows
    .filter((r: any) => Number(r.watchScore || 0) >= 52)
    .sort((a: any, b: any) => Number(b.watchScore || 0) - Number(a.watchScore || 0));

  const eligible = [];
  const skipped = [];

  for (const row of ranked) {
    const cooldown = await isNexoraProbeCoolingDown({
      symbol: row.symbol,
      strategy: row.strategy,
      direction: row.direction,
    }).catch(() => null);

    if (cooldown) {
      skipped.push({
        symbol: row.symbol,
        timeframe: row.timeframe,
        strategy: row.strategy,
        direction: row.direction,
        reason: cooldown.reason || "Probe cooling down.",
        blockedUntil: cooldown.blocked_until,
      });
      continue;
    }

    eligible.push(row);
    if (eligible.length >= 1) break;
  }

  const inserted = [];

  for (const row of eligible) {
    const status = row.quarantined ? "recovery_probe" : "research_probe";
    const id = [row.symbol, row.timeframe, row.strategy, row.direction].join("|");

    await db.execute(sql`
      insert into nexora_candidate_allowlist (
        id, symbol, timeframe, strategy, direction, score,
        win_rate, pnl, trades, status, reason, updated_at
      )
      values (
        ${id},
        ${row.symbol},
        ${row.timeframe},
        ${row.strategy},
        ${row.direction},
        ${Number(row.watchScore || 0)},
        0,
        0,
        0,
        ${status},
        ${row.quarantined
          ? "Paper-only recovery probe from watchlist. Quarantined for live/scaled use."
          : "Paper-only exploration probe from watchlist."},
        now()
      )
      on conflict(id)
      do update set
        score = excluded.score,
        status = excluded.status,
        reason = excluded.reason,
        updated_at = now();
    `);

    inserted.push({
      id,
      symbol: row.symbol,
      timeframe: row.timeframe,
      strategy: row.strategy,
      direction: row.direction,
      score: Number(row.watchScore || 0),
      status,
      quarantined: Boolean(row.quarantined),
      tradeMode: "paper_only_micro_probe",
    });
  }

  return {
    ok: true,
    service: "nexora_exploration_engine",
    paperOnly: true,
    insertedOrUpdated: inserted.length,
    probes: inserted,
    skippedCooldowns: typeof skipped !== "undefined" ? skipped : [],
    note: "Exploration probes are paper-only, top-3 rotation enabled, and skip active cooldowns.",
    updatedAt: new Date().toISOString(),
  };
}
