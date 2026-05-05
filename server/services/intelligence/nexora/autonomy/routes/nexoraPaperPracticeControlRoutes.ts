import type { Express } from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "paper-practice");
const PID_FILE = path.join(ROOT, "paper-practice.pid");
const LOG_FILE = path.join(ROOT, "paper-practice.log");
const STATUS_FILE = path.join(ROOT, "status.json");
const RUNNER = path.join(process.cwd(), ".nexora-runs", "nexora-paper-practice-loop.sh");

function now() {
  return new Date().toISOString();
}

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function readStatus() {
  try {
    if (fs.existsSync(STATUS_FILE)) return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
  } catch {}
  return {
    ok: true,
    service: "nexora_paper_practice_loop",
    state: "not_running",
    loop: 0,
    note: "No local paper loop status file found."
  };
}

function readPid(): number | null {
  try {
    if (!fs.existsSync(PID_FILE)) return null;
    const pid = Number(fs.readFileSync(PID_FILE, "utf8").trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function isRunning(pid: number | null) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function safety() {
  return {
    mode: "paper_only",
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    bankTransfersEnabled: false
  };
}

export function registerNexoraPaperPracticeControlRoutes(app: Express): void {
  app.get("/api/nexora/paper-practice/control/status", (_req, res) => {
    ensureRoot();
    const pid = readPid();

    res.json({
      ok: true,
      service: "nexora_paper_practice_control_status",
      generatedAt: now(),
      running: isRunning(pid),
      pid,
      status: readStatus(),
      logFile: "data/nexora/local/paper-practice/paper-practice.log",
      safety: safety()
    });
  });

  app.post("/api/nexora/paper-practice/start", (_req, res) => {
    ensureRoot();

    const existingPid = readPid();
    if (isRunning(existingPid)) {
      return res.json({
        ok: true,
        service: "nexora_paper_practice_start",
        alreadyRunning: true,
        pid: existingPid,
        safety: safety()
      });
    }

    if (!fs.existsSync(RUNNER)) {
      return res.json({
        ok: false,
        service: "nexora_paper_practice_start",
        started: false,
        reason: "runner_missing_on_this_environment",
        runner: ".nexora-runs/nexora-paper-practice-loop.sh",
        note: "Production can show synced summaries even if the local paper runner is not present.",
        safety: safety()
      });
    }

    const out = fs.openSync(LOG_FILE, "a");
    const child = spawn("bash", [RUNNER], {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", out, out],
      env: {
        ...process.env,
        NEXORA_PAPER_INTERVAL: process.env.NEXORA_PAPER_INTERVAL || "60",
        NEXORA_PAPER_MAX_LOOPS: "0"
      }
    });

    child.unref();
    fs.writeFileSync(PID_FILE, String(child.pid));

    res.json({
      ok: true,
      service: "nexora_paper_practice_start",
      started: true,
      pid: child.pid,
      safety: safety()
    });
  });

  app.post("/api/nexora/paper-practice/stop", (_req, res) => {
    ensureRoot();

    const pid = readPid();
    if (!pid || !isRunning(pid)) {
      try { fs.rmSync(PID_FILE, { force: true }); } catch {}
      return res.json({
        ok: true,
        service: "nexora_paper_practice_stop",
        stopped: false,
        reason: "not_running",
        safety: safety()
      });
    }

    try {
      process.kill(pid, "SIGTERM");
      fs.rmSync(PID_FILE, { force: true });

      return res.json({
        ok: true,
        service: "nexora_paper_practice_stop",
        stopped: true,
        pid,
        safety: safety()
      });
    } catch (error: any) {
      return res.status(500).json({
        ok: false,
        error: String(error?.message || error),
        safety: safety()
      });
    }
  });
}
