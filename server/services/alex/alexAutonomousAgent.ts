import { decideDepartments } from "./alexDecisionEngine.js";
import {
  orchestrateCompany,
  type DepartmentContext,
  type DepartmentName,
} from "./companyOrchestrator.js";

export interface AlexAgentInput {
  request: string;
  companyName?: string;
  safeMode?: boolean;
  leadId?: number | string;
  companyId?: number | string;
  metadata?: Record<string, unknown>;
}

export interface AlexAgentResult {
  agent: "Alex";
  request: string;
  selectedDepartments: DepartmentName[];
  success: boolean;
  summary: string;
  departments: DepartmentName[];
  results: unknown[];
  durationMs: number;
}

export async function runAlexAutonomousAgent(
  input: AlexAgentInput,
): Promise<AlexAgentResult> {
  const departments = decideDepartments(input.request);

  const context: DepartmentContext = {
    companyName: input.companyName,
    userRequest: input.request,
    safeMode: input.safeMode ?? true,
    leadId: input.leadId,
    companyId: input.companyId,
    metadata: input.metadata,
  };

  const run = await orchestrateCompany(departments, context);

  return {
    agent: "Alex",
    request: input.request,
    selectedDepartments: departments,
    ...run,
  };
}

export async function runAlexForSalesOpportunity(params: {
  companyName: string;
  request?: string;
  leadId?: number | string;
  companyId?: number | string;
}) {
  return runAlexAutonomousAgent({
    request:
      params.request ??
      `Review this sales opportunity for ${params.companyName} and decide the next best actions across intelligence, revenue, workspace, and finance.`,
    companyName: params.companyName,
    leadId: params.leadId,
    companyId: params.companyId,
    safeMode: true,
    metadata: {
      trigger: "runAlexForSalesOpportunity",
    },
  });
}