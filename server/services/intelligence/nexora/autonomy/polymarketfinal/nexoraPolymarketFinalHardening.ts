import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { getNexoraMetrics, recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";
import { getNexoraTimeline, recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("polymarket-final", "journal", "polymarket-final-journal.jsonl");
const AUDIT_LOG = nexoraLocalPath("polymarket-final", "audits", "audit-log.jsonl");
const READINESS_LOG = nexoraLocalPath("polymarket-final", "readiness", "readiness-log.jsonl");
const RUNBOOK_LOG = nexoraLocalPath("polymarket-final", "runbooks", "runbook-log.jsonl");
const SMOKE_LOG = nexoraLocalPath("polymarket-final", "smoke", "smoke-log.jsonl");
const EVIDENCE_LOG = nexoraLocalPath("polymarket-final", "evidence", "evidence-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function safeReadJsonl(file: string) {
  try {
    return readNexoraJsonl(file);
  } catch {
    return [];
  }
}

function safeCount(file: string, event?: string) {
  const rows = safeReadJsonl(file);
  return event ? rows.filter((row: any) => row.event === event).length : rows.length;
}

function latest(file: string, limit = 50) {
  return safeReadJsonl(file).slice(-limit).reverse();
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", "client", ".cache"].includes(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|js)$/.test(name)) out.push(full);
  }
  return out;
}

function routeInventory() {
  const files = walk("server/services/intelligence/nexora");
  const routes: any[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const re = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;

    let match;
    while ((match = re.exec(source))) {
      const method = match[1].toUpperCase();
      const routePath = match[2];

      if (!routePath.includes("/api/nexora") && !routePath.startsWith("/nexora")) continue;

      if (
        routePath.includes("polymarket") ||
        routePath.includes("trading") ||
        routePath.includes("market-data") ||
        routePath.includes("backtesting") ||
        routePath.includes("swarm") ||
        routePath.includes("risk-governor")
      ) {
        routes.push({
          method,
          path: routePath,
          file,
          dangerous:
            /live|private|key|wallet|execute|commit|sign|approve|delete|purge|replay|restore/i.test(routePath),
        });
      }
    }
  }

  return routes.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

export function createNexoraPolymarketFinalAudit(input: any = {}) {
  const auditId = String(input.auditId || nexoraLocalId("pm_final_audit"));
  const routes = routeInventory();

  const evidence = {
    marketDataSignals: safeCount(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), "paper_signal.created"),
    marketDataEdges: safeCount(nexoraLocalPath("market-data", "edges", "edge-log.jsonl"), "edge.detected"),
    collectorSignals: safeCount(nexoraLocalPath("polymarket-collector", "signals", "collector-signals.jsonl"), "collector.edge_signal"),
    superstackOrders: safeCount(nexoraLocalPath("polymarket-superstack", "paper-orders", "orders.jsonl")),
    backtestRuns: safeCount(nexoraLocalPath("backtesting", "runs", "run-log.jsonl"), "backtest.run"),
    tradingMegaExecutions: safeCount(nexoraLocalPath("trading-mega", "paper-execution", "paper-execution-log.jsonl")),
    tradingLabSignals: safeCount(nexoraLocalPath("trading-lab", "signals", "signal-log.jsonl")),
    tradingExecutionIntents: safeCount(nexoraLocalPath("trading-execution", "intents", "order-intent-log.jsonl"), "order_intent.created"),
    tradingExecutionFills: safeCount(nexoraLocalPath("trading-execution", "fills", "simulated-fill-log.jsonl"), "simulated_fill.created"),
    tradingReadinessGates: safeCount(nexoraLocalPath("trading-readiness", "gates", "gate-log.jsonl"), "promotion_gate.evaluated"),
    swarmConsensus: safeCount(nexoraLocalPath("swarm-runtime", "consensus", "swarm-consensus.jsonl"), "swarm.consensus.created"),
    riskGovernorEvents: safeCount(nexoraLocalPath("risk-governor", "risk-governor-log.jsonl"), "risk.evaluated"),
    moondevAudits: safeCount(nexoraLocalPath("moondev-bridge", "audits", "moondev-audit-log.jsonl")),
    moondevAdoptionAudits: safeCount(nexoraLocalPath("moondev-adoption", "inventory", "inventory-log.jsonl")),
  };

  const dangerousTerms = [
    "private key",
    "seed phrase",
    "wallet signing",
    "live trading",
    "real order",
    "clob order",
    "polygon signing",
  ];

  const sourceFiles = walk("server/services/intelligence/nexora/autonomy");
  const dangerousMatches: any[] = [];

  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, "utf8").toLowerCase();
    for (const term of dangerousTerms) {
      if (source.includes(term)) {
        dangerousMatches.push({ file, term });
      }
    }
  }

  const audit = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_final_audit",
    auditId,
    generatedAt: now(),
    routes: {
      total: routes.length,
      dangerousRouteCount: routes.filter((route) => route.dangerous).length,
      routes,
    },
    evidence,
    dangerousMatches,
    safety: {
      paperOnly: true,
      noLiveOrders: true,
      noPrivateKeys: true,
      noWalletSigning: true,
      noPostgres: true,
      deploymentPaused: true,
    },
    recommendation: [
      evidence.backtestRuns === 0 ? "Run backtests before any further trading promotion discussion." : "Backtests exist.",
      evidence.swarmConsensus === 0 ? "Run swarm consensus over paper signals." : "Swarm consensus exists.",
      evidence.tradingExecutionFills === 0 ? "Run simulated paper fills before readiness review." : "Simulated fills exist.",
      "Live trading remains blocked.",
      "Private keys remain blocked.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("polymarket-final", "audits", `${auditId}.json`), audit);
  appendNexoraJsonl(AUDIT_LOG, { event: "polymarket_final.audit", audit, createdAt: now() });
  journal("polymarket_final.audit", audit);

  recordNexoraTimelineEvent({
    type: "polymarket_final_audit",
    title: "Polymarket final local audit completed",
    severity: "info",
    payload: { auditId, routes: routes.length },
  });

  return { ok: true, nexoraBrain: true, audit };
}

export function createNexoraPolymarketReadinessScore(input: any = {}) {
  const scoreId = String(input.scoreId || nexoraLocalId("pm_readiness_score"));
  const audit = input.audit || createNexoraPolymarketFinalAudit({ auditId: `${scoreId}_audit` }).audit;
  const e = audit.evidence;

  const checks = [
    { key: "marketDataSignals", ok: e.marketDataSignals > 0, weight: 10 },
    { key: "collectorSignals", ok: e.collectorSignals > 0 || e.marketDataEdges > 0, weight: 10 },
    { key: "backtestRuns", ok: e.backtestRuns > 0, weight: 15 },
    { key: "swarmConsensus", ok: e.swarmConsensus > 0, weight: 15 },
    { key: "riskGovernorEvents", ok: e.riskGovernorEvents > 0, weight: 15 },
    { key: "paperExecutionIntents", ok: e.tradingExecutionIntents > 0, weight: 10 },
    { key: "paperFills", ok: e.tradingExecutionFills > 0, weight: 10 },
    { key: "readinessGate", ok: e.tradingReadinessGates > 0, weight: 10 },
    { key: "moondevResearch", ok: e.moondevAudits > 0 || e.moondevAdoptionAudits > 0, weight: 5 },
  ];

  const score = checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0);
  const failed = checks.filter((check) => !check.ok);

  const readiness = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_readiness_score",
    scoreId,
    generatedAt: now(),
    score,
    checks,
    failed,
    status:
      score >= 85 ? "paper_stack_strong" :
      score >= 60 ? "paper_stack_in_progress" :
      "paper_stack_needs_more_evidence",
    liveTradingStatus: "blocked",
    privateKeyStatus: "blocked",
    recommendation:
      score >= 85
        ? "Continue paper testing and collect more evidence. Live trading still blocked."
        : "Build more paper evidence before any promotion discussion.",
  };

  writeNexoraJson(nexoraLocalPath("polymarket-final", "readiness", `${scoreId}.json`), readiness);
  appendNexoraJsonl(READINESS_LOG, { event: "polymarket_final.readiness", readiness, createdAt: now() });
  journal("polymarket_final.readiness", readiness);

  recordNexoraMetric({
    name: "polymarket_final_readiness_score",
    value: score,
    unit: "score",
    dimensions: { status: readiness.status },
  });

  return { ok: true, nexoraBrain: true, readiness };
}

export function createNexoraPolymarketOperatorRunbook(input: any = {}) {
  const runbookId = String(input.runbookId || nexoraLocalId("pm_operator_runbook"));

  const runbook = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_operator_runbook",
    runbookId,
    generatedAt: now(),
    title: "Nexora Polymarket Paper Operator Runbook",
    sections: [
      {
        title: "Collect / simulate market data",
        commands: [
          "POST /api/nexora/market-data/cycle",
          "POST /api/nexora/polymarket-superstack/cycle",
          "POST /api/nexora/polymarket-collector/edge-scan",
        ],
      },
      {
        title: "Research and consensus",
        commands: [
          "POST /api/nexora/swarm-runtime/consensus",
          "POST /api/nexora/risk-governor/evaluate",
          "POST /api/nexora/moondev-adoption/audit",
        ],
      },
      {
        title: "Backtest and paper execution",
        commands: [
          "POST /api/nexora/backtesting/run",
          "POST /api/nexora/trading-execution/intent",
          "POST /api/nexora/trading-execution/fill/simulate",
          "POST /api/nexora/trading-execution/reconcile",
        ],
      },
      {
        title: "Readiness",
        commands: [
          "POST /api/nexora/trading-readiness/evidence",
          "POST /api/nexora/trading-readiness/gate",
          "POST /api/nexora/polymarket-final/readiness",
        ],
      },
    ],
    hardRules: [
      "No live orders.",
      "No private keys.",
      "No wallet signing.",
      "No CLOB order placement.",
      "No Postgres required.",
      "No Railway deploy.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("polymarket-final", "runbooks", `${runbookId}.json`), runbook);
  appendNexoraJsonl(RUNBOOK_LOG, { event: "polymarket_final.runbook", runbook, createdAt: now() });
  journal("polymarket_final.runbook", runbook);

  return { ok: true, nexoraBrain: true, runbook };
}

export function getNexoraPolymarketFinalStatus() {
  const latestAudit = readNexoraJsonl(AUDIT_LOG).filter((row: any) => row.event === "polymarket_final.audit").slice(-1)[0]?.audit || null;
  const latestReadiness = readNexoraJsonl(READINESS_LOG).filter((row: any) => row.event === "polymarket_final.readiness").slice(-1)[0]?.readiness || null;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_final_status",
    generatedAt: now(),
    latestAudit,
    latestReadiness,
    safety: {
      liveTradingBlocked: true,
      privateKeysBlocked: true,
      noWalletSigning: true,
      paperOnly: true,
    },
  };
}
