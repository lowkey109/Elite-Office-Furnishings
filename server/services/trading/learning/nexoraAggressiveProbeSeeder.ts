import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { getNexoraCandidateWatchlistV3 } from "../candidates/nexoraCandidateWatchlistV3";

export async function seedAggressivePaperProbes() {
  const watch = await getNexoraCandidateWatchlistV3();
  const rows = Array.isArray((watch as any).watchlist) ? (watch as any).watchlist : [];
  const seeded = [];

  for (const row of rows.sort((a: any, b: any) => Number(b.watchScore || 0) - Number(a.watchScore || 0)).slice(0, 10)) {
    const id = [row.symbol, row.timeframe, row.strategy, row.direction].join("|");

    await db.execute(sql`
      insert into nexora_candidate_allowlist (
        id, symbol, timeframe, strategy, direction, score,
        win_rate, pnl, trades, status, reason, updated_at
      )
      values (
        ${id}, ${row.symbol}, ${row.timeframe}, ${row.strategy}, ${row.direction},
        ${Number(row.watchScore || 40)}, 0, 0, 0,
        'research_probe',
        'Aggressive PAPER-ONLY learning seed. Old quarantine ignored for paper discovery.',
        now()
      )
      on conflict(id)
      do update set
        score = excluded.score,
        status = excluded.status,
        reason = excluded.reason,
        updated_at = now();
    `);

    seeded.push({ id, symbol: row.symbol, timeframe: row.timeframe, strategy: row.strategy, direction: row.direction, score: row.watchScore });
  }

  return { ok: true, service: "nexora_aggressive_probe_seeder", paperOnly: true, seededCount: seeded.length, seeded, updatedAt: new Date().toISOString() };
}
