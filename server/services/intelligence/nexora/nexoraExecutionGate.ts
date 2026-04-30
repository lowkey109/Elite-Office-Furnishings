/**
 * Nexora Execution Gate
 *
 * This is the single gate every real module should call before performing
 * a business action.
 *
 * Core rule:
 * - Nexora is the approval/decline authority.
 * - Normal business automation does NOT wait for human approval.
 * - Actions outside policy are declined/blocked by Nexora.
 *
 * Human blocking remains only for:
 * - deployment / release
 * - destructive operations
 * - money movement outside pre-authorised rules
 */

import {
  routeNexoraAction,
  type NexoraActionIntent,
  type NexoraActionRequest,
  type NexoraActionRouteResult,
} from "./nexoraActionRouter";
import { evaluateActionPolicy } from "../../governance/actionPolicyEngine";
import { evaluateRealEvidencePolicy } from "../realEvidencePolicy";

export type NexoraExecutionGateInput = {
  moduleKey: string;
  intent: NexoraActionIntent;
  requestedBy?: NexoraActionRequest["requestedBy"];
  reason: string;
  evidence?: Record<string, unknown>;
  dryRun?: boolean;
};

export type NexoraExecutionGateResult = NexoraActionRouteResult & {
  allowed: boolean;
  gate: "nexora_execution_gate";
};

export function evaluateNexoraExecutionGate(input: NexoraExecutionGateInput): NexoraExecutionGateResult {
  const result = routeNexoraAction({
    moduleKey: input.moduleKey,
    intent: input.intent,
    requestedBy: input.requestedBy || "system",
    reason: input.reason,
    evidence: {
      ...(input.evidence || {}),
    },
    dryRun: input.dryRun ?? false,
  });

  return {
    ...result,
    allowed: result.ok === true && result.decision === "approved",
    gate: "nexora_execution_gate",
  };
}

export function assertNexoraExecutionApproved(input: NexoraExecutionGateInput): NexoraExecutionGateResult {
  const result = evaluateNexoraExecutionGate(input);

  if (!result.allowed) {
  const governancePolicy = evaluateActionPolicy({
    moduleKey: input.moduleKey,
    intent: input.intent,
    evidence: input.evidence,
  });

  const realEvidencePolicy = evaluateRealEvidencePolicy({
    moduleKey: input.moduleKey,
    intent: input.intent,
    evidence: input.evidence,
  });

  if (!realEvidencePolicy.ok) {
    return {
      approved: false,
      decision: "blocked",
      reason: realEvidencePolicy.reason,
      moduleKey: input.moduleKey,
      intent: input.intent,
      requestedBy: input.requestedBy,
      evidence: {
        ...(input.evidence || {}),
        realEvidencePolicy,
      },
      createdAt: new Date().toISOString(),
    } as any;
  }

  if (!governancePolicy.allowed) {
    return {
      approved: false,
      decision: "blocked",
      reason: governancePolicy.reason,
      moduleKey: input.moduleKey,
      intent: input.intent,
      requestedBy: input.requestedBy,
      evidence: {
        ...(input.evidence || {}),
        governancePolicy,
        realEvidencePolicy,
      },
      createdAt: new Date().toISOString(),
    } as any;
  }


    const err = new Error(result.reason || "Nexora declined action") as Error & {
      nexoraGate?: NexoraExecutionGateResult;
      statusCode?: number;
    };

    err.nexoraGate = result;
    err.statusCode =
      result.decision === "blocked" ? 403 :
      result.decision === "module_not_found" ? 404 :
      result.decision === "capability_not_allowed" ? 400 :
      409;

    throw err;
  }

  return result;
}

export function isNexoraApproved(result: NexoraActionRouteResult): boolean {
  return result.ok === true && result.decision === "approved";
}

/**
 * Convenience wrappers for the current platform modules.
 * These keep module code clean and make future wiring obvious.
 */

export function approveOutreachAction(reason: string, evidence: Record<string, unknown> = {}) {
  return assertNexoraExecutionApproved({
    moduleKey: "outreach",
    intent: "send_message",
    requestedBy: "nexora",
    reason,
    evidence,
  });
}

export function approveFollowUpAction(reason: string, evidence: Record<string, unknown> = {}) {
  return assertNexoraExecutionApproved({
    moduleKey: "follow_up",
    intent: "schedule",
    requestedBy: "nexora",
    reason,
    evidence,
  });
}

export function approveProcurementAction(reason: string, evidence: Record<string, unknown> = {}) {
  return assertNexoraExecutionApproved({
    moduleKey: "procurement",
    intent: "create_record",
    requestedBy: "nexora",
    reason,
    evidence,
  });
}

export function approvePhantomXPaperTrade(reason: string, evidence: Record<string, unknown> = {}) {
  return assertNexoraExecutionApproved({
    moduleKey: "phantom_x",
    intent: "paper_trade",
    requestedBy: "nexora",
    reason,
    evidence,
  });
}

export function approvePhantomXScan(reason: string, evidence: Record<string, unknown> = {}) {
  return assertNexoraExecutionApproved({
    moduleKey: "phantom_x",
    intent: "scan",
    requestedBy: "nexora",
    reason,
    evidence,
  });
}

export function approveSignalScan(moduleKey: string, reason: string, evidence: Record<string, unknown> = {}) {
  return assertNexoraExecutionApproved({
    moduleKey,
    intent: "scan",
    requestedBy: "nexora",
    reason,
    evidence,
  });
}
