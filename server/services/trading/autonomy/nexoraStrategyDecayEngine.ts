import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { ensureNexoraAutonomyTables } from "./nexoraAutonomousLearningEngine";

export async function runNexoraStrategyDecayDetection() {
  await ensureNexoraAutonomyTables();

  const result: any = await db.execute(sql`
    select *
    from nexora_strategy_memory
    order by updated_at desc;
  `);

  const rows = Array.isArray(result) ? result : result.rows || [];
  const updates = [];

  for (const row of rows) {
    const score = Number(row.score || 0);
    const decay = Number(row.decay_score || 0);

    const activationStatus =
      score < 45 || decay > 55 ? "disabled" :
      score >= 75 ? "active" :
      "testing";

    const reason =
      activationStatus === "disabled"
        ? "Strategy disabled by decay detection."
        : activationStatus === "active"
          ? "Strategy active by strong autonomy score."
          : "Strategy remains in testing.";

    await db.execute(sql`
      update nexora_strategy_memory
      set activation_status = ${activationStatus},
          last_reason = ${reason},
          updated_at = now()
      where id = ${row.id};
    `);

    updates.push({
      id: row.id,
      score,
      decay,
      activationStatus,
      reason,
    });
  }

  return {
    ok: true,
    service: "nexora_strategy_decay_engine",
    updates,
    updatedAt: new Date().toISOString(),
  };
}
