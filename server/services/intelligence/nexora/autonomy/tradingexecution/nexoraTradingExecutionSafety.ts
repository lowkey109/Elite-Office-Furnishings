import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

const INTENT_LOG = nexoraLocalPath("trading-execution", "intents", "order-intent-log.jsonl");
const FILL_LOG = nexoraLocalPath("trading-execution", "fills", "simulated-fill-log.jsonl");
const RECON_LOG = nexoraLocalPath("trading-execution", "reconciliation", "reconciliation-log.jsonl");
const KILL_FILE = nexoraLocalPath("trading-execution", "kill-switch", "kill-switch.json");
const LIMITS_FILE = nexoraLocalPath("trading-execution", "limits", "execution-limits.json");
const JOURNAL = nexoraLocalPath("trading-execution", "journal", "trading-execution-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

export function setNexoraTradingKillSwitch(input: any = {}) {
  const killSwitch = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_kill_switch",
    enabled: Boolean(input.enabled),
    reason: String(input.reason || (input.enabled ? "Operator enabled kill switch." : "Operator disabled kill switch.")),
    updatedAt: now(),
    updatedBy: String(input.updatedBy || "operator"),
    safety: {
      liveTradingBlocked: true,
      privateKeysBlocked: true,
      paperOnly: true,
    },
  };

  writeNexoraJson(KILL_FILE, killSwitch);
  journal("kill_switch.updated", killSwitch);

  return { ok: true, nexoraBrain: true, killSwitch };
}

export function getNexoraTradingKillSwitch() {
  const existing = readNexoraJson(KILL_FILE, null);
  if (existing) return { ok: true, nexoraBrain: true, killSwitch: existing };

  return setNexoraTradingKillSwitch({
    enabled: false,
    reason: "Default paper-only kill switch state.",
  });
}

export function setNexoraTradingExecutionLimits(input: any = {}) {
  const limits = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_execution_limits",
    updatedAt: now(),
    bankrollUsd: Number(input.bankrollUsd || 1000),
    maxOrderUsd: Number(input.maxOrderUsd || 25),
    maxExposureUsd: Number(input.maxExposureUsd || 100),
    maxDailyLossUsd: Number(input.maxDailyLossUsd || 50),
    maxOpenOrders: Number(input.maxOpenOrders || 10),
    maxSlippageBps: Number(input.maxSlippageBps || 100),
    requireSwarmConsensus: input.requireSwarmConsensus !== false,
    requireRiskGovernor: true,
    liveTradingBlocked: true,
    privateKeysBlocked: true,
  };

  writeNexoraJson(LIMITS_FILE, limits);
  journal("execution_limits.updated", limits);

  return { ok: true, nexoraBrain: true, limits };
}

export function getNexoraTradingExecutionLimits() {
  const existing = readNexoraJson(LIMITS_FILE, null);
  if (existing) return { ok: true, nexoraBrain: true, limits: existing };
  return setNexoraTradingExecutionLimits({});
}

function currentOpenExposure() {
  const fills = readNexoraJsonl(FILL_LOG)
    .filter((row: any) => row.event === "simulated_fill.created")
    .map((row: any) => row.fill);

  const settlements = readNexoraJsonl(RECON_LOG)
    .filter((row: any) => row.event === "reconciliation.settled")
    .map((row: any) => row.settlement);

  const settledIntentIds = new Set(settlements.map((row: any) => row.intentId));

  const open = fills.filter((fill: any) => !settledIntentIds.has(fill.intentId));
  const exposure = open.reduce((sum: number, fill: any) => sum + Number(fill.sizeUsd || 0), 0);

  return {
    openCount: open.length,
    exposureUsd: round(exposure, 2),
    open,
  };
}

function dailyPnl() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const settlements = readNexoraJsonl(RECON_LOG)
    .filter((row: any) => row.event === "reconciliation.settled")
    .map((row: any) => row.settlement)
    .filter((row: any) => new Date(row.settledAt).getTime() >= start.getTime());

  return round(settlements.reduce((sum: number, row: any) => sum + Number(row.pnl || 0), 0), 2);
}

export function createNexoraPaperOrderIntent(input: any = {}) {
  const kill = getNexoraTradingKillSwitch().killSwitch;
  const limits = getNexoraTradingExecutionLimits().limits;
  const policy = evaluateNexoraPolicy({
    ...input,
    liveTrading: false,
    tradingMode: "paper/sandbox",
  });

  const sizeUsd = Number(input.sizeUsd || input.stake || 0);
  const side = String(input.side || "HOLD");
  const price = clamp(Number(input.price || 0.5), 0.01, 0.99);
  const marketId = String(input.marketId || "paper_market");
  const asset = String(input.asset || "BTC").toUpperCase();

  const open = currentOpenExposure();
  const todayPnl = dailyPnl();

  const violations = [
    kill.enabled ? "kill_switch_enabled" : null,
    policy.approvalRequired ? "policy_approval_required" : null,
    sizeUsd <= 0 ? "invalid_size" : null,
    sizeUsd > limits.maxOrderUsd ? "max_order_exceeded" : null,
    open.exposureUsd + sizeUsd > limits.maxExposureUsd ? "max_exposure_exceeded" : null,
    open.openCount >= limits.maxOpenOrders ? "max_open_orders_exceeded" : null,
    todayPnl <= -Math.abs(limits.maxDailyLossUsd) ? "max_daily_loss_reached" : null,
    input.liveTrading === true ? "live_trading_blocked" : null,
    input.privateKey || input.walletKey ? "private_key_blocked" : null,
  ].filter(Boolean);

  const intent = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_order_intent",
    intentId: String(input.intentId || nexoraLocalId("order_intent")),
    createdAt: now(),
    mode: "paper_only",
    marketId,
    asset,
    side,
    price,
    sizeUsd,
    status: violations.length ? "blocked" : "approved_for_simulated_fill",
    violations,
    policy,
    limits,
    openExposure: open.exposureUsd,
    openOrders: open.openCount,
    dailyPnl: todayPnl,
    payload: input.payload || {},
    safety: {
      noLiveOrder: true,
      noCLOBExecution: true,
      noPrivateKeys: true,
      noWalletSigning: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("trading-execution", "intents", `${intent.intentId}.json`), intent);
  appendNexoraJsonl(INTENT_LOG, { event: "order_intent.created", intent, createdAt: now() });
  journal("order_intent.created", intent);

  recordNexoraMetric({
    name: "paper_order_intent",
    value: violations.length ? 0 : 1,
    unit: "intent",
    dimensions: { asset, side, status: intent.status },
  });

  return { ok: true, nexoraBrain: true, intent };
}

export function simulateNexoraPaperFill(input: any = {}) {
  const intent = input.intent || createNexoraPaperOrderIntent(input).intent;

  if (intent.status !== "approved_for_simulated_fill") {
    const blocked = {
      ok: false,
      nexoraBrain: true,
      service: "nexora_simulated_fill",
      blocked: true,
      reason: "Order intent was not approved for simulated fill.",
      intent,
    };

    appendNexoraJsonl(FILL_LOG, { event: "simulated_fill.blocked", blocked, createdAt: now() });
    journal("simulated_fill.blocked", blocked);

    return blocked;
  }

  const limits = getNexoraTradingExecutionLimits().limits;
  const requestedPrice = Number(intent.price || 0.5);
  const simulatedSlippageBps = Number(input.slippageBps ?? Math.min(limits.maxSlippageBps, 25));
  const fillPrice = clamp(
    requestedPrice + simulatedSlippageBps / 10000,
    0.01,
    0.99,
  );

  const fill = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_simulated_paper_fill",
    fillId: String(input.fillId || nexoraLocalId("paper_fill")),
    intentId: intent.intentId,
    marketId: intent.marketId,
    asset: intent.asset,
    side: intent.side,
    requestedPrice,
    fillPrice: round(fillPrice, 6),
    sizeUsd: Number(intent.sizeUsd || 0),
    simulatedSlippageBps,
    status: "filled_paper",
    filledAt: now(),
    safety: {
      simulatedOnly: true,
      noLiveOrder: true,
      noPrivateKeys: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("trading-execution", "fills", `${fill.fillId}.json`), fill);
  appendNexoraJsonl(FILL_LOG, { event: "simulated_fill.created", fill, createdAt: now() });
  journal("simulated_fill.created", fill);

  recordNexoraTimelineEvent({
    type: "paper_fill",
    title: `Simulated paper fill ${fill.side}`,
    severity: "info",
    payload: { fillId: fill.fillId, intentId: intent.intentId, sizeUsd: fill.sizeUsd },
  });

  return { ok: true, nexoraBrain: true, fill };
}

export function reconcileNexoraPaperFill(input: any = {}) {
  const fillId = String(input.fillId || "");
  const outcome = String(input.outcome || "").toUpperCase();

  const fills = readNexoraJsonl(FILL_LOG)
    .filter((row: any) => row.event === "simulated_fill.created")
    .map((row: any) => row.fill);

  const fill = fills.find((row: any) => row.fillId === fillId || row.intentId === input.intentId);

  if (!fill) {
    return { ok: false, nexoraBrain: true, error: "Fill not found.", fillId, intentId: input.intentId };
  }

  const won =
    (fill.side === "BUY_YES_PAPER" && outcome === "YES") ||
    (fill.side === "BUY_NO_PAPER" && outcome === "NO");

  const cost = Number(fill.sizeUsd || 0);
  const payout = won ? cost / Math.max(0.01, Number(fill.fillPrice || 0.5)) : 0;
  const pnl = round(payout - cost, 2);

  const settlement = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_fill_reconciliation",
    settlementId: String(input.settlementId || nexoraLocalId("settlement")),
    intentId: fill.intentId,
    fillId: fill.fillId,
    marketId: fill.marketId,
    asset: fill.asset,
    side: fill.side,
    outcome,
    won,
    cost,
    payout: round(payout, 2),
    pnl,
    settledAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("trading-execution", "reconciliation", `${settlement.settlementId}.json`), settlement);
  appendNexoraJsonl(RECON_LOG, { event: "reconciliation.settled", settlement, createdAt: now() });
  journal("reconciliation.settled", settlement);

  recordNexoraMetric({
    name: "trading_execution_paper_pnl",
    value: pnl,
    unit: "usd",
    dimensions: { asset: fill.asset, side: fill.side, won },
  });

  return { ok: true, nexoraBrain: true, settlement };
}

export function getNexoraTradingExecutionReport(input: any = {}) {
  const limit = Number(input.limit || 100);

  const intents = readNexoraJsonl(INTENT_LOG)
    .filter((row: any) => row.event === "order_intent.created")
    .map((row: any) => row.intent)
    .slice(-limit)
    .reverse();

  const fills = readNexoraJsonl(FILL_LOG)
    .filter((row: any) => row.event === "simulated_fill.created")
    .map((row: any) => row.fill)
    .slice(-limit)
    .reverse();

  const settlements = readNexoraJsonl(RECON_LOG)
    .filter((row: any) => row.event === "reconciliation.settled")
    .map((row: any) => row.settlement)
    .slice(-limit)
    .reverse();

  const totalPnl = round(settlements.reduce((sum: number, row: any) => sum + Number(row.pnl || 0), 0), 2);
  const wins = settlements.filter((row: any) => row.won).length;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_execution_report",
    generatedAt: now(),
    counts: {
      intents: intents.length,
      fills: fills.length,
      settlements: settlements.length,
    },
    totalPnl,
    winRate: settlements.length ? round(wins / settlements.length, 4) : 0,
    openExposure: currentOpenExposure(),
    dailyPnl: dailyPnl(),
    killSwitch: getNexoraTradingKillSwitch().killSwitch,
    limits: getNexoraTradingExecutionLimits().limits,
    intents,
    fills,
    settlements,
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
      noPostgres: true,
    },
  };
}

export function getNexoraTradingExecutionStatus() {
  const report = getNexoraTradingExecutionReport({ limit: 25 });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_trading_execution_safety",
    generatedAt: now(),
    summary: {
      intents: report.counts.intents,
      fills: report.counts.fills,
      settlements: report.counts.settlements,
      totalPnl: report.totalPnl,
      winRate: report.winRate,
      openExposure: report.openExposure.exposureUsd,
    },
    killSwitch: report.killSwitch,
    limits: report.limits,
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
    },
  };
}
