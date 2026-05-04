import type { Express } from "express";
import fs from "fs";
import path from "path";

type R = Record<string, any>;
const ROOT = path.join(process.cwd(), "data", "nexora", "local", "poly-builds", "real-money-prep");
const STATE = path.join(ROOT, "state.json");
const EVENTS = path.join(ROOT, "events.jsonl");

function now() { return new Date().toISOString(); }
function ensure() { fs.mkdirSync(ROOT, { recursive: true }); }

function safety(): R {
  return {
    currentMode: "paper_learning",
    targetMode: "supervised_real_money_after_owner_approval",
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

function readState(): R {
  ensure();
  try {
    if (fs.existsSync(STATE)) return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {}
  return {
    ok: true,
    service: "nexora_poly_real_money_prep_state",
    createdAt: now(),
    updatedAt: now(),
    runs: 0,
    latest: null,
    status: "ready",
    safety: safety(),
  };
}

function save(patch: R): R {
  const state = { ...readState(), ...patch, updatedAt: now(), safety: safety() };
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  return state;
}

function log(type: string, payload: R) {
  ensure();
  fs.appendFileSync(EVENTS, JSON.stringify({ ts: now(), type, ...payload }) + "\n");
}

function prep(input: R = {}): R {
  const id = `real-money-prep-${Date.now()}`;

  const systems = {
    learningScorecard: {
      status: "ready",
      readinessScore: 100,
      evidence: [
        "paper replay and PnL timeline",
        "strategy tournament",
        "risk and kill-switch loop",
        "final readiness gate",
      ],
    },
    capitalPolicy: {
      status: "locked",
      maxStakeUsdNow: 0,
      futureFirstTestStakeUsd: Number(input.futureFirstTestStakeUsd || 0),
      killSwitch: {
        maxDrawdownPct: Number(input.maxDrawdownPct || 10),
        maxLosingStreak: Number(input.maxLosingStreak || 5),
        maxExposurePct: Number(input.maxExposurePct || 25),
      },
    },
    humanApprovalPacket: {
      status: "required",
      requiredFor: [
        "enable live trading",
        "connect external signer",
        "approve every real-money trade intent",
        "raise stake limits",
      ],
    },
    externalSignerHandoff: {
      status: "draft_only_not_connected",
      nexoraCreates: ["unsigned trade intent", "risk explanation", "max stake", "human approval reference"],
      signerOwns: ["wallet", "private key", "transaction signing", "execution receipt"],
    },
    supervisedTestPlan: {
      status: "planned_locked",
      phases: [
        "continue paper learning",
        "human review",
        "external signer preparation",
        "tiny supervised live test only after explicit approval",
        "post-trade learning replay",
      ],
    },
    liveExecutionGate: {
      status: "locked",
      canPrepareRealMoney: true,
      canExecuteLiveNow: false,
      unlockRequires: [
        "explicit owner command",
        "external signer connected",
        "human approval UI",
        "kill-switch armed",
        "auth/production controls",
      ],
    },
  };

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_real_money_preparation_pack",
    id,
    generatedAt: now(),
    systemsCompleted: [
      "learning_scorecard",
      "capital_policy",
      "human_approval_packet",
      "external_signer_handoff",
      "supervised_test_plan",
      "live_execution_gate",
    ],
    currentMode: "paper_learning",
    targetMode: "supervised_real_money_after_owner_approval",
    liveExecutionNow: false,
    systems,
    requested: input,
    safety: safety(),
  };

  const previous = readState();
  const state = save({
    status: "real_money_preparation_pack_completed",
    runs: Number(previous.runs || 0) + 1,
    latest: result,
  });

  log("real_money_preparation_pack_completed", { id });
  return { ...result, state };
}

export function registerNexoraPolyRealMoneyPreparationRoutes(app: Express): void {
  app.get("/api/nexora/poly-real-money-prep/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_real_money_prep_status",
      generatedAt: now(),
      state: readState(),
      safety: safety(),
    });
  });

  app.post("/api/nexora/poly-real-money-prep/run", (req, res) => {
    res.json(prep((req.body || {}) as R));
  });

  app.get("/api/nexora/poly-real-money-prep/latest", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_real_money_prep_latest",
      generatedAt: now(),
      latest: readState().latest || null,
      safety: safety(),
    });
  });
}
