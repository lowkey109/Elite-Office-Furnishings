import type { Express } from "express";
import fs from "fs";
import path from "path";

type R = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "poly-operator");
const STATE = path.join(ROOT, "state.json");
const EVENTS = path.join(ROOT, "events.jsonl");

function now() {
  return new Date().toISOString();
}

function ensure() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safety() {
  return {
    currentMode: "paper_learning",
    targetMode: "supervised_real_money_after_owner_approval",
    liveTradingEnabledNow: false,
    liveOrdersEnabledNow: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    autonomousMoneyMovement: false,
    humanApprovalRequired: true,
    externalSignerRequired: true,
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
    service: "nexora_poly_production_operator_state",
    createdAt: now(),
    updatedAt: now(),
    runs: 0,
    tradeIntentReviews: 0,
    signerReviews: 0,
    latest: null,
    latestTradeIntentReview: null,
    latestSignerReview: null,
    status: "ready",
    safety: safety(),
  };
}

function save(patch: R): R {
  const next = {
    ...readState(),
    ...patch,
    updatedAt: now(),
    safety: safety(),
  };
  fs.writeFileSync(STATE, JSON.stringify(next, null, 2));
  return next;
}

function log(type: string, payload: R) {
  ensure();
  fs.appendFileSync(EVENTS, JSON.stringify({ ts: now(), type, ...payload }) + "\n");
}

function commandCenter(input: R = {}) {
  const id = `operator-command-${Date.now()}`;

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_production_operator_command_center",
    id,
    generatedAt: now(),
    title: "Phantom X / Polymarket Operator Command Center",
    currentMode: "paper_learning",
    targetMode: "supervised_real_money_after_owner_approval",
    systems: [
      {
        id: "learning_suite",
        label: "Learning Suite",
        status: "built",
        routes: [
          "/api/nexora/poly-builds/bash1/status",
          "/api/nexora/poly-builds/bash1/replay/latest",
          "/api/nexora/poly-builds/bash1/tournament/latest"
        ],
      },
      {
        id: "risk_loop",
        label: "Risk / Kill Switch Loop",
        status: "built",
        routes: [
          "/api/nexora/poly-builds/bash2/status",
          "/api/nexora/poly-builds/bash2/risk/latest",
          "/api/nexora/poly-builds/bash2/loop/latest"
        ],
      },
      {
        id: "final_readiness",
        label: "Final Readiness",
        status: "built",
        routes: [
          "/api/nexora/poly-builds/final/status",
          "/api/nexora/poly-builds/final/latest"
        ],
      },
      {
        id: "real_money_gate",
        label: "Real-Money Gate",
        status: "locked_until_owner_approval",
        routes: [
          "/api/nexora/live-money/status",
          "/api/nexora/live-execution-design/status"
        ],
      },
      {
        id: "operator_review",
        label: "Operator Review",
        status: "built",
        routes: [
          "/api/nexora/poly-operator/production/status",
          "/api/nexora/poly-operator/production/run",
          "/api/nexora/poly-operator/production/trade-intent-review",
          "/api/nexora/poly-operator/production/signer-review"
        ],
      },
    ],
    decision: {
      readyForMorePaperLearning: true,
      readyForRealMoneyPreparation: true,
      readyForLiveExecutionNow: false,
      reason: "Live execution is locked until explicit owner approval and external signer connection.",
    },
    requested: input,
    safety: safety(),
  };

  const state = readState();
  const next = save({
    status: "operator_command_center_generated",
    runs: Number(state.runs || 0) + 1,
    latest: result,
  });

  log("operator_command_center_generated", { id });
  return { ...result, state: next };
}

function tradeIntentReview(input: R = {}) {
  const id = `trade-intent-review-${Date.now()}`;

  const review = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_operator_trade_intent_review",
    id,
    generatedAt: now(),
    status: "REVIEW_ONLY_NOT_EXECUTABLE",
    tradeIntent: {
      market: input.market || "example_polymarket_market",
      side: input.side || "YES",
      maxStakeUsdRequested: Number(input.maxStakeUsd || 0),
      maxStakeUsdAllowedNow: 0,
      executableByNexora: false,
      requiresHumanApproval: true,
      requiresExternalSigner: true,
    },
    reviewChecklist: [
      "paper learning evidence reviewed",
      "risk report reviewed",
      "kill-switch status reviewed",
      "market reason reviewed",
      "human approval required",
      "external signer required"
    ],
    decision: "blocked_for_live_execution",
    safety: safety(),
  };

  const state = readState();
  const next = save({
    status: "trade_intent_review_generated",
    tradeIntentReviews: Number(state.tradeIntentReviews || 0) + 1,
    latestTradeIntentReview: review,
  });

  log("trade_intent_review_generated", { id });
  return { ...review, state: next };
}

function signerReview(input: R = {}) {
  const id = `signer-review-${Date.now()}`;

  const review = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_operator_signer_review",
    id,
    generatedAt: now(),
    status: "SIGNER_NOT_CONNECTED_DESIGN_ONLY",
    handoff: {
      nexoraCreates: [
        "unsigned trade intent",
        "risk explanation",
        "approval reference",
        "max stake"
      ],
      externalSignerOwns: [
        "wallet",
        "private key",
        "transaction signing",
        "execution receipt"
      ],
      nexoraReceives: [
        "execution receipt",
        "fill data",
        "settlement result",
        "learning result"
      ],
    },
    blockedInsideNexora: [
      "private key storage",
      "wallet signing",
      "autonomous live orders",
      "autonomous money movement"
    ],
    requested: input,
    safety: safety(),
  };

  const state = readState();
  const next = save({
    status: "signer_review_generated",
    signerReviews: Number(state.signerReviews || 0) + 1,
    latestSignerReview: review,
  });

  log("signer_review_generated", { id });
  return { ...review, state: next };
}

export function registerNexoraPolyProductionOperatorRoutes(app: Express): void {
  app.get("/api/nexora/poly-operator/production/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_production_operator_status",
      generatedAt: now(),
      state: readState(),
      safety: safety(),
    });
  });

  app.post("/api/nexora/poly-operator/production/run", (req, res) => {
    res.json(commandCenter((req.body || {}) as R));
  });

  app.post("/api/nexora/poly-operator/production/trade-intent-review", (req, res) => {
    res.json(tradeIntentReview((req.body || {}) as R));
  });

  app.post("/api/nexora/poly-operator/production/signer-review", (req, res) => {
    res.json(signerReview((req.body || {}) as R));
  });

  app.get("/api/nexora/poly-operator/production/latest", (_req, res) => {
    const state = readState();
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_production_operator_latest",
      generatedAt: now(),
      latest: state.latest || null,
      latestTradeIntentReview: state.latestTradeIntentReview || null,
      latestSignerReview: state.latestSignerReview || null,
      safety: safety(),
    });
  });
}
