import type { Express } from "express";
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "paper-practice");
const STATUS = path.join(ROOT, "status.json");
const LOG = path.join(ROOT, "paper-practice.log");
const PID = path.join(ROOT, "paper-practice.pid");

function now() {
  return new Date().toISOString();
}

function ensure() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safety() {
  return {
    mode: "paper_practice_supervisor",
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    autonomousMoneyMovement: false,
    humanApprovalRequiredForReal: true,
    externalSignerRequiredForReal: true,
  };
}

function readJson(file: string, fallback: any) {
  ensure();
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  return fallback;
}

function tailFile(file: string, lines = 80) {
  ensure();
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

function pidStatus() {
  try {
    if (!fs.existsSync(PID)) return { running: false, pid: null };
    const pid = fs.readFileSync(PID, "utf8").trim();
    return { running: Boolean(pid), pid };
  } catch {
    return { running: false, pid: null };
  }
}

function listRuns() {
  ensure();
  const anonRoot = path.join(process.cwd(), "data", "nexora", "local", "anon-paper-trader");
  try {
    if (!fs.existsSync(anonRoot)) return [];
    return fs.readdirSync(anonRoot)
      .filter((name) => name.startsWith("anon-paper-"))
      .sort()
      .slice(-25)
      .reverse()
      .map((name) => ({
        id: name,
        path: path.join("data/nexora/local/anon-paper-trader", name),
      }));
  } catch {
    return [];
  }
}

export function registerNexoraPaperPracticeSupervisorRoutes(app: Express): void {
  app.get("/api/nexora/paper-practice/status", (_req, res) => {
    const status = readJson(STATUS, {
      ok: true,
      service: "nexora_paper_practice_loop",
      state: "not_started",
      loop: 0,
      note: "Run .nexora-runs/nexora-paper-practice-loop.sh to start practice.",
    });

    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_paper_practice_supervisor_status",
      generatedAt: now(),
      pid: pidStatus(),
      status,
      safety: safety(),
    });
  });

  app.get("/api/nexora/paper-practice/log", (req, res) => {
    const limit = Math.max(10, Math.min(300, Number(req.query.limit || 80)));

    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_paper_practice_supervisor_log",
      generatedAt: now(),
      lines: tailFile(LOG, limit),
      safety: safety(),
    });
  });

  app.get("/api/nexora/paper-practice/runs", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_paper_practice_runs",
      generatedAt: now(),
      runs: listRuns(),
      safety: safety(),
    });
  });

  app.get("/api/nexora/paper-practice/commands", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_paper_practice_commands",
      generatedAt: now(),
      commands: {
        start: ".nexora-runs/nexora-paper-practice-loop.sh",
        watch: "tail -f data/nexora/local/paper-practice/paper-practice.log",
        stop: "kill $(cat data/nexora/local/paper-practice/paper-practice.pid)",
        oneShot: "NEXORA_PAPER_MAX_LOOPS=1 .nexora-runs/nexora-paper-practice-loop.sh",
      },
      safety: safety(),
    });
  });
}
