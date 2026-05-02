import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function getNexoraResearchProbeMonitor() {
  let rows: any[] = [];

  try {
    const result: any = await db.execute(sql`
      select
        id,
        symbol,
        strategy,
        direction,
        status,
        entry_price,
        current_price,
        unrealized_pnl,
        metadata,
        created_at,
        updated_at
      from paper_trading_positions
      where metadata::text ilike '%researchProbe%'
      order by created_at desc
      limit 100;
    `);

    rows = Array.isArray(result) ? result : result.rows || [];
  } catch {
    rows = [];
  }

  const open = rows.filter((r) => String(r.status || "").toLowerCase() === "open");
  const closed = rows.filter((r) => String(r.status || "").toLowerCase() !== "open");

  const totalUnrealizedPnl = open.reduce((sum, r) => sum + Number(r.unrealized_pnl || 0), 0);

  return {
    ok: true,
    service: "nexora_research_probe_monitor",
    paperOnly: true,
    openCount: open.length,
    closedCount: closed.length,
    totalUnrealizedPnl,
    rows,
    updatedAt: new Date().toISOString(),
  };
}
