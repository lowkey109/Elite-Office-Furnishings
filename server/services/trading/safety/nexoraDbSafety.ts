import { Client } from "pg";

type DbSafety = {
  ok: boolean;
  service: "nexora_db_safety";
  paperOnly: true;
  recovering: boolean;
  marketCandles: number;
  paperOutcomes: number;
  watchlistObservations: number;
  safeForPaperTrading: boolean;
  reason: string;
  errors?: Record<string, string>;
  updatedAt: string;
};

const SMALL_DB_MARKET_CANDLES_CAP = Number(process.env.NEXORA_MARKET_CANDLES_CAP || 15000);

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  return url;
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: databaseUrl(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    query_timeout: 15000,
    statement_timeout: 15000,
  } as any);

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function tableExists(client: Client, table: string): Promise<boolean> {
  const r = await client.query(
    `select to_regclass($1) as regclass;`,
    [table],
  );
  return Boolean(r.rows?.[0]?.regclass);
}

async function countTable(client: Client, table: string): Promise<{ count: number; error?: string }> {
  try {
    const exists = await tableExists(client, table);
    if (!exists) return { count: 0, error: "table_missing" };

    const r = await client.query(`select count(*)::int as count from ${table};`);
    return { count: Number(r.rows?.[0]?.count || 0) };
  } catch (err: any) {
    return { count: -1, error: String(err?.message || err) };
  }
}

export async function getNexoraDbSafety(): Promise<DbSafety> {
  try {
    return await withClient(async (client) => {
      let recovering = true;
      try {
        const recovery = await client.query(`select pg_is_in_recovery() as recovering;`);
        recovering = Boolean(recovery.rows?.[0]?.recovering);
      } catch (err: any) {
        return {
          ok: true,
          service: "nexora_db_safety",
          paperOnly: true,
          recovering: true,
          marketCandles: -1,
          paperOutcomes: -1,
          watchlistObservations: -1,
          safeForPaperTrading: false,
          reason: `DB recovery check failed: ${String(err?.message || err)}`,
          updatedAt: new Date().toISOString(),
        };
      }

      if (recovering) {
        return {
          ok: true,
          service: "nexora_db_safety",
          paperOnly: true,
          recovering: true,
          marketCandles: -1,
          paperOutcomes: -1,
          watchlistObservations: -1,
          safeForPaperTrading: false,
          reason: "Postgres is recovering.",
          updatedAt: new Date().toISOString(),
        };
      }

      const marketCandles = await countTable(client, "market_candles");
      const paperOutcomes = await countTable(client, "paper_trade_outcomes");
      const watchlistObservations = await countTable(client, "nexora_watchlist_observations");

      const errors: Record<string, string> = {};
      if (marketCandles.error) errors.marketCandles = marketCandles.error;
      if (paperOutcomes.error) errors.paperOutcomes = paperOutcomes.error;
      if (watchlistObservations.error) errors.watchlistObservations = watchlistObservations.error;

      const countsAvailable = marketCandles.count >= 0 && paperOutcomes.count >= 0 && watchlistObservations.count >= 0;
      const underCap = marketCandles.count >= 0 && marketCandles.count < SMALL_DB_MARKET_CANDLES_CAP;
      const safeForPaperTrading = !recovering && countsAvailable && underCap;

      return {
        ok: true,
        service: "nexora_db_safety",
        paperOnly: true,
        recovering: false,
        marketCandles: marketCandles.count,
        paperOutcomes: paperOutcomes.count,
        watchlistObservations: watchlistObservations.count,
        safeForPaperTrading,
        reason: !countsAvailable
          ? "DB is not safe yet because one or more table counts failed."
          : underCap
          ? "DB safe for paper learning."
          : `Market candle table is above ${SMALL_DB_MARKET_CANDLES_CAP} row safety cap for small DB.`,
        errors: Object.keys(errors).length ? errors : undefined,
        updatedAt: new Date().toISOString(),
      };
    });
  } catch (err: any) {
    return {
      ok: true,
      service: "nexora_db_safety",
      paperOnly: true,
      recovering: true,
      marketCandles: -1,
      paperOutcomes: -1,
      watchlistObservations: -1,
      safeForPaperTrading: false,
      reason: `DB safety check failed: ${String(err?.message || err)}`,
      updatedAt: new Date().toISOString(),
    };
  }
}

async function safeDelete(client: Client, label: string, query: string, params: any[] = []) {
  try {
    const r = await client.query(query, params);
    return { label, deleted: r.rowCount || 0 };
  } catch (err: any) {
    return { label, deleted: 0, error: String(err?.message || err) };
  }
}

export async function pruneNexoraSmallDb() {
  const before = await getNexoraDbSafety();

  if (before.recovering) {
    return {
      ok: false,
      service: "nexora_small_db_pruner",
      paperOnly: true,
      skipped: true,
      reason: before.reason,
      safety: before,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    return await withClient(async (client) => {
      const results = await Promise.all([
        safeDelete(client, "marketCandlesOlderThan12h", `
          delete from market_candles
          where open_time < now() - interval '12 hours';
        `),
        safeDelete(client, "marketCandlesOverCap", `
          delete from market_candles
          where ctid in (
            select ctid
            from market_candles
            order by open_time desc
            offset $1
          );
        `, [SMALL_DB_MARKET_CANDLES_CAP]),
        safeDelete(client, "paperOutcomesOlderThan3d", `
          delete from paper_trade_outcomes
          where created_at < now() - interval '3 days';
        `),
        safeDelete(client, "watchlistObservationsOlderThan24h", `
          delete from nexora_watchlist_observations
          where created_at < now() - interval '24 hours';
        `),
        safeDelete(client, "candidateAllowlistOlderThan12h", `
          delete from nexora_candidate_allowlist
          where updated_at < now() - interval '12 hours';
        `),
      ]);

      const deleted: Record<string, number> = {};
      const errors: Record<string, string> = {};
      for (const r of results) {
        deleted[r.label] = r.deleted;
        if (r.error) errors[r.label] = r.error;
      }

      return {
        ok: Object.keys(errors).length === 0,
        service: "nexora_small_db_pruner",
        paperOnly: true,
        deleted,
        errors: Object.keys(errors).length ? errors : undefined,
        safety: await getNexoraDbSafety(),
        updatedAt: new Date().toISOString(),
      };
    });
  } catch (err: any) {
    return {
      ok: false,
      service: "nexora_small_db_pruner",
      paperOnly: true,
      skipped: true,
      reason: `Prune failed safely: ${String(err?.message || err)}`,
      safety: before,
      updatedAt: new Date().toISOString(),
    };
  }
}
