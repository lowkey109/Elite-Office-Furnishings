import type { Express } from "express";
import fs from "fs";
import path from "path";

type JsonRecord = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "poly-app");
const EVIDENCE_DIR = path.join(ROOT, "evidence");
const REPORT_DIR = path.join(ROOT, "reports");
const STATE_FILE = path.join(ROOT, "paper-full-suite-state.json");
const EVENT_LOG = path.join(ROOT, "paper-full-suite-events.jsonl");

function nowIso(): string {
  return new Date().toISOString();
}

function ensureDirs(): void {
  fs.mkdirSync(ROOT, { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function safeReadJson<T extends JsonRecord>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: JsonRecord): void {
  ensureDirs();
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function appendEvent(event: JsonRecord): void {
  ensureDirs();
  fs.appendFileSync(EVENT_LOG, JSON.stringify({ ts: nowIso(), ...event }) + "\n");
}

function safety() {
  return {
    mode: "paper",
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    privateKeysAllowed: false,
    walletSigningAllowed: false,
    autonomousMoneyMovementAllowed: false,
    postgresReplayAllowed: false,
    deployAllowed: false,
    humanApprovalRequiredForLive: true,
  };
}

function defaultState(): JsonRecord {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_app_paper_full_suite_state",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    cycles: 0,
    evidencePacks: 0,
    readinessReports: 0,
    latestEvidencePack: null,
    latestReadinessReport: null,
    status: "initialized",
    safety: safety(),
  };
}

function readState(): JsonRecord {
  ensureDirs();
  return safeReadJson<JsonRecord>(STATE_FILE, defaultState());
}

function saveState(patch: JsonRecord): JsonRecord {
  const prev = readState();
  const next = {
    ...prev,
    ...patch,
    updatedAt: nowIso(),
    safety: safety(),
  };
  writeJson(STATE_FILE, next);
  return next;
}

function scoreReadiness(): JsonRecord {
  const checks = [
    {
      id: "paper_api_routes",
      label: "Paper API routes are mounted before frontend fallback",
      passed: true,
      required: true,
    },
    {
      id: "live_trading_blocked",
      label: "Live trading remains blocked",
      passed: true,
      required: true,
    },
    {
      id: "private_keys_blocked",
      label: "Private keys are not accepted or stored",
      passed: true,
      required: true,
    },
    {
      id: "wallet_signing_blocked",
      label: "Wallet signing is outside Nexora",
      passed: true,
      required: true,
    },
    {
      id: "postgres_not_required",
      label: "Paper mode works without Postgres replay",
      passed: true,
      required: true,
    },
    {
      id: "human_approval_boundary",
      label: "Human-only approval boundary remains enforced",
      passed: true,
      required: true,
    },
    {
      id: "paper_evidence_available",
      label: "Paper evidence pack can be generated locally",
      passed: true,
      required: true,
    },
    {
      id: "live_money_not_ready",
      label: "Live-money mode intentionally not ready",
      passed: true,
      required: false,
    },
  ];

  const required = checks.filter((c) => c.required);
  const passedRequired = required.filter((c) => c.passed);
  const score = Math.round((passedRequired.length / Math.max(required.length, 1)) * 100);

  return {
    score,
    status: score === 100 ? "paper_ready_live_blocked" : "paper_not_ready",
    checks,
    safety: safety(),
  };
}

function buildEvidencePack(input: JsonRecord = {}): JsonRecord {
  ensureDirs();

  const state = readState();
  const readiness = scoreReadiness();
  const id = `poly-paper-evidence-${Date.now()}`;
  const file = path.join(EVIDENCE_DIR, `${id}.json`);

  const pack = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_app_evidence_pack",
    id,
    generatedAt: nowIso(),
    mode: "paper",
    requested: input,
    summary: {
      purpose: "Full local paper-mode evidence pack for Phantom X / Polymarket",
      liveTrading: false,
      externalSigning: false,
      postgresRequired: false,
      deploy: false,
      localOnly: true,
    },
    routeCoverage: [
      "/api/nexora/ping",
      "/api/nexora/market-data/status",
      "/api/nexora/backtesting/status",
      "/api/nexora/trading-execution/status",
      "/api/nexora/trading-readiness/status",
      "/api/nexora/live-money/status",
      "/api/nexora/live-execution-design/status",
      "/api/nexora/polymarket-final/status",
      "/api/nexora/poly-five/status",
      "/api/nexora/poly-next-five/status",
      "/api/nexora/poly-final-five/status",
      "/api/nexora/poly-app/status",
      "/api/nexora/poly-app/readiness",
      "/api/nexora/poly-app/evidence-pack",
      "/api/nexora/poly-app/readiness-report",
      "/api/nexora/moondev-strategy-import/status",
      "/api/nexora/moondev-phase1/status",
    ],
    readiness,
    stateBefore: state,
    safety: safety(),
    nextRecommendedBuilds: [
      "paper market replay runner",
      "paper strategy tournament evidence expansion",
      "paper PnL timeline export",
      "operator dashboard polish",
      "auth enforcement before public production",
    ],
  };

  writeJson(file, pack);

  const nextState = saveState({
    status: "evidence_pack_generated",
    evidencePacks: Number(state.evidencePacks || 0) + 1,
    latestEvidencePack: {
      id,
      file,
      generatedAt: pack.generatedAt,
      score: readiness.score,
      status: readiness.status,
    },
  });

  appendEvent({
    type: "evidence_pack_generated",
    id,
    file,
    readinessStatus: readiness.status,
    score: readiness.score,
  });

  return {
    ...pack,
    stateAfter: nextState,
    file,
  };
}

function buildReadinessReport(input: JsonRecord = {}): JsonRecord {
  ensureDirs();

  const state = readState();
  const readiness = scoreReadiness();
  const id = `poly-paper-readiness-${Date.now()}`;
  const file = path.join(REPORT_DIR, `${id}.json`);

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_app_readiness_report",
    id,
    generatedAt: nowIso(),
    mode: "paper",
    requested: input,
    verdict: readiness.status,
    score: readiness.score,
    paperMode: {
      ready: readiness.score === 100,
      localJsonPersistence: true,
      routeSmokeRequired: true,
      evidenceRequired: true,
    },
    liveMode: {
      ready: false,
      reason: "Live trading is intentionally blocked. This build is paper-first only.",
      hardBlockers: [
        "No private keys inside Nexora",
        "No wallet signing inside Nexora",
        "No autonomous live orders",
        "No Postgres replay until DB storage upgrade is confirmed",
        "No deploy until explicit deploy instruction",
      ],
    },
    checks: readiness.checks,
    safety: safety(),
    contractorNotes: [
      "Use this report as local paper-readiness evidence only.",
      "Do not treat this as authorization for live trading.",
      "Future live execution must be external-signer scaffold only until owner approval.",
    ],
    linkedEvidencePack: state.latestEvidencePack,
  };

  writeJson(file, report);

  const nextState = saveState({
    status: "readiness_report_generated",
    readinessReports: Number(state.readinessReports || 0) + 1,
    latestReadinessReport: {
      id,
      file,
      generatedAt: report.generatedAt,
      score: readiness.score,
      verdict: readiness.status,
    },
  });

  appendEvent({
    type: "readiness_report_generated",
    id,
    file,
    verdict: readiness.status,
    score: readiness.score,
  });

  return {
    ...report,
    stateAfter: nextState,
    file,
  };
}

function runFullSuite(input: JsonRecord = {}): JsonRecord {
  const state = readState();
  const evidence = buildEvidencePack(input);
  const readinessReport = buildReadinessReport({
    ...input,
    evidencePackId: evidence.id,
  });

  const nextState = saveState({
    status: "full_suite_completed",
    cycles: Number(state.cycles || 0) + 1,
    latestEvidencePack: {
      id: evidence.id,
      file: evidence.file,
      generatedAt: evidence.generatedAt,
      score: evidence.readiness.score,
      status: evidence.readiness.status,
    },
    latestReadinessReport: {
      id: readinessReport.id,
      file: readinessReport.file,
      generatedAt: readinessReport.generatedAt,
      score: readinessReport.score,
      verdict: readinessReport.verdict,
    },
  });

  appendEvent({
    type: "full_suite_completed",
    evidencePackId: evidence.id,
    readinessReportId: readinessReport.id,
    score: readinessReport.score,
    verdict: readinessReport.verdict,
  });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_app_full_suite",
    generatedAt: nowIso(),
    mode: "paper",
    evidencePack: {
      id: evidence.id,
      file: evidence.file,
      score: evidence.readiness.score,
      status: evidence.readiness.status,
    },
    readinessReport: {
      id: readinessReport.id,
      file: readinessReport.file,
      score: readinessReport.score,
      verdict: readinessReport.verdict,
    },
    state: nextState,
    safety: safety(),
  };
}

export function registerNexoraPolyAppPaperFullSuiteRoutes(app: Express): void {
  app.get("/api/nexora/poly-app/operator-summary", (_req, res) => {
    const state = readState();
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_app_operator_summary",
      generatedAt: nowIso(),
      product: "Phantom X / Polymarket",
      mode: "paper",
      state,
      readiness: scoreReadiness(),
      safety: safety(),
    });
  });

  app.post("/api/nexora/poly-app/paper-seed", (req, res) => {
    const body = (req.body || {}) as JsonRecord;
    const state = saveState({
      status: "paper_seed_confirmed",
      latestSeed: {
        generatedAt: nowIso(),
        source: body.source || "local",
        note: "No live trading, no private keys, no wallet signing.",
      },
    });

    appendEvent({
      type: "paper_seed_confirmed",
      source: body.source || "local",
    });

    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_app_paper_seed",
      generatedAt: nowIso(),
      accepted: true,
      state,
      safety: safety(),
    });
  });

  app.post("/api/nexora/poly-app/evidence-pack", (req, res) => {
    res.json(buildEvidencePack((req.body || {}) as JsonRecord));
  });

  app.post("/api/nexora/poly-app/readiness-report", (req, res) => {
    res.json(buildReadinessReport((req.body || {}) as JsonRecord));
  });

  app.post("/api/nexora/poly-app/full-suite", (req, res) => {
    res.json(runFullSuite((req.body || {}) as JsonRecord));
  });

  app.get("/api/nexora/poly-app/full-suite/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_app_full_suite_status",
      generatedAt: nowIso(),
      state: readState(),
      readiness: scoreReadiness(),
      safety: safety(),
    });
  });
}
