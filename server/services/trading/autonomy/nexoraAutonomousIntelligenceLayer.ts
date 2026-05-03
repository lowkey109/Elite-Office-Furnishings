import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function ensureNexoraAutonomyTables() {
  await db.execute(sql`
    create table if not exists nexora_signal_memory (
      id text primary key,
      market_id text,
      strategy text,
      signal jsonb,
      outcome jsonb,
      score numeric default 0,
      created_at timestamptz default now()
    );
  `);

  await db.execute(sql`
    create table if not exists nexora_strategy_rankings (
      strategy text primary key,
      total_trades int default 0,
      wins int default 0,
      losses int default 0,
      pnl numeric default 0,
      confidence numeric default 50,
      updated_at timestamptz default now()
    );
  `);

  await db.execute(sql`
    create table if not exists nexora_self_critique (
      id text primary key,
      market_id text,
      critique jsonb,
      created_at timestamptz default now()
    );
  `);

  return true;
}

export async function storeNexoraSignalMemory(input: any = {}) {
  await ensureNexoraAutonomyTables();

  const id = String(input.id || `memory_${Date.now()}`);

  await db.execute(sql`
    insert into nexora_signal_memory (
      id,
      market_id,
      strategy,
      signal,
      outcome,
      score
    ) values (
      ${id},
      ${String(input.marketId || "")},
      ${String(input.strategy || "unknown")},
      ${JSON.stringify(input.signal || {})}::jsonb,
      ${JSON.stringify(input.outcome || {})}::jsonb,
      ${Number(input.score || 0)}
    )
    on conflict (id) do nothing;
  `);

  return {
    ok: true,
    service: "nexora_signal_memory",
    stored: true,
    id,
    updatedAt: new Date().toISOString(),
  };
}

export async function updateNexoraStrategyRanking(input: any = {}) {
  await ensureNexoraAutonomyTables();

  const strategy = String(input.strategy || "unknown");
  const pnl = Number(input.pnl || 0);
  const win = pnl > 0 ? 1 : 0;
  const loss = pnl <= 0 ? 1 : 0;

  await db.execute(sql`
    insert into nexora_strategy_rankings (
      strategy,
      total_trades,
      wins,
      losses,
      pnl,
      confidence,
      updated_at
    ) values (
      ${strategy},
      1,
      ${win},
      ${loss},
      ${pnl},
      ${Number(input.confidence || 50)},
      now()
    )
    on conflict (strategy)
    do update set
      total_trades = nexora_strategy_rankings.total_trades + 1,
      wins = nexora_strategy_rankings.wins + ${win},
      losses = nexora_strategy_rankings.losses + ${loss},
      pnl = nexora_strategy_rankings.pnl + ${pnl},
      confidence = ${Number(input.confidence || 50)},
      updated_at = now();
  `);

  return {
    ok: true,
    service: "nexora_strategy_rankings",
    strategy,
    pnl,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraStrategyLeaderboard() {
  await ensureNexoraAutonomyTables();

  const rows: any = await db.execute(sql`
    select
      strategy,
      total_trades,
      wins,
      losses,
      pnl,
      confidence,
      round(
        case
          when total_trades > 0
          then (wins::numeric / total_trades::numeric) * 100
          else 0
        end,
        2
      ) as win_rate
    from nexora_strategy_rankings
    order by pnl desc, win_rate desc
    limit 50;
  `);

  return {
    ok: true,
    service: "nexora_strategy_leaderboard",
    rows: rows.rows || [],
    updatedAt: new Date().toISOString(),
  };
}

export async function runNexoraSelfCritique(input: any = {}) {
  await ensureNexoraAutonomyTables();

  const critique = {
    possibleFailureReasons: [
      "Market already priced in the news.",
      "Liquidity too thin for reliable fills.",
      "Sentiment source reliability weak.",
      "Correlation risk hidden in another market.",
      "Spread too wide after slippage.",
      "Resolution wording may be ambiguous."
    ],
    checks: {
      edgeStrong: Number(input.edgePct || 0) >= 7,
      liquiditySafe: Number(input.liquidityUsd || 0) >= 1000,
      spreadSafe: Number(input.spreadPct || 100) <= 3,
      resolutionClear: input.resolutionClear !== false,
      confidenceStrong: Number(input.confidence || 0) >= 60,
    },
    verdict:
      Number(input.edgePct || 0) >= 7 &&
      Number(input.liquidityUsd || 0) >= 1000 &&
      Number(input.spreadPct || 100) <= 3
        ? "TRADE_ALLOWED"
        : "TRADE_BLOCKED",
  };

  const id = String(input.id || `critique_${Date.now()}`);

  await db.execute(sql`
    insert into nexora_self_critique (
      id,
      market_id,
      critique
    ) values (
      ${id},
      ${String(input.marketId || "")},
      ${JSON.stringify(critique)}::jsonb
    )
    on conflict (id) do nothing;
  `);

  return {
    ok: true,
    service: "nexora_self_critique",
    id,
    critique,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraAutonomousStatus() {
  return {
    ok: true,
    service: "nexora_autonomous_intelligence",
    capabilities: [
      "signal memory",
      "strategy leaderboard",
      "trade memory",
      "self critique",
      "paper learning",
      "risk analysis",
      "fallback strategy stack",
      "market mispricing detection",
      "correlation protection",
      "resolution safety",
      "institutional execution protection"
    ],
    liveTradingEnabled: false,
    paperOnly: true,
    status: "Autonomous intelligence stack active in paper mode.",
    updatedAt: new Date().toISOString(),
  };
}
