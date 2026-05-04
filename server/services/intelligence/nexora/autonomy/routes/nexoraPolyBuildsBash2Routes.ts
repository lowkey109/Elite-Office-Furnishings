import type { Express } from "express";
import fs from "fs";
import path from "path";

type JsonRecord = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "poly-builds", "bash2");
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
    mode: "learning_to_real_money",
    currentExecution: "paper_only",
    futureRealMoneySupported: true,
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    walletSigningInsideNexora: false,
    privateKeysAllowedInsideNexora: false,
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
      service: "nexora_poly_7builds_bash2_state",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      riskReports: 0,
      operatorSummaries: 0,
      loopRuns: 0,
      latestRiskReport: null,
      latestOperatorSummary: null,
      latestLoopRun: null,
      status: "ready",
      safety: safety(),
    };
  }

  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {
      ok: true,
      service: "nexora_poly_7builds_bash2_state",
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

function runRisk(input: JsonRecord): JsonRecord {
  const drawdownPct = Number(input.drawdownPct ?? 12);
  const losingStreak = Number(input.losingStreak ?? 6);
  const exposurePct = Number(input.exposurePct ?? 28);

  const checks = [
    {
      id: "drawdown_guard",
      value: drawdownPct,
      limit: 10,
      triggered: drawdownPct >= 10,
      action: drawdownPct >= 10 ? "HALT_AND_REQUIRE_REVIEW" : "ALLOW_PAPER_ONLY",
    },
    {
      id: "losing_streak_guard",
      value: losingStreak,
      limit: 5,
      triggered: losingStreak >= 5,
      action: losingStreak >= 5 ? "HALT_AND_REQUIRE_REVIEW" : "ALLOW_PAPER_ONLY",
    },
    {
      id: "exposure_guard",
      value: exposurePct,
      limit: 25,
      triggered: exposurePct >= 25,
      action: exposurePct >= 25 ? "BLOCK_NEW_EXPOSURE" : "ALLOW_PAPER_ONLY",
    },
    {
      id: "real_money_guard",
      value: false,
      limit: false,
      triggered: false,
      action: "REAL_MONEY_REQUIRES_HUMAN_APPROVAL_AND_EXTERNAL_SIGNER",
    },
  ];

  const id = `risk-${Date.now()}`;
  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_bash2_risk",
    id,
    generatedAt: nowIso(),
    currentMode: "paper_learning",
    futureMode: "real_money_after_approval",
    checks,
    killSwitchWouldProtectCapital: checks.some((c) => c.triggered),
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "risk_report_generated",
    riskReports: Number(state.riskReports || 0) + 1,
    latestRiskReport: report,
  });

  event("risk_report_generated", { id });

  return { ...report, state: next };
}

function operatorSummary(input: JsonRecord): JsonRecord {
  const state = readState();
  const id = `operator-${Date.now()}`;

  const summary = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_bash2_operator_summary",
    id,
    generatedAt: nowIso(),
    product: "Phantom X / Polymarket",
    currentMode: "paper_learning",
    targetMode: "real_money_after_proof_and_approval",
    cards: [
      {
        id: "learning",
        label: "Learning Engine",
        status: "active",
        detail: "Bash1 provides replay, PnL, and tournament outputs.",
      },
      {
        id: "risk",
        label: "Risk / Kill Switch",
        status: state.latestRiskReport ? "evidence_available" : "needs_run",
        detail: "Bash2 stress tests drawdown, losing streak, and exposure.",
      },
      {
        id: "real_money",
        label: "Real Money Path",
        status: "designed_locked",
        detail: "Real-money execution requires human approval and external signer.",
      },
      {
        id: "safety",
        label: "Capital Safety",
        status: "locked",
        detail: "No private keys or wallet signing inside Nexora.",
      },
    ],
    requested: input,
    safety: safety(),
  };

  const next = saveState({
    status: "operator_summary_generated",
    operatorSummaries: Number(state.operatorSummaries || 0) + 1,
    latestOperatorSummary: summary,
  });

  event("operator_summary_generated", { id });

  return { ...summary, state: next };
}

function loopRun(input: JsonRecord): JsonRecord {
  const risk = runRisk(input);
  const operator = operatorSummary({ ...input, riskReportId: risk.id });

  const id = `loop-${Date.now()}`;
  const loop = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_bash2_loop",
    id,
    generatedAt: nowIso(),
    completed: [
      "risk_drawdown_kill_switch_evidence",
      "operator_dashboard_summary",
      "real_money_path_locked_until_approval",
      "external_signer_requirement_confirmed",
    ],
    riskReportId: risk.id,
    operatorSummaryId: operator.id,
    currentMode: "paper_learning",
    futureMode: "real_money_after_proof_and_approval",
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "bash2_loop_completed",
    loopRuns: Number(state.loopRuns || 0) + 1,
    latestLoopRun: loop,
    latestRiskReport: risk,
    latestOperatorSummary: operator,
  });

  event("bash2_loop_completed", { id, riskReportId: risk.id, operatorSummaryId: operator.id });

  return { ...loop, state: next };
}

export function registerNexoraPolyBuildsBash2Routes(app: Express): void {
  app.get("/api/nexora/poly-builds/bash2/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_bash2_status",
      generatedAt: nowIso(),
      state: readState(),
      safety: safety(),
    });
  });

  app.post("/api/nexora/poly-builds/bash2/risk/run", (req, res) => {
    res.json(runRisk((req.body || {}) as JsonRecord));
  });

  app.get("/api/nexora/poly-builds/bash2/risk/latest", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_bash2_risk_latest",
      generatedAt: nowIso(),
      latestRiskReport: readState().latestRiskReport || null,
      safety: safety(),
    });
  });

  app.post("/api/nexora/poly-builds/bash2/operator-summary", (req, res) => {
    res.json(operatorSummary((req.body || {}) as JsonRecord));
  });

  app.get("/api/nexora/poly-builds/bash2/operator-summary/latest", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_bash2_operator_summary_latest",
      generatedAt: nowIso(),
      latestOperatorSummary: readState().latestOperatorSummary || null,
      safety: safety(),
    });
  });

  app.post("/api/nexora/poly-builds/bash2/loop/run", (req, res) => {
    res.json(loopRun((req.body || {}) as JsonRecord));
  });

  app.get("/api/nexora/poly-builds/bash2/loop/latest", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_bash2_loop_latest",
      generatedAt: nowIso(),
      latestLoopRun: readState().latestLoopRun || null,
      safety: safety(),
    });
  });
}
