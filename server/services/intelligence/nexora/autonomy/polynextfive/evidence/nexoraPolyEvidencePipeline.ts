import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../../localcore/nexoraLocalCore";
import { recordNexoraMetric } from "../../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const EVIDENCE_LOG = nexoraLocalPath("poly-next-five", "evidence", "evidence-pipeline-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-next-five", "journal", "poly-next-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function count(file: string, event?: string) {
  const rows = readNexoraJsonl(file);
  return event ? rows.filter((row: any) => row.event === event).length : rows.length;
}

export function createPolyEvidencePipelineReport(input: any = {}) {
  const reportId = String(input.reportId || nexoraLocalId("evidence_pipeline"));

  const evidence = {
    marketSignals: count(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), "paper_signal.created"),
    marketEdges: count(nexoraLocalPath("market-data", "edges", "edge-log.jsonl"), "edge.detected"),
    moondevStrategies: count(nexoraLocalPath("moondev-strategy-import", "strategies", "strategy-log.jsonl"), "strategy.imported"),
    moondevBacktests: count(nexoraLocalPath("moondev-strategy-import", "backtests", "backtest-log.jsonl"), "backtest.imported"),
    strategyCandidates: count(nexoraLocalPath("poly-five", "strategies", "strategy-factory-log.jsonl"), "strategy.candidate"),
    strategyTournaments: count(nexoraLocalPath("poly-next-five", "strategy-tournament", "tournament-log.jsonl"), "strategy.tournament"),
    pnlReports: count(nexoraLocalPath("poly-five", "pnl", "pnl-analytics-log.jsonl"), "pnl.report"),
    riskStress: count(nexoraLocalPath("poly-next-five", "risk-stress", "risk-stress-log.jsonl"), "risk.stress"),
    readinessGates: count(nexoraLocalPath("trading-readiness", "gates", "gate-log.jsonl"), "promotion_gate.evaluated"),
  };

  const score =
    (evidence.marketSignals > 0 ? 10 : 0) +
    (evidence.moondevStrategies > 0 ? 15 : 0) +
    (evidence.moondevBacktests > 0 ? 15 : 0) +
    (evidence.strategyCandidates > 0 ? 10 : 0) +
    (evidence.strategyTournaments > 0 ? 15 : 0) +
    (evidence.pnlReports > 0 ? 15 : 0) +
    (evidence.riskStress > 0 ? 10 : 0) +
    (evidence.readinessGates > 0 ? 10 : 0);

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_evidence_pipeline",
    reportId,
    createdAt: now(),
    evidence,
    score,
    status:
      score >= 85 ? "strong_paper_evidence_pipeline" :
      score >= 60 ? "building_evidence" :
      "needs_more_runs",
    nextActions: [
      evidence.moondevStrategies === 0 ? "Import MoonDev strategies." : null,
      evidence.moondevBacktests === 0 ? "Import MoonDev backtests." : null,
      evidence.strategyCandidates === 0 ? "Create strategy candidates." : null,
      evidence.strategyTournaments === 0 ? "Run strategy tournament." : null,
      evidence.pnlReports === 0 ? "Create PnL report." : null,
      evidence.riskStress === 0 ? "Run risk stress test." : null,
      evidence.readinessGates === 0 ? "Run readiness gate." : null,
    ].filter(Boolean),
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-next-five", "evidence", `${reportId}.json`), report);
  appendNexoraJsonl(EVIDENCE_LOG, { event: "evidence.pipeline", report, createdAt: now() });
  journal("evidence.pipeline", report);

  recordNexoraMetric({
    name: "poly_evidence_pipeline_score",
    value: score,
    unit: "score",
    dimensions: { status: report.status },
  });

  return { ok: true, nexoraBrain: true, report };
}

export function listPolyEvidencePipelineReports(input: any = {}) {
  const limit = Number(input.limit || 50);

  const rows = readNexoraJsonl(EVIDENCE_LOG)
    .filter((row: any) => row.event === "evidence.pipeline")
    .map((row: any) => row.report)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getPolyEvidencePipelineStatus() {
  const rows = listPolyEvidencePipelineReports({ limit: 50 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_evidence_pipeline_status",
    reports: rows.count,
    latest: rows.rows[0] || null,
  };
}
