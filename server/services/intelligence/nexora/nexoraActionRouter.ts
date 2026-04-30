/**
 * Nexora Action Router
 *
 * Nexora is the only final decision brain.
 *
 * This router is the central policy gate used before any module performs
 * an action that can change data, send messages, trigger jobs, run trading
 * actions, or mutate code.
 *
 * This file intentionally does not execute external side effects yet.
 * It classifies, approves, blocks, or marks actions as approval_required.
 */

import {
  getNexoraModule,
  type NexoraModuleCapability,
  type NexoraModuleDefinition,
  type NexoraModuleRiskLevel,
} from "./nexoraModuleRegistry";

export type NexoraActionIntent =
  | "scan"
  | "score"
  | "classify"
  | "create_record"
  | "update_record"
  | "send_message"
  | "schedule"
  | "paper_trade"
  | "live_trade"
  | "repair"
  | "learn"
  | "display"
  | "audit";

export type NexoraActionDecision =
  | "approved"
  | "blocked"
  | "approval_required"
  | "module_not_found"
  | "capability_not_allowed";

export type NexoraActionRequest = {
  moduleKey: string;
  intent: NexoraActionIntent;
  requestedBy: "nexora" | "admin" | "system" | "client" | "scheduler" | "unknown";
  reason: string;
  evidence?: Record<string, unknown>;
  dryRun?: boolean;
  riskOverride?: NexoraModuleRiskLevel;
};

export type NexoraActionRouteResult = {
  ok: boolean;
  decision: NexoraActionDecision;
  moduleKey: string;
  moduleName?: string;
  intent: NexoraActionIntent;
  riskLevel?: NexoraModuleRiskLevel;
  requiresHumanApproval?: boolean;
  canAutoRun?: boolean;
  reason: string;
  policyNotes: string[];
  module?: NexoraModuleDefinition;
};

const INTENT_TO_CAPABILITY: Record<NexoraActionIntent, NexoraModuleCapability> = {
  scan: "scan",
  score: "score",
  classify: "classify",
  create_record: "create_record",
  update_record: "update_record",
  send_message: "send_message",
  schedule: "schedule",
  paper_trade: "paper_trade",
  live_trade: "paper_trade",
  repair: "repair",
  learn: "learn",
  display: "display",
  audit: "audit",
};

const EXTERNAL_OR_DANGEROUS_INTENTS = new Set<NexoraActionIntent>([
  "send_message",
  "schedule",
  "paper_trade",
  "live_trade",
  "repair",
  "create_record",
  "update_record",
]);

export function routeNexoraAction(request: NexoraActionRequest): NexoraActionRouteResult {
  const module = getNexoraModule(request.moduleKey);

  if (!module) {
    return {
      ok: false,
      decision: "module_not_found",
      moduleKey: request.moduleKey,
      intent: request.intent,
      reason: `Unknown Nexora module: ${request.moduleKey}`,
      policyNotes: ["Register the module in nexoraModuleRegistry.ts before routing actions."],
    };
  }

  const capability = INTENT_TO_CAPABILITY[request.intent];
  const hasCapability = module.capabilities.includes(capability);

  if (!hasCapability) {
    return {
      ok: false,
      decision: "capability_not_allowed",
      moduleKey: module.key,
      moduleName: module.name,
      intent: request.intent,
      riskLevel: request.riskOverride ?? module.riskLevel,
      requiresHumanApproval: module.requiresHumanApproval,
      canAutoRun: module.canAutoRun,
      reason: `${module.name} does not allow capability "${capability}" for intent "${request.intent}".`,
      policyNotes: [
        "Do not execute module actions outside the registered capability list.",
        "Update nexoraModuleRegistry.ts only if this capability is intentionally allowed.",
      ],
      module,
    };
  }

  if (request.intent === "live_trade") {
    return {
      ok: false,
      decision: "blocked",
      moduleKey: module.key,
      moduleName: module.name,
      intent: request.intent,
      riskLevel: "critical",
      requiresHumanApproval: true,
      canAutoRun: false,
      reason: "Live trading is blocked. Phantom X is paper/evidence mode only until explicitly enabled later.",
      policyNotes: [
        "No live trading without separate broker adapter, risk approval, and explicit production enablement.",
        "Use paper_trade for simulation and learning.",
      ],
      module,
    };
  }

  if (module.requiresHumanApproval && EXTERNAL_OR_DANGEROUS_INTENTS.has(request.intent)) {
    return {
      ok: false,
      decision: "approval_required",
      moduleKey: module.key,
      moduleName: module.name,
      intent: request.intent,
      riskLevel: request.riskOverride ?? module.riskLevel,
      requiresHumanApproval: true,
      canAutoRun: module.canAutoRun,
      reason: `${module.name} requires human approval before "${request.intent}".`,
      policyNotes: [
        "Nexora can prepare and log the action.",
        "Execution must wait for approval unless a later policy explicitly pre-authorises it.",
      ],
      module,
    };
  }

  if (module.requiresNexoraDecision && request.requestedBy !== "nexora" && EXTERNAL_OR_DANGEROUS_INTENTS.has(request.intent)) {
    return {
      ok: false,
      decision: "approval_required",
      moduleKey: module.key,
      moduleName: module.name,
      intent: request.intent,
      riskLevel: request.riskOverride ?? module.riskLevel,
      requiresHumanApproval: module.requiresHumanApproval,
      canAutoRun: module.canAutoRun,
      reason: `${module.name} action "${request.intent}" must be routed through Nexora first.`,
      policyNotes: [
        "This prevents separate brains or direct module actions.",
        "Call routeNexoraAction with requestedBy='nexora' after Nexora creates/logs a decision.",
      ],
      module,
    };
  }

  if (!module.canAutoRun && request.requestedBy === "scheduler") {
    return {
      ok: false,
      decision: "approval_required",
      moduleKey: module.key,
      moduleName: module.name,
      intent: request.intent,
      riskLevel: request.riskOverride ?? module.riskLevel,
      requiresHumanApproval: module.requiresHumanApproval,
      canAutoRun: false,
      reason: `${module.name} is not allowed to auto-run from scheduler directly.`,
      policyNotes: [
        "Scheduler must trigger Nexora, not the module directly.",
        "Nexora can then call the module if policy allows.",
      ],
      module,
    };
  }

  return {
    ok: true,
    decision: "approved",
    moduleKey: module.key,
    moduleName: module.name,
    intent: request.intent,
    riskLevel: request.riskOverride ?? module.riskLevel,
    requiresHumanApproval: module.requiresHumanApproval,
    canAutoRun: module.canAutoRun,
    reason: request.dryRun
      ? `Dry run approved for ${module.name}: ${request.reason}`
      : `Approved for ${module.name}: ${request.reason}`,
    policyNotes: [
      "Action is inside the registered capability list.",
      "Policy gate passed.",
    ],
    module,
  };
}

export function assertNexoraActionApproved(request: NexoraActionRequest): NexoraActionRouteResult {
  const result = routeNexoraAction(request);

  if (!result.ok) {
    throw new Error(`[NexoraActionRouter] ${result.decision}: ${result.reason}`);
  }

  return result;
}

export function previewNexoraActionPolicy(moduleKey: string, intent: NexoraActionIntent) {
  return routeNexoraAction({
    moduleKey,
    intent,
    requestedBy: "unknown",
    reason: "Policy preview",
    dryRun: true,
  });
}
