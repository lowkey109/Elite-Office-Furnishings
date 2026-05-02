import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function getNexoraDbSafety() {
  const recovery: any = await db.execute(sql`
    select pg_is_in_recovery() as recovering;
  `).catch((err) => ({ rows: [{ recovering: true, error: String(err?.message || err) }] }));

  const counts: any = await db.execute(sql`
    select
      (select count(*)::int from market_candles) as market_candles,
      (select count(*)::int from paper_trade_outcomes) as paper_outcomes;
  `).catch(() => ({ rows: [{ market_candles: -1, paper_outcomes: -1 }] }));

  const r = recovery.rows?.[0] || {};
  const c = counts.rows?.[0] || {};

  const marketCandles = Number(c.market_candles || 0);
  const recovering = Boolean(r.recovering);

  return {
    ok: true,
    service: "nexora_db_safety",
    recovering,
    marketCandles,
    paperOutcomes: Number(c.paper_outcomes || 0),
    safeForPaperTrading: !recovering && marketCandles < 15000,
    reason: recovering
      ? "Postgres is recovering."
      : marketCandles >= 15000
      ? "Market candle table is above 15k row safety cap for small DB."
      : "DB safe for paper learning.",
    updatedAt: new Date().toISOString(),
  };
}

export async function pruneNexoraSmallDb() {
  await db.execute(sql`
    delete from market_candles
    where open_time < now() - interval '12 hours';
  `).catch(() => null);

  await db.execute(sql`
    delete from paper_trade_outcomes
    where created_at < now() - interval '3 days';
  `).catch(() => null);

  await db.execute(sql`
    delete from nexora_watchlist_observations
    where created_at < now() - interval '24 hours';
  `).catch(() => null);

  await db.execute(sql`
    delete from nexora_candidate_allowlist
    where updated_at < now() - interval '12 hours';
  `).catch(() => null);

  return {
    ok: true,
    service: "nexora_small_db_pruner",
    paperOnly: true,
    safety: await getNexoraDbSafety(),
    updatedAt: new Date().toISOString(),
  };
}
