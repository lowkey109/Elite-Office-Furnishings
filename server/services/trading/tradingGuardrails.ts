import type { ParameterProposal } from "./ruleUpdateEngine";

export interface GuardrailResult {
  passed: boolean;
  failureReasons: string[];
  riskLevel: "low" | "medium" | "high";
}

const MIN_SAMPLE_SIZE = 20;
const MAX_CHANGES_PER_CYCLE = 2;
const MIN_CONFIDENCE = 60;
const MAX_CONFIDENCE_SHIFT = 15;
const MIN_RISK_MULTIPLIER = 0.3;

export function evaluateGuardrails(proposals: ParameterProposal[]): Map<number, GuardrailResult> {
  const results = new Map<number, GuardrailResult>();

  let approvedCount = 0;

  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i];
    const failures: string[] = [];

    if (p.sampleSize < MIN_SAMPLE_SIZE) {
      failures.push(`Insufficient sample size: ${p.sampleSize} < ${MIN_SAMPLE_SIZE} minimum`);
    }

    if (p.confidence < MIN_CONFIDENCE) {
      failures.push(`Low confidence: ${p.confidence.toFixed(1)}% < ${MIN_CONFIDENCE}% minimum`);
    }

    if (approvedCount >= MAX_CHANGES_PER_CYCLE && failures.length === 0) {
      failures.push(`Max changes per cycle (${MAX_CHANGES_PER_CYCLE}) already reached`);
    }

    if (p.parameterKey === "minConfidence") {
      const shift = Math.abs(p.proposedValue - p.currentValue);
      if (shift > MAX_CONFIDENCE_SHIFT) {
        failures.push(`Confidence shift too large: ${shift} > ${MAX_CONFIDENCE_SHIFT} max`);
      }
    }

    if (p.parameterKey.startsWith("symbolRiskMultipliers") && p.proposedValue < MIN_RISK_MULTIPLIER) {
      failures.push(`Risk multiplier too low: ${p.proposedValue} < ${MIN_RISK_MULTIPLIER} minimum`);
    }

    if (p.proposalType === "strategy_disable") {
      if (p.sampleSize < 30) {
        failures.push(`Strategy disable requires 30+ trades, only ${p.sampleSize} available`);
      }
    }

    let riskLevel: "low" | "medium" | "high" = "low";
    if (p.proposalType === "strategy_disable") riskLevel = "high";
    else if (p.proposalType === "parameter_change" && p.parameterKey === "minConfidence") riskLevel = "medium";
    else if (p.proposalType === "risk_adjustment") riskLevel = "medium";

    const passed = failures.length === 0;
    if (passed) approvedCount++;

    results.set(i, { passed, failureReasons: failures, riskLevel });
  }

  return results;
}

export function classifyRisk(proposal: ParameterProposal): "low" | "medium" | "high" {
  if (proposal.proposalType === "strategy_disable") return "high";
  if (proposal.proposalType === "parameter_change") {
    if (proposal.parameterKey === "minConfidence") return "medium";
    if (proposal.parameterKey.startsWith("max")) return "medium";
  }
  if (proposal.proposalType === "setup_filter") return "low";
  return "medium";
}
