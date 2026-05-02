import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function demoteBadPaperProbes() {
  await db.execute(sql`
    update nexora_candidate_allowlist
    set score = greatest(25, score * 0.75),
        reason = coalesce(reason, '') || ' Demoted but not blocked for paper exploration.',
        updated_at = now()
    where status in ('research_probe', 'recovery_probe')
      and (win_rate < 20 or pnl < -10);
  `).catch(() => null);

  const result: any = await db.execute(sql`
    select * from nexora_candidate_allowlist
    order by score desc, updated_at desc
    limit 50;
  `).catch(() => ({ rows: [] }));

  return { ok: true, service: "nexora_bad_probe_demoter", paperOnly: true, rows: Array.isArray(result) ? result : result.rows || [], updatedAt: new Date().toISOString() };
}
