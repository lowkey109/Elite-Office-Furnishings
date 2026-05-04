import type { Express } from "express";
import fs from "fs";
import path from "path";

type R = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "poly-mode");
const STATE = path.join(ROOT, "state.json");
const EVENTS = path.join(ROOT, "events.jsonl");

function now() {
  return new Date().toISOString();
}

function ensure() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function baseSafety() {
  return {
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    autonomousMoneyMovement: false,
    externalSignerRequiredForReal: true,
    humanApprovalRequiredForReal: true,
    postgresReplayRequiredNow: false,
  };
}

function defaultState(): R {
  return {
    ok: true,
    service: "nexora_poly_mode_state",
    createdAt: now(),
    updatedAt: now(),
    mode: "paper",
    label: "Paper Learning",
    realModeArmed: false,
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    lastSwitch: null,
    switchCount: 0,
    safety: baseSafety(),
  };
}

function readState(): R {
  ensure();
  try {
    if (fs.existsSync(STATE)) return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {}
  return defaultState();
}

function saveState(patch: R): R {
  ensure();
  const state = { ...readState(), ...patch, updatedAt: now(), safety: baseSafety() };
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  return state;
}

function log(type: string, payload: R) {
  ensure();
  fs.appendFileSync(EVENTS, JSON.stringify({ ts: now(), type, ...payload }) + "\n");
}

function normalizeMode(value: any): "paper" | "real" {
  const mode = String(value || "").toLowerCase().trim();
  if (mode === "real" || mode === "live" || mode === "supervised_real") return "real";
  return "paper";
}

function setMode(input: R = {}) {
  const requestedMode = normalizeMode(input.mode);
  const previous = readState();

  const humanApproved = input.humanApproved === true || input.ownerApproved === true;
  const externalSignerReady = input.externalSignerReady === true;
  const allowReal = requestedMode === "real" && humanApproved && externalSignerReady;

  const nextMode = requestedMode === "real" ? "real" : "paper";

  const state = saveState({
    mode: nextMode,
    label: nextMode === "real" ? "Supervised Real-Money Preparation" : "Paper Learning",
    realModeArmed: allowReal,
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    lastSwitch: {
      at: now(),
      requestedMode,
      previousMode: previous.mode,
      acceptedMode: nextMode,
      realModeArmed: allowReal,
      humanApproved,
      externalSignerReady,
      note: nextMode === "real"
        ? "Real mode selected for supervised preparation only. Execution remains blocked inside Nexora."
        : "Paper mode selected. All execution remains simulated."
    },
    switchCount: Number(previous.switchCount || 0) + 1,
  });

  log("mode_switched", state.lastSwitch || {});

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_mode_set",
    generatedAt: now(),
    requestedMode,
    activeMode: state.mode,
    realModeArmed: state.realModeArmed,
    liveExecutionNow: false,
    message: state.mode === "real"
      ? "REAL mode selected, but live execution remains blocked. Use external signer + human approval."
      : "PAPER mode selected. Nexora will learn in simulation.",
    state,
    safety: baseSafety(),
  };
}

function toggleMode(input: R = {}) {
  const current = readState();
  const next = current.mode === "paper" ? "real" : "paper";
  return setMode({ ...input, mode: next });
}

export function registerNexoraPolyModeSwitchRoutes(app: Express): void {
  app.get("/api/nexora/poly-mode/status", (_req, res) => {
    const state = readState();
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_mode_status",
      generatedAt: now(),
      activeMode: state.mode,
      realModeArmed: state.realModeArmed,
      liveExecutionNow: false,
      button: {
        label: state.mode === "paper" ? "Switch to Real Prep" : "Switch to Paper",
        current: state.mode,
        next: state.mode === "paper" ? "real" : "paper",
        endpoint: "/api/nexora/poly-mode/toggle",
      },
      state,
      safety: baseSafety(),
    });
  });

  app.post("/api/nexora/poly-mode/set", (req, res) => {
    res.json(setMode((req.body || {}) as R));
  });

  app.post("/api/nexora/poly-mode/toggle", (req, res) => {
    res.json(toggleMode((req.body || {}) as R));
  });

  app.get("/api/nexora/poly-mode/button", (_req, res) => {
    const state = readState();
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_mode_button",
      generatedAt: now(),
      component: {
        type: "mode_switch_button",
        currentMode: state.mode,
        label: state.mode === "paper" ? "Paper Mode: ON" : "Real Prep Mode: ON",
        nextActionLabel: state.mode === "paper" ? "Switch to Real Prep" : "Switch to Paper",
        setEndpoint: "/api/nexora/poly-mode/set",
        toggleEndpoint: "/api/nexora/poly-mode/toggle",
        realModeRequires: ["humanApproved:true", "externalSignerReady:true"],
      },
      safety: baseSafety(),
    });
  });
}
