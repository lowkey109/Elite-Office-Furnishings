import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function cleanNexoraProbeAllowlist() {
  await db.execute(sql`
    delete from nexora_candidate_allowlist a
    using nexora_probe_cooldowns c
    where a.symbol = c.symbol
      and a.strategy = c.strategy
      and a.direction = c.direction
      and c.blocked_until > now();
  `).catch(() => null);

  await db.execute(sql`
    delete from nexora_candidate_allowlist
    where updated_at < now() - interval '2 hours'
      and status in ('recovery_probe', 'research_probe');
  `).catch(() => null);

  const result: any = await db.execute(sql`
    select *
    from nexora_candidate_allowlist
    order by score desc, updated_at desc
    limit 50;
  `).catch(() => ({ rows: [] }));

  return {
    ok: true,
    service: "nexora_probe_allowlist_cleaner",
    paperOnly: true,
    remaining: Array.isArray(result) ? result : result.rows || [],
    updatedAt: new Date().toISOString(),
  };
}
