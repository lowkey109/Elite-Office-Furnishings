
import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function ensureNexoraDecisionAuditTable() {
  await db.execute(sql`
    create table if not exists nexora_decision_audit (
      id bigserial primary key,
      symbol text not null,
      strategy text not null,
      direction text not null,
      decision text not null,
      confidence numeric,
      agreement_count integer,
      blocked_reasons jsonb,
      intelligence jsonb,
      signals jsonb,
      created_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    create index if not exists nexora_decision_audit_created_idx
    on nexora_decision_audit(created_at desc);
  `);
}

export async function recordNexoraDecisionAudit(input: {
  symbol: string;
  strategy: string;
  direction: string;
  decision: "approved" | "rejected" | "observed";
  confidence?: number;
  agreementCount?: number;
  blockedReasons?: string[];
  intelligence?: unknown;
  signals?: unknown;
}) {
  await ensureNexoraDecisionAuditTable();

  await db.execute(sql`
    insert into nexora_decision_audit (
      symbol,
      strategy,
      direction,
      decision,
      confidence,
      agreement_count,
      blocked_reasons,
      intelligence,
      signals
    )
    values (
      ${input.symbol},
      ${input.strategy},
      ${input.direction},
      ${input.decision},
      ${input.confidence ?? null},
      ${input.agreementCount ?? null},
      ${JSON.stringify(input.blockedReasons || [])},
      ${JSON.stringify(input.intelligence || {})},
      ${JSON.stringify(input.signals || [])}
    );
  `);

  return { ok: true };
}

export async function getNexoraDecisionAudit(limit = 100) {
  await ensureNexoraDecisionAuditTable();

  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));

  const result: any = await db.execute(sql`
    select *
    from nexora_decision_audit
    order by created_at desc
    limit ${safeLimit};
  `);

  return {
    ok: true,
    service: "nexora_decision_audit",
    rows: Array.isArray(result) ? result : result.rows || [],
    updatedAt: new Date().toISOString(),
  };
}
