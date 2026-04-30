/**
 * Nexora Business Mandate
 *
 * Nexora is the operating brain of The Corporate Desk.
 *
 * Mission:
 * - make money
 * - protect money
 * - grow revenue
 * - reduce waste
 * - close deals
 * - coordinate every module
 * - learn from outcomes
 * - build toward an empire-scale business
 *
 * Human approval is not required for normal business automation.
 * Nexora approves or declines.
 *
 * Human blocking remains only for:
 * - deployment / release
 * - destructive operations
 * - money movement outside pre-authorised rules
 */

export type NexoraBusinessObjective =
  | "generate_revenue"
  | "protect_margin"
  | "close_deals"
  | "increase_pipeline"
  | "reduce_cost"
  | "improve_speed"
  | "improve_customer_experience"
  | "improve_supplier_leverage"
  | "increase_learning"
  | "protect_platform"
  | "grow_trading_capital"
  | "build_empire";

export type NexoraEmpireScoreInput = {
  moduleKey: string;
  intent: string;
  requestedBy: string;
  reason: string;
  evidence?: Record<string, unknown>;
  riskLevel?: "low" | "medium" | "high" | "critical";
  preAuthorized?: boolean;
};

export type NexoraEmpireScore = {
  revenuePotential: number;
  profitPotential: number;
  speedToCash: number;
  riskControl: number;
  strategicValue: number;
  automationValue: number;
  customerImpact: number;
  evidenceStrength: number;
  empireScore: number;
  businessDecision: "approve" | "decline" | "delay" | "gather_more_data" | "blocked_by_policy";
  objectives: NexoraBusinessObjective[];
  reasoning: string[];
};

const HIGH_REVENUE_MODULES = new Set([
  "lead_intelligence",
  "deal_hunter",
  "office_move_radar",
  "property_intelligence",
  "company_intelligence",
  "outreach",
  "follow_up",
  "procurement",
  "client_portal",
]);

const STRATEGIC_MODULES = new Set([
  "nexora_core",
  "phantom_x",
  "dev_studio",
  "workspace_learning",
  "procurement",
  "company_intelligence",
]);

const CUSTOMER_MODULES = new Set([
  "client_portal",
  "outreach",
  "follow_up",
  "whatsapp",
  "procurement",
  "workspace_learning",
]);

const MONEY_INTENTS = new Set([
  "send_message",
  "schedule",
  "create_record",
  "update_record",
  "paper_trade",
  "learn",
  "scan",
  "score",
]);

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function evidenceScore(evidence?: Record<string, unknown>): number {
  if (!evidence || Object.keys(evidence).length === 0) return 35;

  let score = 45;
  for (const value of Object.values(evidence)) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "number" && Number.isFinite(value)) score += 8;
    else if (typeof value === "string" && value.trim().length > 5) score += 6;
    else if (Array.isArray(value) && value.length > 0) score += 8;
    else if (typeof value === "object") score += 6;
  }

  return clamp(score);
}

function riskControlScore(riskLevel?: string, preAuthorized?: boolean): number {
  if (riskLevel === "critical") return preAuthorized ? 65 : 25;
  if (riskLevel === "high") return 55;
  if (riskLevel === "medium") return 75;
  return 88;
}

export function scoreNexoraBusinessAction(input: NexoraEmpireScoreInput): NexoraEmpireScore {
  const moduleKey = input.moduleKey;
  const intent = input.intent;
  const reason = `${input.reason || ""}`.toLowerCase();

  const objectives = new Set<NexoraBusinessObjective>();
  const reasoning: string[] = [];

  let revenuePotential = HIGH_REVENUE_MODULES.has(moduleKey) ? 72 : 38;
  let profitPotential = HIGH_REVENUE_MODULES.has(moduleKey) ? 68 : 42;
  let speedToCash = ["outreach", "follow_up", "whatsapp", "deal_hunter"].includes(moduleKey) ? 78 : 45;
  let strategicValue = STRATEGIC_MODULES.has(moduleKey) ? 78 : 52;
  let automationValue = input.requestedBy === "nexora" ? 82 : 58;
  let customerImpact = CUSTOMER_MODULES.has(moduleKey) ? 74 : 45;
  const evidenceStrength = evidenceScore(input.evidence);
  const riskControl = riskControlScore(input.riskLevel, input.preAuthorized);

  if (MONEY_INTENTS.has(intent)) {
    revenuePotential += 8;
    profitPotential += 5;
    objectives.add("generate_revenue");
    reasoning.push("Intent can support revenue, pipeline, learning, or margin improvement.");
  }

  if (reason.includes("lead") || reason.includes("deal") || reason.includes("client") || reason.includes("outreach")) {
    revenuePotential += 10;
    speedToCash += 8;
    objectives.add("increase_pipeline");
    objectives.add("close_deals");
    reasoning.push("Reason indicates pipeline/deal/client movement.");
  }

  if (reason.includes("margin") || reason.includes("cost") || reason.includes("supplier") || reason.includes("procurement")) {
    profitPotential += 12;
    objectives.add("protect_margin");
    objectives.add("improve_supplier_leverage");
    reasoning.push("Reason indicates cost, supplier, or margin leverage.");
  }

  if (reason.includes("learn") || reason.includes("outcome") || reason.includes("memory")) {
    strategicValue += 10;
    automationValue += 8;
    objectives.add("increase_learning");
    reasoning.push("Reason improves learning and future decision quality.");
  }

  if (moduleKey === "phantom_x") {
    objectives.add("grow_trading_capital");
    objectives.add("increase_learning");
    reasoning.push("Phantom X is treated as trading evidence and capital growth support under Nexora control.");
  }

  if (moduleKey === "dev_studio") {
    objectives.add("protect_platform");
    objectives.add("build_empire");
    reasoning.push("Dev Studio supports platform repair and growth, but destructive/deploy actions remain blocked elsewhere.");
  }

  objectives.add("build_empire");

  revenuePotential = clamp(revenuePotential);
  profitPotential = clamp(profitPotential);
  speedToCash = clamp(speedToCash);
  strategicValue = clamp(strategicValue);
  automationValue = clamp(automationValue);
  customerImpact = clamp(customerImpact);

  const empireScore = clamp(
    revenuePotential * 0.22 +
    profitPotential * 0.18 +
    speedToCash * 0.14 +
    riskControl * 0.16 +
    strategicValue * 0.13 +
    automationValue * 0.09 +
    customerImpact * 0.05 +
    evidenceStrength * 0.03
  );

  let businessDecision: NexoraEmpireScore["businessDecision"] = "approve";

  if (riskControl < 30) businessDecision = "blocked_by_policy";
  else if (evidenceStrength < 35 && empireScore < 65) businessDecision = "gather_more_data";
  else if (empireScore < 45) businessDecision = "decline";
  else if (empireScore < 60) businessDecision = "delay";

  reasoning.push(`Empire score ${empireScore}/100 based on revenue, profit, speed, risk, strategy, automation, customer impact, and evidence.`);

  return {
    revenuePotential,
    profitPotential,
    speedToCash,
    riskControl,
    strategicValue,
    automationValue,
    customerImpact,
    evidenceStrength,
    empireScore,
    businessDecision,
    objectives: Array.from(objectives),
    reasoning,
  };
}

export const NEXORA_BUSINESS_MANDATE = {
  name: "Nexora Business Operating Mandate",
  annualRevenueFloorAud: 10_000_000,
  longTermTarget: "Empire-scale international platform",
  rule: "Nexora is the only final decision brain. Modules provide evidence or execute approved actions.",
  defaultHumanApproval: false,
  humanBlockingOnlyFor: [
    "deployment/release",
    "destructive operations",
    "money movement outside pre-authorised rules",
  ],
  coreObjectives: [
    "make money",
    "protect money",
    "grow revenue",
    "close deals",
    "reduce cost leakage",
    "increase supplier leverage",
    "improve client outcomes",
    "learn from every outcome",
    "coordinate the whole system",
    "build an empire-scale company",
  ],
} as const;
