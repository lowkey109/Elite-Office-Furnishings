import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../../localcore/nexoraLocalCore";
import { recordNexoraMetric } from "../../warehouse/nexoraLocalWarehouse";
import { recordNexoraTimelineEvent } from "../../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

const READINESS_LOG = nexoraLocalPath("poly-final-five", "readiness", "final-readiness-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-final-five", "journal", "poly-final-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function count(file: string, event?: string) {
  const rows = readNexoraJsonl(file);
  return event ? rows.filter((row: any) => row.event === event).length : rows.length;
}

export function createFinalPaperTradingReadinessReport(input: any = {}) {
  const reportId = String(input.reportId || nexoraLocalId("final_paper_readiness"));

  const evidence = {
    moondevSelected: count("data/nexora/local/moondev-selected/latest-selected-audit.json"),
    moondevStrategies: count(nexoraLocalPath("moondev-strategy-import", "strategies", "strategy-log.jsonl"), "strategy.imported"),
    moondevBacktests: count(nexoraLocalPath("moondev-strategy-import", "backtests", "backtest-log.jsonl"), "backtest.imported"),
    moondevTournament: count(nexoraLocalPath("poly-final-five", "moondev-tournament", "moondev-tournament-log.jsonl"), "moondev.tournament"),
    marketSignals: count(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), "paper_signal.created"),
    backtests: count(nexoraLocalPath("backtesting", "runs", "run-log.jsonl"), "backtest.run"),
    clobFills: count(nexoraLocalPath("poly-final-five", "clob-fill", "clob-fill-log.jsonl"), "clob_fill.simulated"),
    pnlDashboards: count(nexoraLocalPath("poly-final-five", "pnl-dashboard", "pnl-dashboard-log.jsonl"), "pnl.dashboard"),
    killSwitchSuites: count(nexoraLocalPath("poly-final-five", "kill-tests", "kill-test-log.jsonl"), "kill_switch.suite"),
    readinessGates: count(nexoraLocalPath("trading-readiness", "gates", "gate-log.jsonl"), "promotion_gate.evaluated"),
    liveMoneyReadiness: count(nexoraLocalPath("live-money", "readiness", "readiness-log.jsonl"), "live_money.readiness"),
  };

  const checks = [
    { key: "moondev_strategies", ok: evidence.moondevStrategies > 0, weight: 10 },
    { key: "moondev_backtests", ok: evidence.moondevBacktests > 0, weight: 10 },
    { key: "moondev_tournament", ok: evidence.moondevTournament > 0, weight: 10 },
    { key: "market_signals", ok: evidence.marketSignals > 0, weight: 10 },
    { key: "backtests", ok: evidence.backtests > 0, weight: 10 },
    { key: "clob_fills", ok: evidence.clobFills > 0, weight: 10 },
    { key: "pnl_dashboard", ok: evidence.pnlDashboards > 0, weight: 10 },
    { key: "kill_switch", ok: evidence.killSwitchSuites > 0, weight: 15 },
    { key: "readiness_gate", ok: evidence.readinessGates > 0, weight: 10 },
    { key: "live_money_readiness_scaffold", ok: evidence.liveMoneyReadiness > 0, weight: 5 },
  ];

  const score = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0);
  const failed = checks.filter((c) => !c.ok);

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_final_paper_trading_readiness",
    reportId,
    createdAt: now(),
    score,
    status:
      score >= 85 ? "paper_v1_strong" :
      score >= 65 ? "paper_v1_progressing" :
      "paper_v1_needs_more_evidence",
    evidence,
    checks,
    failed,
    liveTradingStatus: "blocked",
    privateKeyStatus: "blocked",
    recommendation:
      score >= 85
        ? "Paper v1 is strong. Continue paper evidence. Live trading still requires separate future build."
        : "Run remaining evidence systems before calling paper v1 complete.",
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
      noWalletSigning: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-final-five", "readiness", `${reportId}.json`), report);
  appendNexoraJsonl(READINESS_LOG, { event: "final_readiness.report", report, createdAt: now() });
  journal("final_readiness.report", report);

  recordNexoraMetric({
    name: "final_paper_trading_readiness_score",
    value: score,
    unit: "score",
    dimensions: { status: report.status },
  });

  recordNexoraTimelineEvent({
    type: "final_paper_trading_readiness",
    title: `Final paper trading readiness: ${report.status}`,
    severity: score >= 65 ? "info" : "warning",
    payload: { reportId, score },
  });

  return { ok: true, nexoraBrain: true, report };
}

export function listFinalPaperReadinessReports(input: any = {}) {
  const limit = Number(input.limit || 50);
  const rows = readNexoraJsonl(READINESS_LOG)
    .filter((row: any) => row.event === "final_readiness.report")
    .map((row: any) => row.report)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getFinalPaperReadinessStatus() {
  const rows = listFinalPaperReadinessReports({ limit: 50 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_final_paper_readiness_status",
    reports: rows.count,
    latest: rows.rows[0] || null,
  };
}
