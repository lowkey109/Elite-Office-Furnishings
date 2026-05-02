import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function getAggressivePaperRotationPlan() {
  const result: any = await db.execute(sql`
    select *
    from nexora_candidate_allowlist
    where status in ('research_probe', 'recovery_probe')
    order by score desc, updated_at desc
    limit 10;
  `).catch(() => ({ rows: [] }));

  return {
    ok: true,
    service: "nexora_aggressive_rotation_plan",
    paperOnly: true,
    plan: Array.isArray(result) ? result : result.rows || [],
    updatedAt: new Date().toISOString(),
  };
}
