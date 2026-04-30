// server/services/memory/nexoraDecisionLineage.ts

import { db } from "../../db";

export type NexoraDecisionLineageEvent = {
  decisionId?: string;
  correlationId?: string;
  moduleKey: string;
  intent: string;
  policyClass?: string;
  gateDecision?: string;
  actionTaken?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  revenueImpact?: number | null;
  marginImpact?: number | null;
  outcome?: "pending" | "success" | "failure" | "blocked" | "unknown";
  evidence?: Record<string, unknown>;
  learningUpdate?: Record<string, unknown>;
};

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

export async function recordNexoraDecisionLineage(
  event: NexoraDecisionLineageEvent
): Promise<{ ok: boolean; stored: "db" | "log"; error?: string }> {
  const payload = {
    decisionId: event.decisionId || `nexora-decision-${Date.now()}`,
    correlationId: event.correlationId || null,
    moduleKey: event.moduleKey,
    intent: event.intent,
    policyClass: event.policyClass || null,
    gateDecision: event.gateDecision || null,
    actionTaken: event.actionTaken || null,
    relatedEntityType: event.relatedEntityType || null,
    relatedEntityId: event.relatedEntityId || null,
    revenueImpact: event.revenueImpact ?? null,
    marginImpact: event.marginImpact ?? null,
    outcome: event.outcome || "unknown",
    evidenceJson: safeJson(event.evidence),
    learningUpdateJson: safeJson(event.learningUpdate),
    createdAt: new Date().toISOString(),
  };

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS nexora_decision_lineage (
        id bigserial PRIMARY KEY,
        decision_id text NOT NULL,
        correlation_id text,
        module_key text NOT NULL,
        intent text NOT NULL,
        policy_class text,
        gate_decision text,
        action_taken text,
        related_entity_type text,
        related_entity_id text,
        revenue_impact numeric,
        margin_impact numeric,
        outcome text,
        evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        learning_update_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    ` as any);

    await db.execute(`
      INSERT INTO nexora_decision_lineage (
        decision_id,
        correlation_id,
        module_key,
        intent,
        policy_class,
        gate_decision,
        action_taken,
        related_entity_type,
        related_entity_id,
        revenue_impact,
        margin_impact,
        outcome,
        evidence_json,
        learning_update_json,
        created_at
      ) VALUES (
        '${payload.decisionId.replace(/'/g, "''")}',
        ${payload.correlationId ? `'${payload.correlationId.replace(/'/g, "''")}'` : "NULL"},
        '${payload.moduleKey.replace(/'/g, "''")}',
        '${payload.intent.replace(/'/g, "''")}',
        ${payload.policyClass ? `'${payload.policyClass.replace(/'/g, "''")}'` : "NULL"},
        ${payload.gateDecision ? `'${payload.gateDecision.replace(/'/g, "''")}'` : "NULL"},
        ${payload.actionTaken ? `'${payload.actionTaken.replace(/'/g, "''")}'` : "NULL"},
        ${payload.relatedEntityType ? `'${payload.relatedEntityType.replace(/'/g, "''")}'` : "NULL"},
        ${payload.relatedEntityId ? `'${payload.relatedEntityId.replace(/'/g, "''")}'` : "NULL"},
        ${payload.revenueImpact ?? "NULL"},
        ${payload.marginImpact ?? "NULL"},
        '${payload.outcome.replace(/'/g, "''")}',
        '${payload.evidenceJson.replace(/'/g, "''")}'::jsonb,
        '${payload.learningUpdateJson.replace(/'/g, "''")}'::jsonb,
        now()
      )
    ` as any);

    return { ok: true, stored: "db" };
  } catch (err: any) {
    console.warn("[NexoraLineage] DB write failed; logging fallback only:", err?.message || err);
    console.log("[NexoraLineage]", payload);
    return { ok: false, stored: "log", error: err?.message || "lineage_write_failed" };
  }
}

export async function getNexoraDecisionLineageSnapshot(limit = 100): Promise<any[]> {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 100)));

  try {
    const rows = await db.execute(`
      SELECT *
      FROM nexora_decision_lineage
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    ` as any);

    return Array.isArray((rows as any).rows) ? (rows as any).rows : [];
  } catch {
    return [];
  }
}
