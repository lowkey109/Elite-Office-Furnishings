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

function round(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

const PNL_LOG = nexoraLocalPath("poly-five", "pnl", "pnl-analytics-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-five", "journal", "poly-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function settlements() {
  return [
    ...readNexoraJsonl(nexoraLocalPath("trading-execution", "reconciliation", "reconciliation-log.jsonl"))
      .filter((row: any) => row.event === "reconciliation.settled")
      .map((row: any) => row.settlement),
    ...readNexoraJsonl(nexoraLocalPath("trading-lab", "portfolio", "portfolio-log.jsonl"))
      .filter((row: any) => row.event === "position.settled")
      .map((row: any) => row.settlement),
    ...readNexoraJsonl(nexoraLocalPath("polymarket-superstack", "pnl", "pnl.jsonl"))
      .filter((row: any) => row.event === "paper_order.settled")
      .map((row: any) => row.settlement),
  ].filter(Boolean);
}

function equityCurve(rows: any[], start = 1000) {
  let equity = start;
  return [
    { index: 0, equity },
    ...rows.map((row, index) => {
      equity += Number(row.pnl || 0);
      return { index: index + 1, equity: round(equity, 2), pnl: Number(row.pnl || 0) };
    })
  ];
}

function maxDrawdown(curve: any[]) {
  let peak = curve[0]?.equity || 0;
  let maxDd = 0;

  for (const point of curve) {
    if (point.equity > peak) peak = point.equity;
    const dd = peak > 0 ? (peak - point.equity) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }

  return round(maxDd, 6);
}

export function createPolyPnlAnalyticsReport(input: any = {}) {
  const reportId = String(input.reportId || nexoraLocalId("pnl_report"));
  const start = Number(input.startBankroll || 1000);
  const rows = settlements();
  const totalPnl = round(rows.reduce((sum: number, row: any) => sum + Number(row.pnl || 0), 0), 2);
  const wins = rows.filter((row: any) => row.won === true || Number(row.pnl || 0) > 0).length;
  const losses = rows.filter((row: any) => Number(row.pnl || 0) < 0).length;
  const curve = equityCurve(rows, start);

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_pnl_analytics",
    reportId,
    createdAt: now(),
    startBankroll: start,
    endingBankroll: round(start + totalPnl, 2),
    totalPnl,
    totalReturnPct: start > 0 ? round((totalPnl / start) * 100, 4) : 0,
    settlements: rows.length,
    wins,
    losses,
    winRate: rows.length ? round(wins / rows.length, 4) : 0,
    maxDrawdown: maxDrawdown(curve),
    equityCurve: curve,
    safety: {
      paperOnly: true,
      noLiveTrading: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-five", "pnl", `${reportId}.json`), report);
  appendNexoraJsonl(PNL_LOG, { event: "pnl.report", report, createdAt: now() });
  journal("pnl.report", report);

  recordNexoraMetric({
    name: "poly_pnl_total",
    value: totalPnl,
    unit: "usd",
    dimensions: { settlements: rows.length },
  });

  return { ok: true, nexoraBrain: true, report };
}

export function listPolyPnlReports(input: any = {}) {
  const limit = Number(input.limit || 50);

  const rows = readNexoraJsonl(PNL_LOG)
    .filter((row: any) => row.event === "pnl.report")
    .map((row: any) => row.report)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getPolyPnlAnalyticsStatus() {
  const reports = listPolyPnlReports({ limit: 1000 });
  const latest = reports.rows[0] || null;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_pnl_analytics_status",
    reports: reports.count,
    latest,
  };
}
