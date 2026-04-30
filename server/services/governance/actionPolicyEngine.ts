// server/services/governance/actionPolicyEngine.ts

export type GovernancePolicyClass =
  | "auto_allowed"
  | "auto_allowed_with_limits"
  | "human_review_required"
  | "blocked_until_configured"
  | "blocked_always";

export type GovernanceIntent =
  | "send_message"
  | "schedule"
  | "create_record"
  | "update_record"
  | "delete_record"
  | "money_movement"
  | "deployment"
  | "paper_trade"
  | "live_trade"
  | "scan"
  | "learn"
  | string;

export type GovernancePolicyDecision = {
  allowed: boolean;
  policyClass: GovernancePolicyClass;
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  requiredApproval: boolean;
  limits?: Record<string, unknown>;
};

const DEFAULT_LIMITS = {
  outboundPerRun: 25,
  whatsappPerRun: 25,
  followUpsPerRun: 50,
  procurementPerRun: 10,
  phantomXPaperTradesPerRun: 25,
};

export function evaluateActionPolicy(input: {
  moduleKey: string;
  intent: GovernanceIntent;
  evidence?: Record<string, unknown>;
}): GovernancePolicyDecision {
  const moduleKey = String(input.moduleKey || "").trim();
  const intent = String(input.intent || "").trim();

  if (!moduleKey || !intent) {
    return {
      allowed: false,
      policyClass: "blocked_always",
      severity: "critical",
      reason: "Missing moduleKey or intent.",
      requiredApproval: true,
    };
  }

  if (intent === "delete_record") {
    return {
      allowed: false,
      policyClass: "human_review_required",
      severity: "high",
      reason: "Destructive data changes require human review.",
      requiredApproval: true,
    };
  }

  if (intent === "money_movement" || intent === "deployment") {
    return {
      allowed: false,
      policyClass: "human_review_required",
      severity: "critical",
      reason: "Money movement and deployment require human review.",
      requiredApproval: true,
    };
  }

  if (intent === "live_trade") {
    const preauthorised = process.env.PHANTOM_X_LIVE_PREAUTHORISED === "true";
    return {
      allowed: preauthorised,
      policyClass: preauthorised ? "auto_allowed_with_limits" : "blocked_until_configured",
      severity: preauthorised ? "high" : "critical",
      reason: preauthorised
        ? "Live trading is preauthorised but still constrained by live execution guardrails."
        : "Live trading is blocked until explicit preauthorisation and limits are configured.",
      requiredApproval: !preauthorised,
      limits: {
        requiresEnv: "PHANTOM_X_LIVE_PREAUTHORISED=true",
        mode: process.env.PHANTOM_X_LIVE_PREAUTHORISED === "true" ? "preauthorised" : "blocked",
      },
    };
  }

  if (intent === "send_message") {
    return {
      allowed: true,
      policyClass: "auto_allowed_with_limits",
      severity: moduleKey === "procurement" || moduleKey === "whatsapp" ? "medium" : "low",
      reason: "Outbound message may run automatically through Nexora gate with channel limits and suppression guards.",
      requiredApproval: false,
      limits: DEFAULT_LIMITS,
    };
  }

  if (intent === "paper_trade") {
    return {
      allowed: true,
      policyClass: "auto_allowed_with_limits",
      severity: "medium",
      reason: "Paper trading may run automatically because no real capital is deployed.",
      requiredApproval: false,
      limits: {
        maxPaperTradesPerRun: DEFAULT_LIMITS.phantomXPaperTradesPerRun,
        liveTradingEnabled: false,
      },
    };
  }

  if (intent === "scan" || intent === "learn" || intent === "schedule") {
    return {
      allowed: true,
      policyClass: "auto_allowed",
      severity: "low",
      reason: "Non-destructive scan, learning, or scheduling action is allowed under Nexora.",
      requiredApproval: false,
    };
  }

  if (intent === "create_record" || intent === "update_record") {
    return {
      allowed: true,
      policyClass: "auto_allowed_with_limits",
      severity: "medium",
      reason: "Record mutation is allowed when routed through Nexora and audit logging.",
      requiredApproval: false,
    };
  }

  return {
    allowed: true,
    policyClass: "auto_allowed_with_limits",
    severity: "medium",
    reason: "Default policy allows controlled Nexora action with audit trail.",
    requiredApproval: false,
  };
}
