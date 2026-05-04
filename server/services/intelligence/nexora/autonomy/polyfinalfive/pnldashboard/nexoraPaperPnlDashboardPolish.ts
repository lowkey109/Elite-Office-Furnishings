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

const DASH_LOG = nexoraLocalPath("poly-final-five", "pnl-dashboard", "pnl-dashboard-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-final-five", "journal", "poly-final-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function gatherSettlements() {
  return [
    ...readNexoraJsonl(nexoraLocalPath("trading-execution", "reconciliation", "reconciliation-log.jsonl"))
      .filter((row: any) => row.event === "reconciliation.settled")
      .map((row: any) => ({ source: "trading-execution", ...row.settlement })),
    ...readNexoraJsonl(nexoraLocalPath("trading-lab", "portfolio", "portfolio-log.jsonl"))
      .filter((row: any) => row.event === "position.settled")
      .map((row: any) => ({ source: "trading-lab", ...row.settlement })),
    ...readNexoraJsonl(nexoraLocalPath("polymarket-superstack", "pnl", "pnl.jsonl"))
      .filter((row: any) => row.event === "paper_order.settled")
      .map((row: any) => ({ source: "polymarket-superstack", ...row.settlement })),
  ].filter(Boolean);
}

function equityCurve(rows: any[], startBankroll: number) {
  let equity = startBankroll;
  return [
    { index: 0, equity: round(equity, 2), pnl: 0 },
    ...rows.map((row, index) => {
      equity += Number(row.pnl || 0);
      return {
        index: index + 1,
        equity: round(equity, 2),
        pnl: round(Number(row.pnl || 0), 2),
        source: row.source,
        asset: row.asset || "unknown",
      };
    }),
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

export function createPaperPnlDashboard(input: any = {}) {
  const dashboardId = String(input.dashboardId || nexoraLocalId("pnl_dashboard"));
  const startBankroll = Number(input.startBankroll || 1000);
  const settlements = gatherSettlements();
  const curve = equityCurve(settlements, startBankroll);
  const totalPnl = round(settlements.reduce((sum: number, row: any) => sum + Number(row.pnl || 0), 0), 2);
  const wins = settlements.filter((row: any) => row.won === true || Number(row.pnl || 0) > 0).length;
  const losses = settlements.filter((row: any) => Number(row.pnl || 0) < 0).length;

  const byAsset: Record<string, any> = {};
  for (const row of settlements) {
    const asset = String(row.asset || "unknown");
    byAsset[asset] = byAsset[asset] || { asset, pnl: 0, count: 0, wins: 0 };
    byAsset[asset].pnl += Number(row.pnl || 0);
    byAsset[asset].count += 1;
    if (row.won === true || Number(row.pnl || 0) > 0) byAsset[asset].wins += 1;
  }

  const dashboard = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_pnl_dashboard",
    dashboardId,
    createdAt: now(),
    startBankroll,
    endingBankroll: round(startBankroll + totalPnl, 2),
    totalPnl,
    returnPct: startBankroll ? round((totalPnl / startBankroll) * 100, 4) : 0,
    settlements: settlements.length,
    wins,
    losses,
    winRate: settlements.length ? round(wins / settlements.length, 4) : 0,
    maxDrawdown: maxDrawdown(curve),
    byAsset: Object.values(byAsset).map((row: any) => ({
      ...row,
      pnl: round(row.pnl, 2),
      winRate: row.count ? round(row.wins / row.count, 4) : 0,
    })),
    equityCurve: curve,
    recent: settlements.slice(-25).reverse(),
    safety: {
      paperOnly: true,
      noLiveTrading: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-final-five", "pnl-dashboard", `${dashboardId}.json`), dashboard);
  appendNexoraJsonl(DASH_LOG, { event: "pnl.dashboard", dashboard, createdAt: now() });
  journal("pnl.dashboard", dashboard);

  recordNexoraMetric({
    name: "paper_pnl_dashboard_total",
    value: totalPnl,
    unit: "usd",
    dimensions: { settlements: settlements.length },
  });

  return { ok: true, nexoraBrain: true, dashboard };
}

export function listPaperPnlDashboards(input: any = {}) {
  const limit = Number(input.limit || 50);
  const rows = readNexoraJsonl(DASH_LOG)
    .filter((row: any) => row.event === "pnl.dashboard")
    .map((row: any) => row.dashboard)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getPaperPnlDashboardStatus() {
  const dashboards = listPaperPnlDashboards({ limit: 100 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_paper_pnl_dashboard_status",
    dashboards: dashboards.count,
    latest: dashboards.rows[0] || null,
  };
}
