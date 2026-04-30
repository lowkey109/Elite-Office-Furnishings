/**
 * Nexora Module Registry
 *
 * Rule:
 * Nexora is the only final decision brain.
 *
 * Every other system in The Corporate Desk platform is registered here as:
 * - signal module
 * - action module
 * - specialist module
 * - memory module
 * - dashboard module
 * - wrapper module
 * - legacy review module
 *
 * This file does not start loops.
 * This file does not execute actions.
 * This file does not call OpenAI.
 * This file is the central map Nexora will use to control the whole system.
 */

export type NexoraModuleType =
  | "core_brain"
  | "wrapper"
  | "signal_module"
  | "action_module"
  | "specialist_module"
  | "memory_module"
  | "dashboard_ui"
  | "startup_loop"
  | "legacy_review";

export type NexoraModuleRiskLevel = "low" | "medium" | "high" | "critical";

export type NexoraModuleStatus =
  | "active"
  | "controlled_by_nexora"
  | "manual_only"
  | "needs_review"
  | "disabled";

export type NexoraModuleCapability =
  | "scan"
  | "score"
  | "classify"
  | "decide"
  | "act"
  | "send_message"
  | "create_record"
  | "update_record"
  | "paper_trade"
  | "learn"
  | "audit"
  | "display"
  | "repair"
  | "schedule";

export type NexoraModuleDefinition = {
  key: string;
  name: string;
  type: NexoraModuleType;
  status: NexoraModuleStatus;
  riskLevel: NexoraModuleRiskLevel;
  owner: "nexora" | "module" | "admin";
  description: string;
  files: string[];
  capabilities: NexoraModuleCapability[];
  requiresNexoraDecision: boolean;
  requiresHumanApproval: boolean;
  canAutoRun: boolean;
  notes?: string[];
};

export const NEXORA_MAIN_BRAIN: NexoraModuleDefinition = {
  key: "nexora_core",
  name: "Nexora Core Brain",
  type: "core_brain",
  status: "active",
  riskLevel: "critical",
  owner: "nexora",
  description: "The single final decision brain for The Corporate Desk platform.",
  files: [
    "server/services/intelligence/nexoraOrchestrator.ts",
    "server/services/intelligence/nexora/nexora-support.ts",
    "server/services/intelligence/nexora/nexora-types.ts",
    "server/services/intelligence/nexoraAI.ts"
  ],
  capabilities: ["scan", "score", "classify", "decide", "learn", "audit", "schedule"],
  requiresNexoraDecision: false,
  requiresHumanApproval: false,
  canAutoRun: true,
  notes: [
    "Only this module can make final business/action decisions.",
    "All other modules must feed evidence to Nexora or execute approved actions."
  ]
};

export const NEXORA_MODULE_REGISTRY: NexoraModuleDefinition[] = [
  NEXORA_MAIN_BRAIN,

  {
    key: "nexora_loop_wrapper",
    name: "Nexora Loop Wrapper",
    type: "wrapper",
    status: "controlled_by_nexora",
    riskLevel: "high",
    owner: "nexora",
    description: "Startup/runtime wrapper that should call the main Nexora orchestrator only.",
    files: ["server/services/nexoraLoop.ts", "server/index.ts"],
    capabilities: ["schedule"],
    requiresNexoraDecision: false,
    requiresHumanApproval: false,
    canAutoRun: true,
    notes: ["Must remain a wrapper only. It must not become a second brain."]
  },

  {
    key: "office_move_radar",
    name: "Office Move Radar",
    type: "signal_module",
    status: "controlled_by_nexora",
    riskLevel: "medium",
    owner: "nexora",
    description: "Collects office move, lease, hiring, relocation, and fitout signals.",
    files: [
      "server/services/intelligence/officeMovRadarService.ts",
      "server/services/officeMovRadarService.ts",
      "client/src/pages/AdminOfficeMovRadar.tsx"
    ],
    capabilities: ["scan", "score", "create_record", "display"],
    requiresNexoraDecision: true,
    requiresHumanApproval: false,
    canAutoRun: false
  },

  {
    key: "deal_hunter",
    name: "Deal Hunter",
    type: "signal_module",
    status: "controlled_by_nexora",
    riskLevel: "medium",
    owner: "nexora",
    description: "Finds and scores commercial opportunities for the sales pipeline.",
    files: [
      "server/services/intelligence/dealHunter.ts",
      "server/services/dealHunter.ts",
      "client/src/pages/AdminDealHunter.tsx"
    ],
    capabilities: ["scan", "score", "create_record", "display"],
    requiresNexoraDecision: true,
    requiresHumanApproval: false,
    canAutoRun: false
  },

  {
    key: "property_intelligence",
    name: "Property Intelligence",
    type: "signal_module",
    status: "controlled_by_nexora",
    riskLevel: "medium",
    owner: "nexora",
    description: "Tracks property, lease, building, and relocation opportunity intelligence.",
    files: [
      "server/services/propertyIntelligence/propertyIntelligenceService.ts",
      "server/services/propertyIntelligence/leasehawkEngine.ts",
      "client/src/pages/AdminPropertyIntelligence.tsx"
    ],
    capabilities: ["scan", "score", "create_record", "display"],
    requiresNexoraDecision: true,
    requiresHumanApproval: false,
    canAutoRun: false
  },

  {
    key: "company_intelligence",
    name: "Company Intelligence",
    type: "signal_module",
    status: "controlled_by_nexora",
    riskLevel: "medium",
    owner: "nexora",
    description: "Aggregates company-level intelligence and contact context.",
    files: [
      "server/services/companyIntelligenceService.ts",
      "server/services/intelligence/companyIntelligenceAggregationService.ts",
      "client/src/pages/AdminCompanyIntelligence.tsx"
    ],
    capabilities: ["scan", "score", "classify", "create_record", "display"],
    requiresNexoraDecision: true,
    requiresHumanApproval: false,
    canAutoRun: false
  },

  {
    key: "lead_intelligence",
    name: "Lead Intelligence",
    type: "signal_module",
    status: "controlled_by_nexora",
    riskLevel: "medium",
    owner: "nexora",
    description: "Scores inbound and prospected leads for priority, urgency, and fit.",
    files: [
      "server/services/leadIntelligence.ts",
      "server/services/leadEngine.ts",
      "client/src/pages/AdminLeads.tsx"
    ],
    capabilities: ["score", "classify", "create_record", "display"],
    requiresNexoraDecision: true,
    requiresHumanApproval: false,
    canAutoRun: false
  },

  {
    key: "outreach",
    name: "Outreach Engine",
    type: "action_module",
    status: "controlled_by_nexora",
    riskLevel: "high",
    owner: "nexora",
    description: "Generates and sends outreach only after Nexora policy approval.",
    files: [
      "server/services/outreach/outreachEngine.ts",
      "server/services/outreach/outreachGenerationService.ts",
      "server/services/outreach/outreach-job-runner.ts",
      "server/services/outreach/contactDiscoveryService.ts"
    ],
    capabilities: ["send_message", "create_record", "audit"],
    requiresNexoraDecision: true,
    requiresHumanApproval: true,
    canAutoRun: false,
    notes: ["External messaging must be approval/policy controlled."]
  },

  {
    key: "follow_up",
    name: "Follow-Up Scheduler",
    type: "action_module",
    status: "controlled_by_nexora",
    riskLevel: "high",
    owner: "nexora",
    description: "Schedules and sends follow-up communication after Nexora approval.",
    files: [
      "server/services/followUpEmails.ts",
      "server/services/followUpScheduler.ts"
    ],
    capabilities: ["schedule", "send_message", "audit"],
    requiresNexoraDecision: true,
    requiresHumanApproval: true,
    canAutoRun: false
  },

  {
    key: "whatsapp",
    name: "WhatsApp Communications",
    type: "action_module",
    status: "controlled_by_nexora",
    riskLevel: "high",
    owner: "nexora",
    description: "WhatsApp AI, templates, guards, outbox, and scheduler.",
    files: [
      "server/services/whatsappAI.ts",
      "server/services/whatsappAssistant.ts",
      "server/services/intelligence/communications/aiWhatsAppService.ts",
      "server/services/intelligence/communications/whatsappScheduler.ts",
      "server/services/intelligence/communications/whatsappGuards.ts",
      "server/services/intelligence/communications/whatsappOutbox.ts"
    ],
    capabilities: ["send_message", "schedule", "audit"],
    requiresNexoraDecision: true,
    requiresHumanApproval: true,
    canAutoRun: false
  },

  {
    key: "procurement",
    name: "Procurement / RFQ Engine",
    type: "action_module",
    status: "controlled_by_nexora",
    riskLevel: "high",
    owner: "nexora",
    description: "Supplier RFQs, procurement quote orchestration, and supplier messaging.",
    files: [
      "server/services/procurement/procurementQuoteOrchestrator.ts",
      "server/services/supplierProcurement.ts",
      "client/src/pages/AdminSupplierQuotes.tsx",
      "client/src/pages/AdminProcurementEngine.tsx"
    ],
    capabilities: ["create_record", "send_message", "audit"],
    requiresNexoraDecision: true,
    requiresHumanApproval: true,
    canAutoRun: false
  },

  {
    key: "workspace_learning",
    name: "Workspace Learning",
    type: "memory_module",
    status: "controlled_by_nexora",
    riskLevel: "low",
    owner: "nexora",
    description: "Stores workspace design, strategy, and conversion learning.",
    files: [
      "server/services/workspaceLearning.ts",
      "server/services/workspaceStrategy.ts",
      "client/src/pages/AdminWorkspaceLearning.tsx"
    ],
    capabilities: ["learn", "display"],
    requiresNexoraDecision: false,
    requiresHumanApproval: false,
    canAutoRun: false
  },

  {
    key: "phantom_x",
    name: "Phantom X Trading Module",
    type: "specialist_module",
    status: "controlled_by_nexora",
    riskLevel: "critical",
    owner: "nexora",
    description: "Trading terminal, market scanner, wallet monitor, paper trading, and trading evidence module.",
    files: [
      "server/services/trading/index.ts",
      "server/services/trading/marketLoop.ts",
      "server/services/trading/wallet-monitor.ts",
      "server/services/trading/paperEngine.ts",
      "server/services/trading/phantomXLearningEngine.ts",
      "server/services/trading/phantomXPaperLearner.ts",
      "client/src/pages/AdminPhantomXIntelligence.tsx"
    ],
    capabilities: ["scan", "score", "paper_trade", "learn", "audit", "display"],
    requiresNexoraDecision: true,
    requiresHumanApproval: false,
    canAutoRun: false,
    notes: [
      "No live trading unless explicitly enabled later.",
      "Paper trading actions must be routed through Nexora.",
      "Trading learning is evidence for Nexora, not a second brain."
    ]
  },

  {
    key: "dev_studio",
    name: "Admin Dev Studio",
    type: "action_module",
    status: "manual_only",
    riskLevel: "critical",
    owner: "admin",
    description: "Developer repair, file editing, terminal, and auto-fix tooling.",
    files: [
      "server/services/devStudio/devAIPatch.ts",
      "server/services/devStudio/devAutoFix.ts",
      "server/services/devStudio/devFiles.ts",
      "server/services/devStudio/devTerminal.ts",
      "client/src/pages/AdminDevStudio.tsx"
    ],
    capabilities: ["repair", "audit"],
    requiresNexoraDecision: true,
    requiresHumanApproval: true,
    canAutoRun: false,
    notes: ["Never allow unrestricted self-modifying code without approval."]
  },

  {
    key: "client_portal",
    name: "Client Portal",
    type: "dashboard_ui",
    status: "controlled_by_nexora",
    riskLevel: "medium",
    owner: "nexora",
    description: "Client-facing views and subscription-gated product access.",
    files: [
      "server/services/clientPortal/clientPortalService.ts",
      "server/services/clientPortal/planAccess.ts",
      "client/src/pages/ClientDashboard.tsx"
    ],
    capabilities: ["display"],
    requiresNexoraDecision: false,
    requiresHumanApproval: false,
    canAutoRun: false
  }
];

export function getNexoraModules(): NexoraModuleDefinition[] {
  return NEXORA_MODULE_REGISTRY;
}

export function getNexoraModule(key: string): NexoraModuleDefinition | undefined {
  return NEXORA_MODULE_REGISTRY.find((module) => module.key === key);
}

export function getNexoraModulesByType(type: NexoraModuleType): NexoraModuleDefinition[] {
  return NEXORA_MODULE_REGISTRY.filter((module) => module.type === type);
}

export function getModulesRequiringNexoraDecision(): NexoraModuleDefinition[] {
  return NEXORA_MODULE_REGISTRY.filter((module) => module.requiresNexoraDecision);
}

export function getAutoRunnableModules(): NexoraModuleDefinition[] {
  return NEXORA_MODULE_REGISTRY.filter((module) => module.canAutoRun);
}

export function buildNexoraModuleSummary() {
  const modules = getNexoraModules();

  return {
    totalModules: modules.length,
    mainBrain: NEXORA_MAIN_BRAIN.key,
    byType: modules.reduce<Record<string, number>>((acc, module) => {
      acc[module.type] = (acc[module.type] || 0) + 1;
      return acc;
    }, {}),
    byStatus: modules.reduce<Record<string, number>>((acc, module) => {
      acc[module.status] = (acc[module.status] || 0) + 1;
      return acc;
    }, {}),
    requiringNexoraDecision: modules.filter((module) => module.requiresNexoraDecision).length,
    requiringHumanApproval: modules.filter((module) => module.requiresHumanApproval).length,
    autoRunnable: modules.filter((module) => module.canAutoRun).map((module) => module.key),
    criticalRiskModules: modules
      .filter((module) => module.riskLevel === "critical")
      .map((module) => module.key),
  };
}
