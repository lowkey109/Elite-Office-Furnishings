import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { getNexoraMetrics, recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";
import { getNexoraTimeline, recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("polymarket-mega", "journal", "mega-journal.jsonl");
const SNAPSHOT_LOG = nexoraLocalPath("polymarket-mega", "snapshots", "snapshot-log.jsonl");
const EVIDENCE_LOG = nexoraLocalPath("polymarket-mega", "evidence", "evidence-log.jsonl");
const OPERATOR_PACK_LOG = nexoraLocalPath("polymarket-mega", "operator-packs", "operator-pack-log.jsonl");
const RUNBOOK_LOG = nexoraLocalPath("polymarket-mega", "runbooks", "runbook-log.jsonl");
const HEALTH_LOG = nexoraLocalPath("polymarket-mega", "health", "health-log.jsonl");
const ROUTE_AUDIT_LOG = nexoraLocalPath("polymarket-mega", "route-audit", "route-audit-log.jsonl");
const SMOKE_LOG = nexoraLocalPath("polymarket-mega", "smoke", "smoke-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function safeRead(file: string) {
  try { return readNexoraJsonl(file); } catch { return []; }
}

function count(file: string, event?: string) {
  const rows = safeRead(file);
  return event ? rows.filter((row: any) => row.event === event).length : rows.length;
}

function latest(file: string, limit = 50) {
  return safeRead(file).slice(-limit).reverse();
}

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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
      const route = match[2];
      if (
        route.includes("polymarket") ||
        route.includes("trading") ||
        route.includes("market-data") ||
        route.includes("backtesting") ||
        route.includes("swarm") ||
        route.includes("risk-governor") ||
        route.includes("paper-autopilot")
      ) {
        routes.push({
          method,
          route,
          file,
          highRisk: /live|private|key|wallet|execute|commit|sign|approve|delete|purge|replay|restore/i.test(route),
        });
      }
    }
  }

  return routes.sort((a, b) => `${a.route} ${a.method}`.localeCompare(`${b.route} ${b.method}`));
}

export function createNexoraPolymarketMegaSnapshot(input: any = {}) {
  const snapshotId = String(input.snapshotId || nexoraLocalId("pm_mega_snapshot"));

  const settlements = [
    ...latest(nexoraLocalPath("trading-execution", "reconciliation", "reconciliation-log.jsonl"), 500)
      .filter((row: any) => row.event === "reconciliation.settled")
      .map((row: any) => row.settlement),
    ...latest(nexoraLocalPath("trading-lab", "portfolio", "portfolio-log.jsonl"), 500)
      .filter((row: any) => row.event === "position.settled")
      .map((row: any) => row.settlement),
    ...latest(nexoraLocalPath("backtesting", "pnl", "pnl-log.jsonl"), 500)
      .filter((row: any) => row.event === "backtest.pnl")
      .map((row: any) => row.results),
  ].filter(Boolean);

  const pnl = settlements.reduce((sum: number, row: any) => sum + Number(row.pnl || row.totalPnl || 0), 0);
  const wins = settlements.filter((row: any) => row.won === true).length;

  const routes = routeInventory();

  const snapshot = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_mega_snapshot",
    snapshotId,
    generatedAt: now(),
    counts: {
      marketSignals: count(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), "paper_signal.created"),
      marketEdges: count(nexoraLocalPath("market-data", "edges", "edge-log.jsonl"), "edge.detected"),
      collectorSignals: count(nexoraLocalPath("polymarket-collector", "signals", "collector-signals.jsonl"), "collector.edge_signal"),
      superstackOrders: count(nexoraLocalPath("polymarket-superstack", "paper-orders", "orders.jsonl")),
      paperAutopilotRuns: count(nexoraLocalPath("paper-autopilot", "runs", "paper-autopilot-run-log.jsonl"), "paper_autopilot.run"),
      paperAutopilotBatches: count(nexoraLocalPath("paper-autopilot", "reports", "paper-autopilot-report-log.jsonl"), "paper_autopilot.batch"),
      backtestRuns: count(nexoraLocalPath("backtesting", "runs", "run-log.jsonl"), "backtest.run"),
      tradingExecutionIntents: count(nexoraLocalPath("trading-execution", "intents", "order-intent-log.jsonl"), "order_intent.created"),
      tradingExecutionFills: count(nexoraLocalPath("trading-execution", "fills", "simulated-fill-log.jsonl"), "simulated_fill.created"),
      tradingReadinessGates: count(nexoraLocalPath("trading-readiness", "gates", "gate-log.jsonl"), "promotion_gate.evaluated"),
      liveMoneyReadiness: count(nexoraLocalPath("live-money", "readiness", "readiness-log.jsonl"), "live_money.readiness"),
      liveExecutionReports: count(nexoraLocalPath("live-execution-design", "reports", "report-log.jsonl"), "live_execution_design_report.created"),
      swarmConsensus: count(nexoraLocalPath("swarm-runtime", "consensus", "swarm-consensus.jsonl"), "swarm.consensus.created"),
      riskEvents: count(nexoraLocalPath("risk-governor", "risk-governor-log.jsonl"), "risk.evaluated"),
      moondevAudits: count(nexoraLocalPath("moondev-adoption", "inventory", "inventory-log.jsonl"), "moondev.adoption_audit"),
      tradingRoutes: routes.length,
    },
    performance: {
      pnl: round(pnl, 2),
      settlements: settlements.length,
      wins,
      winRate: settlements.length ? round(wins / settlements.length, 4) : 0,
    },
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
      noWalletSigning: true,
      noPostgres: true,
    },
    recent: {
      signals: latest(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), 10),
      backtests: latest(nexoraLocalPath("backtesting", "runs", "run-log.jsonl"), 10),
      executions: latest(nexoraLocalPath("trading-execution", "reconciliation", "reconciliation-log.jsonl"), 10),
      readiness: latest(nexoraLocalPath("trading-readiness", "gates", "gate-log.jsonl"), 10),
      liveMoney: latest(nexoraLocalPath("live-money", "readiness", "readiness-log.jsonl"), 10),
    },
  };

  writeNexoraJson(nexoraLocalPath("polymarket-mega", "snapshots", `${snapshotId}.json`), snapshot);
  appendNexoraJsonl(SNAPSHOT_LOG, { event: "mega.snapshot", snapshot, createdAt: now() });
  journal("mega.snapshot", snapshot);

  return { ok: true, nexoraBrain: true, snapshot };
}

export function createNexoraPolymarketMegaEvidenceRunbook(input: any = {}) {
  const runbookId = String(input.runbookId || nexoraLocalId("pm_mega_runbook"));
  const baseUrl = String(input.baseUrl || "http://127.0.0.1:5000");

  const runbook = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_mega_evidence_runbook",
    runbookId,
    generatedAt: now(),
    commands: [
      {
        name: "Run paper autopilot batch",
        method: "POST",
        path: "/api/nexora/paper-autopilot/batch",
        curl: `curl -sS -X POST "${baseUrl}/api/nexora/paper-autopilot/batch" -H "Content-Type: application/json" -d '{"count":5,"asset":"BTC","openPrice":65000}'`,
      },
      {
        name: "Run market data cycle",
        method: "POST",
        path: "/api/nexora/market-data/cycle",
        curl: `curl -sS -X POST "${baseUrl}/api/nexora/market-data/cycle" -H "Content-Type: application/json" -d '{"symbol":"BTCUSDT","openPrice":65000,"currentPrice":65200,"yesPrice":0.52}'`,
      },
      {
        name: "Run backtest",
        method: "POST",
        path: "/api/nexora/backtesting/run",
        curl: `curl -sS -X POST "${baseUrl}/api/nexora/backtesting/run" -H "Content-Type: application/json" -d '{"asset":"BTC","count":120,"bankroll":1000}'`,
      },
      {
        name: "Run swarm consensus",
        method: "POST",
        path: "/api/nexora/swarm-runtime/consensus",
        curl: `curl -sS -X POST "${baseUrl}/api/nexora/swarm-runtime/consensus" -H "Content-Type: application/json" -d '{"title":"Evaluate paper signal","risk":"medium","payload":{"liveTrading":false,"tradingMode":"paper/sandbox"}}'`,
      },
      {
        name: "Run trading readiness gate",
        method: "POST",
        path: "/api/nexora/trading-readiness/gate",
        curl: `curl -sS -X POST "${baseUrl}/api/nexora/trading-readiness/gate" -H "Content-Type: application/json" -d '{}'`,
      },
      {
        name: "Run live money readiness check",
        method: "POST",
        path: "/api/nexora/live-money/readiness",
        curl: `curl -sS -X POST "${baseUrl}/api/nexora/live-money/readiness" -H "Content-Type: application/json" -d '{}'`,
      },
      {
        name: "Create mega snapshot",
        method: "POST",
        path: "/api/nexora/polymarket-mega/snapshot",
        curl: `curl -sS -X POST "${baseUrl}/api/nexora/polymarket-mega/snapshot" -H "Content-Type: application/json" -d '{}'`,
      },
    ],
    hardRules: [
      "No live orders.",
      "No private keys.",
      "No wallet signing.",
      "No CLOB execution.",
      "No Railway deploy.",
      "No Postgres.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("polymarket-mega", "operator-packs", `${runbookId}.json`), runbook);
  appendNexoraJsonl(OPERATOR_PACK_LOG, { event: "mega.runbook", runbook, createdAt: now() });
  journal("mega.runbook", runbook);

  return { ok: true, nexoraBrain: true, runbook };
}

export function createNexoraPolymarketMegaHealthReport(input: any = {}) {
  const reportId = String(input.reportId || nexoraLocalId("pm_mega_health"));
  const snapshot = createNexoraPolymarketMegaSnapshot({ snapshotId: `${reportId}_snapshot` }).snapshot;

  const checks = [
    { key: "marketSignals", ok: snapshot.counts.marketSignals > 0, weight: 10 },
    { key: "backtests", ok: snapshot.counts.backtestRuns > 0, weight: 15 },
    { key: "paperAutopilot", ok: snapshot.counts.paperAutopilotRuns > 0 || snapshot.counts.paperAutopilotBatches > 0, weight: 15 },
    { key: "swarmConsensus", ok: snapshot.counts.swarmConsensus > 0, weight: 15 },
    { key: "tradingExecution", ok: snapshot.counts.tradingExecutionIntents > 0, weight: 10 },
    { key: "readinessGate", ok: snapshot.counts.tradingReadinessGates > 0, weight: 10 },
    { key: "liveMoneyScaffold", ok: snapshot.counts.liveMoneyReadiness > 0 || snapshot.counts.liveExecutionReports > 0, weight: 10 },
    { key: "moondevResearch", ok: snapshot.counts.moondevAudits > 0, weight: 5 },
    { key: "routes", ok: snapshot.counts.tradingRoutes >= 20, weight: 10 },
  ];

  const score = checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0);
  const failed = checks.filter((check) => !check.ok);

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_mega_health_report",
    reportId,
    generatedAt: now(),
    score,
    status:
      score >= 85 ? "strong_paper_stack" :
      score >= 60 ? "paper_stack_progressing" :
      "needs_more_paper_evidence",
    failed,
    checks,
    snapshot,
    recommendation:
      score >= 85
        ? "Continue paper evidence collection. Live trading remains blocked."
        : "Run paper autopilot batches, backtests, swarm consensus, and readiness gates.",
    safety: snapshot.safety,
  };

  writeNexoraJson(nexoraLocalPath("polymarket-mega", "health", `${reportId}.json`), report);
  appendNexoraJsonl(HEALTH_LOG, { event: "mega.health", report, createdAt: now() });
  journal("mega.health", report);

  recordNexoraMetric({
    name: "polymarket_mega_health_score",
    value: score,
    unit: "score",
    dimensions: { status: report.status },
  });

  recordNexoraTimelineEvent({
    type: "polymarket_mega_health",
    title: `Polymarket mega health: ${report.status}`,
    severity: score >= 60 ? "info" : "warning",
    payload: { reportId, score },
  });

  return { ok: true, nexoraBrain: true, report };
}

export function getNexoraPolymarketMegaStatus() {
  const snapshot = createNexoraPolymarketMegaSnapshot({ snapshotId: "latest" }).snapshot;
  const health = createNexoraPolymarketMegaHealthReport({ reportId: "latest" }).report;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_mega_accelerator",
    generatedAt: now(),
    snapshot: {
      counts: snapshot.counts,
      performance: snapshot.performance,
    },
    health: {
      score: health.score,
      status: health.status,
      failed: health.failed,
    },
    safety: snapshot.safety,
  };
}
