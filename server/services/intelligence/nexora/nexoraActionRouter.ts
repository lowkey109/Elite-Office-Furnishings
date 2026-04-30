/**
 * Nexora Action Router
 *
 * Nexora is the only final decision brain.
 *
 * This router is the central policy gate used before any module performs
 * an action that can change data, send messages, trigger jobs, run trading
 * actions, or mutate code.
 *
 * Normal rule:
 * - Modules do not need human approval.
 * - Modules need Nexora approval.
 * - Nexora approves or declines.
 *
 * Human approval / hard block is reserved for:
 * - unconfigured live trading
 * - moving money outside pre-authorised rules
 * - app deployment/release
 * - destructive database/file operations
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
  | "deploy"
  | "destructive_change"
  | "move_money"
  | "learn"
  | "display"
  | "audit";

export type NexoraActionDecision =
  | "approved"
  | "declined"
  | "blocked"
  | "nexora_decision_required"
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
  preAuthorized?: boolean;
};

export type NexoraActionRouteResult = {
  ok: boolean;
  decision: NexoraActionDecision;
  moduleKey: string;
  moduleName?: string;
  intent: NexoraActionIntent;
  riskLevel?: NexoraModuleRiskLevel;
  requiresNexoraDecision?: boolean;
  requiresHumanApproval?: boolean;
  canAutoRun?: boolean;
  reason: string;
  policyNotes: string[];
  module?: NexoraModuleDefinition;
};

const INTENT_TO_CAPABILITY: Record<NexoraActionIntent, NexoraModuleCapability | "deploy" | "destructive_change" | "move_money"> = {
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
  deploy: "deploy",
  destructive_change: "destructive_change",
  move_money: "move_money",
  learn: "learn",
  display: "display",
  audit: "audit",
};

const ACTION_INTENTS_REQUIRING_NEXORA = new Set<NexoraActionIntent>([
  "create_record",
  "update_record",
  "send_message",
  "schedule",
  "paper_trade",
  "repair",
  "learn",
]);

const HARD_BLOCK_INTENTS = new Set<NexoraActionIntent>([
  "deploy",
  "destructive_change",
]);

export function routeNexoraAction(request: NexoraActionRequest): NexoraActionRouteResult {
  const module = getNexoraModule(request.moduleKey);

  if (!module) {
    return {
      ok: false,
      decision: "module_not_found",
      moduleKey: request.moduleKey,
      intent: request.intent,
      requiresNexoraDecision: true,
      requiresHumanApproval: false,
      reason: `Unknown Nexora module: ${request.moduleKey}`,
      policyNotes: ["Register the module in nexoraModuleRegistry.ts before routing actions."],
    };
  }

  const capability = INTENT_TO_CAPABILITY[request.intent];

  if (capability === "deploy") {
    return {
      ok: false,
      decision: "blocked",
      moduleKey: module.key,
      moduleName: module.name,
      intent: request.intent,
      riskLevel: "critical",
      requiresNexoraDecision: true,
      requiresHumanApproval: true,
      canAutoRun: false,
      reason: "Deploy/release actions are blocked by policy until explicit release approval is added.",
      policyNotes: [
        "Nexora can prepare, test, and stage a build.",
        "Deployment/release remains blocked unless a release approval policy is added.",
      ],
      module,
    };
  }

  if (capability === "destructive_change") {
    return {
      ok: false,
      decision: "blocked",
      moduleKey: module.key,
      moduleName: module.name,
      intent: request.intent,
      riskLevel: "critical",
      requiresNexoraDecision: true,
      requiresHumanApproval: true,
      canAutoRun: false,
      reason: "Destructive file/database operations are blocked by policy.",
      policyNotes: [
        "Use safe additive patches, backups, and reversible changes only.",
        "No DROP, DELETE, rm -rf, destructive migrations, or unrecoverable operations.",
      ],
      module,
    };
  }

  if (capability === "move_money") {
    if (!request.preAuthorized) {
      return {
        ok: false,
        decision: "blocked",
        moduleKey: module.key,
        moduleName: module.name,
        intent: request.intent,
        riskLevel: "critical",
        requiresNexoraDecision: true,
        requiresHumanApproval: true,
        canAutoRun: false,
        reason: "Moving money is blocked unless it is inside pre-authorised rules.",
        policyNotes: [
          "Pre-authorised trading can be automated later under configured limits.",
          "External transfers or unapproved money movement are blocked.",
        ],
        module,
      };
    }
  }

  if (request.intent === "live_trade" && !request.preAuthorized) {
    return {
      ok: false,
      decision: "blocked",
      moduleKey: module.key,
      moduleName: module.name,
      intent: request.intent,
      riskLevel: "critical",
      requiresNexoraDecision: true,
      requiresHumanApproval: false,
      canAutoRun: false,
      reason: "Live trading is blocked until pre-authorised trading rules are configured.",
      policyNotes: [
        "No per-trade human approval once pre-authorised rules exist.",
        "Until then, use paper_trade for simulation and learning.",
      ],
      module,
    };
  }

  const moduleCapabilities = module.capabilities as string[];
  const hasCapability = moduleCapabilities.includes(String(capability));

  if (!hasCapability) {
    return {
      ok: false,
      decision: "capability_not_allowed",
      moduleKey: module.key,
      moduleName: module.name,
      intent: request.intent,
      riskLevel: request.riskOverride ?? module.riskLevel,
      requiresNexoraDecision: module.requiresNexoraDecision,
      requiresHumanApproval: false,
      canAutoRun: module.canAutoRun,
      reason: `${module.name} does not allow capability "${capability}" for intent "${request.intent}".`,
      policyNotes: [
        "Do not execute module actions outside the registered capability list.",
        "Update nexoraModuleRegistry.ts only if this capability is intentionally allowed.",
      ],
      module,
    };
  }

  if (
    module.requiresNexoraDecision &&
    request.requestedBy !== "nexora" &&
    ACTION_INTENTS_REQUIRING_NEXORA.has(request.intent)
  ) {
    return {
      ok: false,
      decision: "nexora_decision_required",
      moduleKey: module.key,
      moduleName: module.name,
      intent: request.intent,
      riskLevel: request.riskOverride ?? module.riskLevel,
      requiresNexoraDecision: true,
      requiresHumanApproval: false,
      canAutoRun: module.canAutoRun,
      reason: `${module.name} action "${request.intent}" must be approved or declined by Nexora first.`,
      policyNotes: [
        "This prevents separate brains or direct module actions.",
        "Route the request into Nexora, then call again with requestedBy='nexora' after Nexora decides.",
      ],
      module,
    };
  }

  if (!module.canAutoRun && request.requestedBy === "scheduler") {
    return {
      ok: false,
      decision: "nexora_decision_required",
      moduleKey: module.key,
      moduleName: module.name,
      intent: request.intent,
      riskLevel: request.riskOverride ?? module.riskLevel,
      requiresNexoraDecision: true,
      requiresHumanApproval: false,
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
    requiresNexoraDecision: module.requiresNexoraDecision,
    requiresHumanApproval: false,
    canAutoRun: module.canAutoRun,
    reason: request.dryRun
      ? `Dry run approved by Nexora policy for ${module.name}: ${request.reason}`
      : `Approved by Nexora policy for ${module.name}: ${request.reason}`,
    policyNotes: [
      "Action is inside the registered capability list.",
      "Nexora policy gate passed.",
      "No human approval required for this normal business action.",
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
