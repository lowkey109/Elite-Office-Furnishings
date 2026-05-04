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

const STRESS_LOG = nexoraLocalPath("poly-next-five", "risk-stress", "risk-stress-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-next-five", "journal", "poly-next-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

export function runPolyRiskStressTest(input: any = {}) {
  const stressId = String(input.stressId || nexoraLocalId("risk_stress"));
  const bankroll = Number(input.bankroll || 1000);
  const maxDailyLoss = Number(input.maxDailyLoss || 50);
  const maxExposure = Number(input.maxExposure || 100);

  const scenarios = [
    { name: "normal", losses: [5, -3, 8, -2], exposure: 25 },
    { name: "drawdown_spike", losses: [-15, -20, -25], exposure: 40 },
    { name: "exposure_spike", losses: [5, 5, -2], exposure: 140 },
    { name: "latency_bad_fill", losses: [-10, -15, -8], exposure: 80 },
    { name: "catastrophic_sequence", losses: [-20, -20, -20, -20], exposure: 90 },
  ];

  const results = scenarios.map((scenario) => {
    const pnl = scenario.losses.reduce((sum, x) => sum + x, 0);
    const dailyLossBreached = pnl <= -Math.abs(maxDailyLoss);
    const exposureBreached = scenario.exposure > maxExposure;
    const killSwitch = dailyLossBreached || exposureBreached;

    return {
      ...scenario,
      pnl,
      endingBankroll: bankroll + pnl,
      dailyLossBreached,
      exposureBreached,
      killSwitch,
      action: killSwitch ? "stop_all_trading" : "continue_paper_only",
    };
  });

  const stress = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_risk_stress_test",
    stressId,
    createdAt: now(),
    bankroll,
    maxDailyLoss,
    maxExposure,
    results,
    failed: results.filter((r) => r.killSwitch).length,
    safety: {
      paperOnly: true,
      noLiveTrading: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-next-five", "risk-stress", `${stressId}.json`), stress);
  appendNexoraJsonl(STRESS_LOG, { event: "risk.stress", stress, createdAt: now() });
  journal("risk.stress", stress);

  recordNexoraMetric({
    name: "poly_risk_stress_failures",
    value: stress.failed,
    unit: "scenarios",
    dimensions: {},
  });

  return { ok: true, nexoraBrain: true, stress };
}

export function listPolyRiskStressTests(input: any = {}) {
  const limit = Number(input.limit || 50);

  const rows = readNexoraJsonl(STRESS_LOG)
    .filter((row: any) => row.event === "risk.stress")
    .map((row: any) => row.stress)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getPolyRiskStressStatus() {
  const rows = listPolyRiskStressTests({ limit: 100 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_risk_stress_status",
    tests: rows.count,
    latest: rows.rows[0] || null,
  };
}
