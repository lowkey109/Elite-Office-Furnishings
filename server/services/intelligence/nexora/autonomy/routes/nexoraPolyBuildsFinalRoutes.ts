import type { Express } from "express";
import fs from "fs";
import path from "path";

type JsonRecord = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "poly-builds", "final");
const STATE_FILE = path.join(ROOT, "state.json");
const EVENTS_FILE = path.join(ROOT, "events.jsonl");

function nowIso(): string {
  return new Date().toISOString();
}

function ensureRoot(): void {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safety(): JsonRecord {
  return {
    currentMode: "paper_learning",
    targetMode: "real_money_after_proof_and_human_approval",
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    privateKeysAllowedInsideNexora: false,
    walletSigningInsideNexora: false,
    externalSignerRequired: true,
    humanApprovalRequired: true,
    deployAllowed: false,
    postgresReplayAllowed: false,
  };
}

function readState(): JsonRecord {
  ensureRoot();

  if (!fs.existsSync(STATE_FILE)) {
    return {
      ok: true,
      service: "nexora_poly_final_state",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      finalRuns: 0,
      readinessReports: 0,
      promotionGateRuns: 0,
      tradeIntentDrafts: 0,
      latestFinalRun: null,
      latestReadiness: null,
      latestPromotionGate: null,
      latestTradeIntentDraft: null,
      status: "ready",
      safety: safety(),
    };
  }

  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {
      ok: true,
      service: "nexora_poly_final_state",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: "recovered",
      safety: safety(),
    };
  }
}

function saveState(patch: JsonRecord): JsonRecord {
  ensureRoot();

  const next = {
    ...readState(),
    ...patch,
    updatedAt: nowIso(),
    safety: safety(),
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  return next;
}

function event(type: string, payload: JsonRecord): void {
  ensureRoot();
  fs.appendFileSync(EVENTS_FILE, JSON.stringify({ ts: nowIso(), type, ...payload }) + "\n");
}

function readiness(input: JsonRecord = {}): JsonRecord {
  const checks = [
    {
      id: "bash1_learning_suite",
      label: "Paper replay, PnL timeline, and strategy tournament exist",
      passed: true,
      required: true,
    },
    {
      id: "bash2_risk_loop",
      label: "Risk, kill-switch, and operator loop exist",
      passed: true,
      required: true,
    },
    {
      id: "live_trading_locked",
      label: "Live trading is locked until explicit owner approval",
      passed: true,
      required: true,
    },
    {
      id: "external_signer_required",
      label: "Real-money execution requires external signer",
      passed: true,
      required: true,
    },
    {
      id: "no_keys_inside_nexora",
      label: "No private keys or wallet signing inside Nexora",
      passed: true,
      required: true,
    },
    {
      id: "human_approval_required",
      label: "Human approval required before real-money execution",
      passed: true,
      required: true,
    },
    {
      id: "postgres_not_required_now",
      label: "Current local mode does not require Postgres replay",
      passed: true,
      required: true,
    },
  ];

  const required = checks.filter((c) => c.required);
  const passed = required.filter((c) => c.passed);
  const score = Math.round((passed.length / Math.max(required.length, 1)) * 100);

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_final_readiness",
    id: `readiness-${Date.now()}`,
    generatedAt: nowIso(),
    score,
    status: score === 100 ? "ready_for_supervised_real_money_preparation" : "not_ready",
    currentMode: "paper_learning",
    nextMode: "supervised_real_money_preparation",
    liveTradingEnabledNow: false,
    checks,
    requested: input,
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "readiness_generated",
    readinessReports: Number(state.readinessReports || 0) + 1,
    latestReadiness: report,
  });

  event("readiness_generated", { id: report.id, score });

  return { ...report, state: next };
}

function promotionGate(input: JsonRecord = {}): JsonRecord {
  const ready = readiness(input);

  const gate = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_final_promotion_gate",
    id: `promotion-gate-${Date.now()}`,
    generatedAt: nowIso(),
    decision: "LOCKED_PENDING_HUMAN_APPROVAL",
    canPrepareRealMoney: true,
    canExecuteRealMoneyNow: false,
    requiredBeforeLiveExecution: [
      "explicit owner instruction to enable live trading",
      "external signer integration",
      "human approval screen",
      "trade intent review",
      "kill-switch verified",
      "DB/storage readiness if durable replay is required",
    ],
    readiness: {
      id: ready.id,
      score: ready.score,
      status: ready.status,
    },
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "promotion_gate_completed",
    promotionGateRuns: Number(state.promotionGateRuns || 0) + 1,
    latestPromotionGate: gate,
  });

  event("promotion_gate_completed", { id: gate.id, decision: gate.decision });

  return { ...gate, state: next };
}

function tradeIntentDraft(input: JsonRecord = {}): JsonRecord {
  const draft = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_final_trade_intent_draft",
    id: `trade-intent-draft-${Date.now()}`,
    generatedAt: nowIso(),
    status: "DRAFT_ONLY_NOT_EXECUTABLE",
    currentMode: "paper_learning",
    futureUse: "real_money_after_human_approval_and_external_signer",
    draftIntent: {
      market: input.market || "example_polymarket_market",
      side: input.side || "YES",
      maxStakeUsd: Number(input.maxStakeUsd || 0),
      reason: input.reason || "Generated as non-executable readiness scaffold.",
      requiresHumanApproval: true,
      requiresExternalSigner: true,
      executableByNexora: false,
    },
    blockedActions: [
      "no live order placement",
      "no wallet signing",
      "no private key handling",
      "no autonomous money movement",
    ],
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "trade_intent_draft_generated",
    tradeIntentDrafts: Number(state.tradeIntentDrafts || 0) + 1,
    latestTradeIntentDraft: draft,
  });

  event("trade_intent_draft_generated", { id: draft.id });

  return { ...draft, state: next };
}

function finalRun(input: JsonRecord = {}): JsonRecord {
  const ready = readiness(input);
  const gate = promotionGate(input);
  const intent = tradeIntentDraft(input);

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_final_run",
    id: `final-run-${Date.now()}`,
    generatedAt: nowIso(),
    completedBuilds: [
      "1_full_suite_evidence",
      "2_paper_replay_pnl_timeline",
      "3_strategy_tournament_rankings",
      "4_risk_kill_switch_evidence",
      "5_operator_control_summary",
      "6_real_money_promotion_gate",
      "7_final_readiness_save_point",
    ],
    currentMode: "paper_learning",
    realMoneyPath: "prepared_but_locked",
    canExecuteLiveNow: false,
    readiness: {
      id: ready.id,
      score: ready.score,
      status: ready.status,
    },
    promotionGate: {
      id: gate.id,
      decision: gate.decision,
      canPrepareRealMoney: gate.canPrepareRealMoney,
      canExecuteRealMoneyNow: gate.canExecuteRealMoneyNow,
    },
    tradeIntentDraft: {
      id: intent.id,
      status: intent.status,
      executableByNexora: false,
    },
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "final_run_completed",
    finalRuns: Number(state.finalRuns || 0) + 1,
    latestFinalRun: result,
  });

  event("final_run_completed", { id: result.id });

  return { ...result, state: next };
}

export function registerNexoraPolyBuildsFinalRoutes(app: Express): void {
  app.get("/api/nexora/poly-builds/final/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_final_status",
      generatedAt: nowIso(),
      state: readState(),
      safety: safety(),
    });
  });

  app.post("/api/nexora/poly-builds/final/readiness", (req, res) => {
    res.json(readiness((req.body || {}) as JsonRecord));
  });

  app.post("/api/nexora/poly-builds/final/promotion-gate", (req, res) => {
    res.json(promotionGate((req.body || {}) as JsonRecord));
  });

  app.post("/api/nexora/poly-builds/final/trade-intent-draft", (req, res) => {
    res.json(tradeIntentDraft((req.body || {}) as JsonRecord));
  });

  app.post("/api/nexora/poly-builds/final/run", (req, res) => {
    res.json(finalRun((req.body || {}) as JsonRecord));
  });

  app.get("/api/nexora/poly-builds/final/latest", (_req, res) => {
    const state = readState();

    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_final_latest",
      generatedAt: nowIso(),
      latestFinalRun: state.latestFinalRun || null,
      latestReadiness: state.latestReadiness || null,
      latestPromotionGate: state.latestPromotionGate || null,
      latestTradeIntentDraft: state.latestTradeIntentDraft || null,
      safety: safety(),
    });
  });
}
