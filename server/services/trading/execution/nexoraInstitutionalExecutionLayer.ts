import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function ensureNexoraExecutionTables() {
  await db.execute(sql`
    create table if not exists nexora_execution_audit_log (
      id text primary key,
      event_type text not null,
      severity text not null default 'info',
      mode text not null default 'paper',
      payload jsonb,
      created_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    create table if not exists nexora_manual_approvals (
      id text primary key,
      signal_id text not null,
      approved boolean not null default false,
      approved_by text,
      reason text,
      payload jsonb,
      created_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    create table if not exists nexora_order_fingerprints (
      fingerprint text primary key,
      market_id text,
      direction text,
      mode text not null default 'paper',
      created_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    create table if not exists nexora_emergency_stop (
      id text primary key default 'global',
      enabled boolean not null default false,
      reason text,
      updated_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    insert into nexora_emergency_stop (id, enabled, reason)
    values ('global', false, 'initialized')
    on conflict (id) do nothing;
  `);

  return true;
}

export async function writeNexoraExecutionAudit(eventType: string, payload: any = {}, severity = "info", mode = "paper") {
  await ensureNexoraExecutionTables();
  const id = `${eventType}|${Date.now()}|${Math.random().toString(36).slice(2)}`;

  await db.execute(sql`
    insert into nexora_execution_audit_log (id, event_type, severity, mode, payload)
    values (${id}, ${eventType}, ${severity}, ${mode}, ${JSON.stringify(payload)}::jsonb);
  `);

  return { ok: true, service: "nexora_execution_audit_log", id, eventType, severity, mode, updatedAt: new Date().toISOString() };
}

export async function getNexoraExecutionAudit(limit = 100) {
  await ensureNexoraExecutionTables();
  const rows: any = await db.execute(sql`
    select *
    from nexora_execution_audit_log
    order by created_at desc
    limit ${Number(limit) || 100};
  `);

  return {
    ok: true,
    service: "nexora_execution_audit_log",
    rows: rows.rows || [],
    updatedAt: new Date().toISOString(),
  };
}

export async function setNexoraEmergencyStop(enabled: boolean, reason = "") {
  await ensureNexoraExecutionTables();

  await db.execute(sql`
    insert into nexora_emergency_stop (id, enabled, reason, updated_at)
    values ('global', ${enabled}, ${reason}, now())
    on conflict (id) do update set enabled = excluded.enabled, reason = excluded.reason, updated_at = now();
  `);

  await writeNexoraExecutionAudit("emergency_stop_changed", { enabled, reason }, enabled ? "critical" : "warning", "paper");

  return {
    ok: true,
    service: "nexora_emergency_stop",
    enabled,
    reason,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraEmergencyStop() {
  await ensureNexoraExecutionTables();

  const rows: any = await db.execute(sql`
    select *
    from nexora_emergency_stop
    where id = 'global'
    limit 1;
  `);

  const row = rows.rows?.[0] || { enabled: false, reason: "missing" };

  return {
    ok: true,
    service: "nexora_emergency_stop",
    enabled: Boolean(row.enabled),
    reason: row.reason || "",
    updatedAt: new Date().toISOString(),
  };
}

export function validateNexoraHardLossLimits(input: any = {}) {
  const dailyPnl = Number(input.dailyPnl || 0);
  const openRiskUsd = Number(input.openRiskUsd || 0);
  const bankrollUsd = Number(input.bankrollUsd || 1000);
  const maxDailyLossPct = Number(input.maxDailyLossPct || 0.03);
  const maxOpenRiskPct = Number(input.maxOpenRiskPct || 0.1);

  const maxDailyLossUsd = bankrollUsd * maxDailyLossPct;
  const maxOpenRiskUsd = bankrollUsd * maxOpenRiskPct;

  const blockedReasons: string[] = [];
  if (dailyPnl <= -maxDailyLossUsd) blockedReasons.push("Daily loss limit reached.");
  if (openRiskUsd > maxOpenRiskUsd) blockedReasons.push("Open risk limit exceeded.");

  return {
    ok: true,
    service: "nexora_hard_loss_limits",
    paperOnlyDefault: true,
    tradeAllowed: blockedReasons.length === 0,
    dailyPnl,
    openRiskUsd,
    bankrollUsd,
    maxDailyLossUsd,
    maxOpenRiskUsd,
    blockedReasons,
    updatedAt: new Date().toISOString(),
  };
}

export async function checkNexoraDuplicateOrder(input: any = {}) {
  await ensureNexoraExecutionTables();

  const fingerprint = String(
    input.fingerprint ||
    [
      input.marketId || "unknown_market",
      input.direction || "unknown_direction",
      input.limitPrice || "no_price",
      input.strategy || "unknown_strategy",
    ].join("|")
  );

  const existing: any = await db.execute(sql`
    select fingerprint
    from nexora_order_fingerprints
    where fingerprint = ${fingerprint}
    limit 1;
  `);

  const duplicate = (existing.rows || []).length > 0;

  if (!duplicate) {
    await db.execute(sql`
      insert into nexora_order_fingerprints (fingerprint, market_id, direction, mode)
      values (${fingerprint}, ${String(input.marketId || "")}, ${String(input.direction || "")}, ${String(input.mode || "paper")})
      on conflict (fingerprint) do nothing;
    `);
  }

  return {
    ok: true,
    service: "nexora_duplicate_order_protection",
    duplicate,
    tradeAllowed: !duplicate,
    fingerprint,
    updatedAt: new Date().toISOString(),
  };
}

export async function recordNexoraManualApproval(input: any = {}) {
  await ensureNexoraExecutionTables();

  const id = String(input.id || `${input.signalId || "signal"}|approval|${Date.now()}`);

  await db.execute(sql`
    insert into nexora_manual_approvals (id, signal_id, approved, approved_by, reason, payload)
    values (
      ${id},
      ${String(input.signalId || "")},
      ${Boolean(input.approved)},
      ${String(input.approvedBy || "operator")},
      ${String(input.reason || "")},
      ${JSON.stringify(input)}::jsonb
    )
    on conflict (id) do update set
      approved = excluded.approved,
      approved_by = excluded.approved_by,
      reason = excluded.reason,
      payload = excluded.payload;
  `);

  await writeNexoraExecutionAudit("manual_approval_recorded", input, input.approved ? "warning" : "info", "paper");

  return {
    ok: true,
    service: "nexora_manual_approval",
    id,
    approved: Boolean(input.approved),
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraPaperToLivePromotionGate(input: any = {}) {
  const sampleSize = Number(input.sampleSize || input.paperSampleSize || 0);
  const winRate = Number(input.winRate || 0);
  const profitFactor = Number(input.profitFactor || 0);
  const maxDrawdownPct = Number(input.maxDrawdownPct || 100);
  const calibrationErrorPct = Number(input.calibrationErrorPct || 100);
  const minSampleSize = Number(input.minSampleSize || 1000);

  const blockedReasons: string[] = [];
  if (sampleSize < minSampleSize) blockedReasons.push(`Paper sample size below ${minSampleSize}.`);
  if (winRate < 52) blockedReasons.push("Win rate below 52%.");
  if (profitFactor < 1.2) blockedReasons.push("Profit factor below 1.2.");
  if (maxDrawdownPct > 10) blockedReasons.push("Max drawdown above 10%.");
  if (calibrationErrorPct > 8) blockedReasons.push("Calibration error above 8%.");

  return {
    ok: true,
    service: "nexora_paper_to_live_promotion_gate",
    liveTradingEnabled: false,
    promotionApproved: blockedReasons.length === 0,
    blockedReasons,
    metrics: { sampleSize, winRate, profitFactor, maxDrawdownPct, calibrationErrorPct },
    rule: "No strategy can be promoted without statistically meaningful paper proof.",
    updatedAt: new Date().toISOString(),
  };
}

export async function runNexoraInstitutionalExecutionPreflight(input: any = {}) {
  await ensureNexoraExecutionTables();

  const emergency = await getNexoraEmergencyStop();
  const loss = validateNexoraHardLossLimits(input);
  const duplicate = await checkNexoraDuplicateOrder(input);
  const promotion = await getNexoraPaperToLivePromotionGate(input);

  const blockedReasons = [
    ...(emergency.enabled ? [`Emergency stop active: ${emergency.reason}`] : []),
    ...loss.blockedReasons,
    ...(duplicate.duplicate ? ["Duplicate order blocked."] : []),
    ...(input.requiresPromotion ? promotion.blockedReasons : []),
  ];

  const allowed = blockedReasons.length === 0;

  await writeNexoraExecutionAudit("institutional_execution_preflight", {
    input,
    emergency,
    loss,
    duplicate,
    promotion,
    allowed,
    blockedReasons,
  }, allowed ? "info" : "warning", "paper");

  return {
    ok: true,
    service: "nexora_institutional_execution_preflight",
    paperOnlyDefault: true,
    allowed,
    action: allowed ? "PAPER_EXECUTION_ALLOWED" : "BLOCKED_MONITOR_ONLY",
    emergency,
    loss,
    duplicate,
    promotion,
    blockedReasons,
    updatedAt: new Date().toISOString(),
  };
}
