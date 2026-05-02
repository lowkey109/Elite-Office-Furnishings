
import { isNexoraStrategyQuarantined } from "../quality/nexoraStrategyQuarantine";
import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { runNexoraCandidateHunter } from "./nexoraCandidateHunter";

export async function ensureNexoraCandidateAllowlistTable() {
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
}

export async function refreshNexoraCandidateAllowlist() {
  await ensureNexoraCandidateAllowlistTable();

  const hunt = await runNexoraCandidateHunter();
  const rawApproved = [...(hunt.approved || []), ...(hunt.research || [])];

  const approved = [];
  for (const candidate of rawApproved) {
    const quarantined = await isNexoraStrategyQuarantined({
      symbol: candidate.symbol,
      strategy: candidate.strategy,
      direction: candidate.direction,
    }).catch(() => null);

    if (!quarantined) approved.push(candidate);
  }

  for (const candidate of approved) {
    const id = [
      candidate.symbol,
      candidate.timeframe,
      candidate.strategy,
      candidate.direction,
    ].join("|");

    await db.execute(sql`
      insert into nexora_candidate_allowlist (
        id, symbol, timeframe, strategy, direction, score, win_rate, pnl, trades, status, reason, updated_at
      )
      values (
        ${id},
        ${candidate.symbol},
        ${candidate.timeframe},
        ${candidate.strategy},
        ${candidate.direction},
        ${candidate.score},
        ${candidate.winRate},
        ${candidate.pnl},
        ${candidate.trades},
        'research_probe',
        'Candidate Hunter approved this setup from recent candle backtest.',
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
  }

  await db.execute(sql`
    delete from nexora_candidate_allowlist a
    using nexora_strategy_quarantine q
    where a.symbol = q.symbol
      and a.strategy = q.strategy
      and a.direction = q.direction
      and q.status = 'blocked';
  `);

  return {
    ok: true,
    service: "nexora_candidate_allowlist",
    insertedOrUpdated: approved.length,
    candidates: approved,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraCandidateAllowlist() {
  await ensureNexoraCandidateAllowlistTable();

  const result: any = await db.execute(sql`
    select *
    from nexora_candidate_allowlist
    order by score desc, win_rate desc, pnl desc
    limit 50;
  `);

  return {
    ok: true,
    service: "nexora_candidate_allowlist",
    rows: Array.isArray(result) ? result : result.rows || [],
    updatedAt: new Date().toISOString(),
  };
}

export async function findNexoraAllowedCandidate(input: {
  symbol: string;
  strategy: string;
  direction: string;
}) {
  await ensureNexoraCandidateAllowlistTable();

  const result: any = await db.execute(sql`
    select *
    from nexora_candidate_allowlist
    where symbol = ${input.symbol}
      and strategy = ${input.strategy}
      and direction = ${input.direction}
      and status = 'research_probe'
    order by score desc
    limit 1;
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];
  return rows[0] || null;
}


export async function pruneNexoraCandidateAllowlist() {
  const allowlist = await getNexoraCandidateAllowlist();
  const rows = Array.isArray((allowlist as any).rows) ? (allowlist as any).rows : [];
  const removed: any[] = [];

  for (const row of rows) {
    const quarantined = await isNexoraStrategyQuarantined({
      symbol: row.symbol,
      strategy: row.strategy,
      direction: row.direction,
    }).catch(() => null);

    if (quarantined) {
      removed.push({
        id: row.id,
        symbol: row.symbol,
        strategy: row.strategy,
        direction: row.direction,
        reason: quarantined.reason,
      });
    }
  }

  return {
    ok: true,
    service: "nexora_candidate_allowlist_prune",
    paperOnly: true,
    removed,
    removedCount: removed.length,
    updatedAt: new Date().toISOString(),
  };
}
