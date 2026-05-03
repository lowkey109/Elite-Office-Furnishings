import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";

function now() {
  return new Date().toISOString();
}

const RISK_LOG = nexoraLocalPath("risk-sim", "risk-sim-log.jsonl");

export function runNexoraRiskSimulation(input: any = {}) {
  const simulationId = String(input.simulationId || nexoraLocalId("risk_sim"));

  const scenarios = Array.isArray(input.scenarios) && input.scenarios.length
    ? input.scenarios
    : [
        { name: "Safe CRM follow-up", area: "crm", action: "create_followup", risk: "safe" },
        { name: "High-value customer quote", area: "office", action: "release_quote", quoteTotal: 45000, bindingCommitment: true },
        { name: "Supplier purchase order", area: "procurement", action: "issue_purchase_order", purchaseOrder: true },
        { name: "Trading live promotion", area: "trading", action: "promote_live_trade", tradingMode: "live", liveTrading: true },
        { name: "Local backup dry-run", area: "backup", action: "backup_dry_run", risk: "safe" },
      ];

  const results = scenarios.map((scenario: any, index: number) => {
    const policy = evaluateNexoraPolicy(scenario);
    const score =
      (policy.approvalRequired ? 50 : 0) +
      (/trading/i.test(JSON.stringify(scenario)) ? 25 : 0) +
      (/purchase|binding|livetrading|live trade/i.test(JSON.stringify(scenario)) ? 25 : 0);

    return {
      index,
      scenario,
      policy,
      riskScore: Math.min(100, score),
      risk: score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "medium" : "low",
      approvalRequired: policy.approvalRequired || score >= 50,
    };
  });

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_risk_simulator",
    simulationId,
    createdAt: now(),
    scenarioCount: results.length,
    approvalRequired: results.filter((row: any) => row.approvalRequired).length,
    results,
    safety: {
      dryRunOnly: true,
      noExecution: true,
      approvalGatesPreserved: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("risk-sim", `${simulationId}.json`), report);
  appendNexoraJsonl(RISK_LOG, {
    event: "risk_simulation.created",
    report,
    createdAt: now(),
  });

  return report;
}

export function listNexoraRiskSimulations(input: any = {}) {
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(RISK_LOG)
    .filter((row: any) => row.event === "risk_simulation.created")
    .map((row: any) => row.report)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraRiskSimulatorStatus() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_risk_simulator_status",
    totalSimulations: listNexoraRiskSimulations({ limit: 1000 }).count,
  };
}
