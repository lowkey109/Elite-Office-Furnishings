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

const RULE_LOG = nexoraLocalPath("rules", "rule-log.jsonl");

export function createNexoraDecisionRule(input: any = {}) {
  const ruleId = String(input.ruleId || nexoraLocalId("rule"));
  const rule = {
    ok: true,
    nexoraBrain: true,
    ruleId,
    name: String(input.name || "Nexora decision rule"),
    area: String(input.area || "operations"),
    match: input.match || {},
    outcome: input.outcome || {
      action: "queue_safe_task",
      approvalRequired: false,
    },
    priority: Number(input.priority || 50),
    enabled: input.enabled !== false,
    createdAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("rules", `${ruleId}.json`), rule);
  appendNexoraJsonl(RULE_LOG, {
    event: "rule.created",
    rule,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    rule,
  };
}

export function evaluateNexoraDecisionRules(input: any = {}) {
  const rows = readNexoraJsonl(RULE_LOG)
    .filter((row: any) => row.event === "rule.created")
    .map((row: any) => row.rule)
    .filter((rule: any) => rule.enabled);

  const text = JSON.stringify(input).toLowerCase();

  const matches = rows.filter((rule: any) => {
    const match = rule.match || {};
    if (match.area && String(match.area).toLowerCase() !== String(input.area || "").toLowerCase()) return false;
    if (match.contains && !text.includes(String(match.contains).toLowerCase())) return false;
    return true;
  });

  const policy = evaluateNexoraPolicy(input);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_decision_rule_engine",
    input,
    policy,
    matchCount: matches.length,
    matches,
    decision: {
      approvalRequired: policy.approvalRequired || matches.some((rule: any) => rule.outcome?.approvalRequired),
      recommendedAction: matches[0]?.outcome?.action || "queue_safe_task",
    },
  };
}

export function listNexoraDecisionRules(input: any = {}) {
  const limit = Number(input.limit || 100);
  const rows = readNexoraJsonl(RULE_LOG)
    .filter((row: any) => row.event === "rule.created")
    .map((row: any) => row.rule)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}
