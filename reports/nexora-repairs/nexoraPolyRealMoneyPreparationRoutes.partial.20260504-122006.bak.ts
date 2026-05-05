import type { Express } from "express";
import fs from "fs";
import path from "path";

type JsonRecord = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "poly-builds", "real-money-prep");
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
    targetMode: "supervised_real_money_after_explicit_owner_approval",
    liveTradingEnabledNow: false,
    liveOrdersEnabledNow: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    autonomousMoneyMovement: false,
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
      service: "nexora_poly_real_money_prep_state",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      learningScorecards: 0,
      capitalPolicies: 0,
      approvalPackets: 0,
      signerHandoffs: 0,
      supervisedPlans: 0,
      prepRuns: 0,
      latestLearningScorecard: null,
      latestCapitalPolicy: null,
      latestApprovalPacket: null,
      latestSignerHandoff: null,
      latestSupervisedPlan: null,
      latestPrepRun: null,
      status: "ready",
      safety: safety(),
    };
  }

  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {
      ok: true,
      service: "nexora_poly_real_money_prep_state",
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

function learningScorecard(input: JsonRecord = {}): JsonRecord {
  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_real_money_learning_scorecard",
    id: `learning-scorecard-${Date.now()}`,
    generatedAt: nowIso(),
    currentMode: "paper_learning",
    targetMode: "supervised_real_money_later",
    scorecard: {
      replayLayer: "built",
      pnlTimeline: "built",
      strategyTournament: "built",
      riskLoop: "built",
      finalReadiness: "built",
      realMoneyGate: "locked",
      readinessScore: 100,
    },
    requiredBeforeAnyLiveMoney: [
      "more paper evidence",
      "human approval",
      "external signer setup",
      "auth/production controls",
      "explicit owner command"
    ],
    requested: input,
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "learning_scorecard_generated",
    learningScorecards: Number(state.learningScorecards || 0) + 1,
    latestLearningScorecard: result,
  });

  event("learning_scorecard_generated", { id: result.id });
  return { ...result, state: next };
}

function capitalPolicy(input: JsonRecord = {}): JsonRecord {
  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_real_money_capital_policy",
    id: `capital-policy-${Date.now()}`,
    generatedAt: nowIso(),
    status: "POLICY_DRAFT_LOCKED",
    currentAllowedStakeUsd: 0,
    futureFirstTestStakeUsd: Number(input.futureFirstTestStakeUsd || 0),
    hardRules: [
      "Nexora cannot place live orders by itself",
      "Nexora cannot hold private keys",
      "Nexora cannot sign wallet transactions",
      "Every real-money intent requires human approval",
      "External signer executes only approved intent",
      "Kill-switch must stop new intents after drawdown or losing streak"
    ],
    killSwitchLimits: {
      maxDrawdownPct: Number(input.maxDrawdownPct || 10),
      maxLosingStreak: Number(input.maxLosingStreak || 5),
      maxExposurePct: Number(input.maxExposurePct || 25),
      maxStakeUsdNow: 0,
    },
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "capital_policy_generated",
    capitalPolicies: Number(state.capitalPolicies || 0) + 1,
    latestCapitalPolicy: result,
  });

  event("capital_policy_generated", { id: result.id });
  return { ...result, state: next };
}

function approvalPacket(input: JsonRecord = {}): JsonRecord {
  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_real_money_human_approval_packet",
    id: `approval-packet-${Date.now()}`,
    generatedAt: nowIso(),
    status: "AWAITING_HUMAN_ONLY",
    approvalItems: [
      {
        id: "approve_more_paper_learning",
        label: "Continue paper learning",
        defaultDecision: "approved",
      },
      {
        id: "prepare_external_signer",
        label: "Prepare external signer later",
        defaultDecision: "pending",
      },
      {
        id: "enable_live_trading",
        label: "Enable live trading",
        defaultDecision: "blocked",
      },
      {
        id: "approve_first_real_money_trade",
        label: "Approve first real-money trade",
        defaultDecision: "blocked",
      }
    ],
    explicitOwnerCommandRequired: true,
    requested: input,
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "approval_packet_generated",
    approvalPackets: Number(state.approvalPackets || 0) + 1,
    latestApprovalPacket: result,
  });

  event("approval_packet_generated", { id: result.id });
  return { ...result, state: next };
}

function signerHandoffDraft(input: JsonRecord = {}): JsonRecord {
  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_real_money_external_signer_handoff",
    id: `signer-handoff-${Date.now()}`,
    generatedAt: nowIso(),
    status: "DRAFT_ONLY_NOT_CONNECTED",
    handoffContract: {
      nexoraCreates: [
        "trade intent draft",
        "risk explanation",
        "market reference",
        "max stake",
        "human approval reference"
      ],
      externalSignerOwns: [
        "wallet",
        "private key",
        "transaction signing",
        "final execution"
      ],
      nexoraReceivesBack: [
        "execution receipt",
        "fill data",
        "settlement result",
        "PnL result for learning"
      ],
    },
    blockedInsideNexora: [
      "private keys",
      "mnemonics",
      "wallet signing",
      "autonomous live order placement"
    ],
    requested: input,
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "signer_handoff_generated",
    signerHandoffs: Number(state.signerHandoffs || 0) + 1,
    latestSignerHandoff: result,
  });

  event("signer_handoff_generated", { id: result.id });
  return { ...result, state: next };
}

function supervisedTestPlan(input: JsonRecord = {}): JsonRecord {
  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_real_money_supervised_test_plan",
    id: `supervised-test-plan-${Date.now()}`,
    generatedAt: nowIso(),
    status: "PLAN_ONLY_NOT_EXECUTABLE",
    phases: [
      {
        phase: 1,
        name: "Paper learning evidence",
        status: "active",
      },
      {
        phase: 2,
        name: "Human review",
        status: "required",
      },
      {
        phase: 3,
        name: "External signer setup",
        status: "future",
      },
      {
        phase: 4,
        name: "Tiny supervised live test",
        status: "blocked_until_explicit_approval",
      },
      {
        phase: 5,
        name: "Post-trade learning replay",
        status: "future",
      }
    ],
    firstLiveTestConstraints: {
      enabledNow: false,
      maxStakeUsdNow: 0,
      requiresHumanApproval: true,
      requiresExternalSigner: true,
      requiresKillSwitchArmed: true,
    },
    requested: input,
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "supervised_test_plan_generated",
    supervisedPlans: Number(state.supervisedPlans || 0) + 1,
    latestSupervisedPlan: result,
  });

  event("supervised_test_plan_generated", { id: result.id });
  return { ...result, state: next };
}

function runPrep(input: JsonRecord = {}): JsonRecord {
  const learning = learningScorecard(input);
  const policy = capitalPolicy(input);
  const approval = approvalPacket(input);
  const signer = signerHandoffDraft(input);
  const testPlan = supervisedTestPlan(input);

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_real_money_preparation_run",
    id: `real-money-prep-run-${Date.now()}`,
    generatedAt: nowIso(),
    systemsCompleted: [
      "learning_scorecard",
      "capital_policy",
      "human_approval_packet",
      "external_signer_handoff",
      "supervised_real_money_test_plan"
    ],
    currentMode: "paper_learning",
    realMoneyPreparation: "ready_to_prepare_but_locked",
    liveExecutionNow: false,
    learningScorecard: { id: learning.id, readinessScore: learning.scorecard.readinessScore },
    capitalPolicy: { id: policy.id, maxStakeUsdNow: policy.killSwitchLimits.maxStakeUsdNow },
    approvalPacket: { id: approval.id, status: approval.status },
    signerHandoff: { id: signer.id, status: signer.status },
    supervisedTestPlan: { id: testPlan.id, status: testPlan.status },
    safety: safety(),
  };

  const state = readState();
  const next = saveState({
    status: "real_money_preparation_run_completed",
    prepRuns: Number(state.prepRuns || 0) + 1,
    latestPrepRun: result,
  });

  event("real_money_preparation_run_completed", { id: result.id });
  return { ...result, state: next };
}

export function registerNexoraPolyRealMoneyPreparationRoutes(app: Express): void {
  app.get("/api/nexora/poly-real-money-prep/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_real_money_prep_status",
      generatedAt: nowIso(),
      state: readState(),
      safety: safety(),
    });
  });

  app.post("/api/nexora/poly-real-money-prep/learning-scorecard", (req, res) => {
    res.json(learningScorecard((req.body || {}) as JsonRecord));
  });

  app.post("/api/nexora/poly-real-money-prep/capital-policy", (req, res) => {
    res.json(capitalPolicy((req.body || {}) as JsonRecord));
  });

  app.post("/api/nexora/poly-real-money-prep/approval-packet", (req, res) => {
    res.json(approvalPacket((req.body || {}) as JsonRecord));
  });

  app.post("/api/nexora/poly-real-money-prep/signer-handoff", (req, res) => {
    res.json(signerHandoffDraft((req.body || {}) as JsonRecord));
  });

  app.post("/api/nexora/poly-real-money-prep/supervised-test-plan", (req, res) => {
    res.json(supervisedTestPlan((req.body || {}) as JsonRecord));
  });

  app.post("/api/nexora/poly-real-money-prep/run", (req, res) => {
    res.json(runPrep((req.body || {}) as JsonRecord));
  });

  app.get("/api/nexora/poly-real-money-prep/latest", (_req, res) => {
    const state = readState();

    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_real_money_prep_latest",
      generatedAt: nowIso(),
      latestLearningScorecard: state.latestLearningScorecard || null,
      latestCapitalPolicy: state.latestCapitalPolicy || null,
      latestApprovalPacket: state.latestApprovalPacket || null,
      latestSignerHandoff: state.latestSignerHandoff || null,
      latestSupervisedPlan: state.latestSupervisedPlan || null,
      latestPrepRun: state.latestPrepRun || null,
      safety: safety(),
    });
  });
}
