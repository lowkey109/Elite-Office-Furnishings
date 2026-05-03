import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function getNexoraDbHealthGate() {
  try {
    const r: any = await db.execute(sql`
      select
        pg_is_in_recovery() as recovering,
        pg_database_size(current_database()) as db_size_bytes;
    `);

    const row = r.rows?.[0] || {};
    const dbSizeBytes = Number(row.db_size_bytes || 0);
    const recovering = Boolean(row.recovering);

    const maxSmallDbBytes = 850 * 1024 * 1024;

    return {
      ok: true,
      service: "nexora_db_health_gate",
      recovering,
      dbSizeBytes,
      dbSizeMb: Math.round((dbSizeBytes / 1024 / 1024) * 100) / 100,
      safeForWrites: !recovering && dbSizeBytes < maxSmallDbBytes,
      action: !recovering && dbSizeBytes < maxSmallDbBytes ? "WRITES_ALLOWED" : "MONITOR_ONLY",
      reason: recovering
        ? "Postgres is recovering."
        : dbSizeBytes >= maxSmallDbBytes
        ? "Database near small-plan safety cap."
        : "DB healthy for paper writes.",
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      service: "nexora_db_health_gate",
      safeForWrites: false,
      action: "MONITOR_ONLY",
      reason: "DB health check failed.",
      error: err instanceof Error ? err.message : String(err),
      updatedAt: new Date().toISOString(),
    };
  }
}
