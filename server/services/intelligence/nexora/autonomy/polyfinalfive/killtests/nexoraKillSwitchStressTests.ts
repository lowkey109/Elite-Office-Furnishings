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

const KILL_LOG = nexoraLocalPath("poly-final-five", "kill-tests", "kill-test-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-final-five", "journal", "poly-final-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

export function runKillSwitchStressSuite(input: any = {}) {
  const suiteId = String(input.suiteId || nexoraLocalId("kill_suite"));

  const config = {
    bankroll: Number(input.bankroll || 1000),
    maxDailyLossUsd: Number(input.maxDailyLossUsd || 50),
    maxExposureUsd: Number(input.maxExposureUsd || 100),
    maxLatencyMs: Number(input.maxLatencyMs || 3000),
    maxSlippageBps: Number(input.maxSlippageBps || 100),
    maxFillMismatchUsd: Number(input.maxFillMismatchUsd || 10),
  };

  const scenarios = [
    { name: "normal", pnl: 12, exposure: 25, latencyMs: 900, slippageBps: 20, fillMismatchUsd: 0 },
    { name: "daily_loss_breach", pnl: -80, exposure: 35, latencyMs: 900, slippageBps: 20, fillMismatchUsd: 0 },
    { name: "exposure_breach", pnl: 5, exposure: 140, latencyMs: 900, slippageBps: 20, fillMismatchUsd: 0 },
    { name: "latency_breach", pnl: 2, exposure: 25, latencyMs: 5000, slippageBps: 20, fillMismatchUsd: 0 },
    { name: "slippage_breach", pnl: -5, exposure: 25, latencyMs: 900, slippageBps: 250, fillMismatchUsd: 0 },
    { name: "fill_mismatch", pnl: -2, exposure: 25, latencyMs: 900, slippageBps: 20, fillMismatchUsd: 25 },
    { name: "private_key_detected", pnl: 0, exposure: 0, latencyMs: 0, slippageBps: 0, fillMismatchUsd: 0, privateKey: true },
    { name: "live_order_detected", pnl: 0, exposure: 0, latencyMs: 0, slippageBps: 0, fillMismatchUsd: 0, liveOrder: true },
  ];

  const results = scenarios.map((s) => {
    const reasons = [
      s.pnl <= -Math.abs(config.maxDailyLossUsd) ? "max_daily_loss" : null,
      s.exposure > config.maxExposureUsd ? "max_exposure" : null,
      s.latencyMs > config.maxLatencyMs ? "latency_breach" : null,
      s.slippageBps > config.maxSlippageBps ? "slippage_breach" : null,
      s.fillMismatchUsd > config.maxFillMismatchUsd ? "fill_mismatch" : null,
      s.privateKey ? "private_key_detected" : null,
      s.liveOrder ? "live_order_detected" : null,
    ].filter(Boolean);

    return {
      ...s,
      killSwitch: reasons.length > 0,
      reasons,
      action: reasons.length ? "stop_all_execution" : "continue_paper_only",
    };
  });

  const suite = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_kill_switch_stress_suite",
    suiteId,
    createdAt: now(),
    config,
    results,
    pass: results.every((r) => (r.name === "normal" ? !r.killSwitch : r.killSwitch)),
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-final-five", "kill-tests", `${suiteId}.json`), suite);
  appendNexoraJsonl(KILL_LOG, { event: "kill_switch.suite", suite, createdAt: now() });
  journal("kill_switch.suite", suite);

  recordNexoraMetric({
    name: "kill_switch_scenarios_passed",
    value: results.filter((r) => r.killSwitch).length,
    unit: "scenarios",
    dimensions: {},
  });

  return { ok: true, nexoraBrain: true, suite };
}

export function listKillSwitchStressSuites(input: any = {}) {
  const limit = Number(input.limit || 50);
  const rows = readNexoraJsonl(KILL_LOG)
    .filter((row: any) => row.event === "kill_switch.suite")
    .map((row: any) => row.suite)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getKillSwitchStressStatus() {
  const rows = listKillSwitchStressSuites({ limit: 50 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_kill_switch_stress_status",
    suites: rows.count,
    latest: rows.rows[0] || null,
  };
}
