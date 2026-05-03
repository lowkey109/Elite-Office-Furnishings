import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { runNexoraInstitutionalExecutionPreflight, writeNexoraExecutionAudit } from "./nexoraInstitutionalExecutionLayer";

export async function ensureNexoraExecutionQueue() {
  await db.execute(sql`
    create table if not exists nexora_execution_queue (
      id text primary key,
      mode text not null default 'paper',
      status text not null default 'queued',
      market_id text,
      direction text,
      limit_price numeric,
      amount_usd numeric,
      adapter text,
      payload jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    create index if not exists nexora_execution_queue_status_idx
    on nexora_execution_queue(status, created_at desc);
  `);

  return true;
}

export function getNexoraExchangeAdapterStatus() {
  return {
    ok: true,
    service: "nexora_exchange_adapter_status",
    liveTradingAvailable: false,
    connectedAdapters: [],
    paperAdapters: ["prediction_market_paper"],
    reason: "No real broker/exchange/bank adapter is connected. Real-money execution is physically unavailable.",
    updatedAt: new Date().toISOString(),
  };
}

export function checkNexoraBalance(input: any = {}) {
  const mode = String(input.mode || "paper");
  const paperBalanceUsd = Number(input.paperBalanceUsd || input.bankrollUsd || 1000);
  const requestedUsd = Number(input.requestedUsd || input.amountUsd || 0);

  const liveAvailable = false;
  const balanceUsd = mode === "live" ? 0 : paperBalanceUsd;

  return {
    ok: true,
    service: "nexora_balance_check",
    mode,
    liveAvailable,
    balanceUsd,
    requestedUsd,
    sufficientBalance: requestedUsd <= balanceUsd && requestedUsd > 0,
    tradeAllowed: mode !== "live" && requestedUsd <= balanceUsd && requestedUsd > 0,
    reason: mode === "live"
      ? "Live balance unavailable because no exchange/bank adapter exists."
      : requestedUsd <= balanceUsd && requestedUsd > 0
      ? "Paper balance sufficient."
      : "Insufficient or invalid paper balance.",
    updatedAt: new Date().toISOString(),
  };
}

export function checkNexoraComplianceGeofence(input: any = {}) {
  const country = String(input.country || input.userCountry || "unknown").toUpperCase();
  const marketType = String(input.marketType || "prediction_market");

  const blockedCountries = ["US", "KP", "IR", "SY", "CU", "RU"];
  const blocked = blockedCountries.includes(country);

  return {
    ok: true,
    service: "nexora_compliance_geofence",
    paperOnlyDefault: true,
    country,
    marketType,
    allowed: !blocked,
    blocked,
    reason: blocked
      ? "Jurisdiction blocked for safety/compliance review."
      : "No geofence block detected for paper mode.",
    rule: "Nexora must block restricted jurisdictions before any future live execution.",
    updatedAt: new Date().toISOString(),
  };
}

export async function queueNexoraPaperExecution(input: any = {}) {
  await ensureNexoraExecutionQueue();

  const id = String(input.id || `${input.marketId || "market"}|${input.direction || "NO_TRADE"}|${Date.now()}`);
  const mode = String(input.mode || "paper");

  const adapter = getNexoraExchangeAdapterStatus();
  const balance = checkNexoraBalance({
    mode,
    paperBalanceUsd: input.paperBalanceUsd || input.bankrollUsd || 1000,
    requestedUsd: input.amountUsd || input.positionUsd || 0,
  });
  const compliance = checkNexoraComplianceGeofence(input);
  const preflight = await runNexoraInstitutionalExecutionPreflight({
    ...input,
    mode,
    marketId: input.marketId,
    direction: input.direction,
    limitPrice: input.limitPrice,
    bankrollUsd: input.bankrollUsd || 1000,
    openRiskUsd: input.openRiskUsd || 0,
    dailyPnl: input.dailyPnl || 0,
  });

  const allowed =
    mode === "paper" &&
    adapter.liveTradingAvailable === false &&
    balance.tradeAllowed &&
    compliance.allowed &&
    preflight.allowed;

  const status = allowed ? "queued_paper" : "blocked";

  await db.execute(sql`
    insert into nexora_execution_queue (
      id, mode, status, market_id, direction, limit_price, amount_usd, adapter, payload, updated_at
    ) values (
      ${id},
      ${mode},
      ${status},
      ${String(input.marketId || "")},
      ${String(input.direction || "NO_TRADE")},
      ${String(input.limitPrice || 0)},
      ${String(input.amountUsd || input.positionUsd || 0)},
      ${"prediction_market_paper"},
      ${JSON.stringify({ input, adapter, balance, compliance, preflight })}::jsonb,
      now()
    )
    on conflict (id) do update set
      status = excluded.status,
      payload = excluded.payload,
      updated_at = now();
  `);

  await writeNexoraExecutionAudit("paper_execution_queue_attempt", {
    id,
    allowed,
    status,
    input,
    balance,
    compliance,
    preflight,
  }, allowed ? "info" : "warning", mode);

  return {
    ok: true,
    service: "nexora_paper_execution_queue",
    paperOnly: true,
    id,
    allowed,
    status,
    adapter,
    balance,
    compliance,
    preflight,
    reason: allowed ? "Paper execution queued." : "Execution blocked by safety layer.",
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraExecutionQueue(limit = 100) {
  await ensureNexoraExecutionQueue();

  const rows: any = await db.execute(sql`
    select *
    from nexora_execution_queue
    order by created_at desc
    limit ${Number(limit) || 100};
  `);

  return {
    ok: true,
    service: "nexora_execution_queue",
    paperOnly: true,
    rows: rows.rows || [],
    updatedAt: new Date().toISOString(),
  };
}
