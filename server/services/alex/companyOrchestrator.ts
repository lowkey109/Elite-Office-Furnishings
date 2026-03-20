export type DepartmentName =
  | "finance"
  | "clientExperience"
  | "intelligence"
  | "marketing"
  | "operations"
  | "revenueOperations"
  | "supplier"
  | "workspace";

export interface DepartmentContext {
  companyName?: string;
  userRequest?: string;
  safeMode?: boolean;
  leadId?: number | string;
  companyId?: number | string;
  metadata?: Record<string, unknown>;
}

export interface DepartmentResult {
  department: DepartmentName;
  summary: string;
  actions: string[];
  blockers: string[];
  recordsUpdated: string[];
  success: boolean;
}

export interface DepartmentModule {
  run: (context: DepartmentContext) => Promise<DepartmentResult>;
}

import { runFinanceAI } from "./departments/finance/financeAI.js";
import { runClientExperienceAI } from "./departments/clientExperience/clientExperienceAI.js";
import { runIntelligenceAI } from "./departments/intelligence/intelligenceAI.js";
import { runMarketingAI } from "./departments/marketing/marketingAI.js";
import { runOperationsAI } from "./departments/operations/operationsAI.js";
import { runSalesAI } from "./departments/revenueOperations/salesAI.js";
import { runSupplierAI } from "./departments/supplier/supplierAI.js";
import { runWorkspaceAI } from "./departments/workspace/workspaceAI.js";

const departmentRegistry: Record<DepartmentName, DepartmentModule> = {
  finance: { run: runFinanceAI },
  clientExperience: { run: runClientExperienceAI },
  intelligence: { run: runIntelligenceAI },
  marketing: { run: runMarketingAI },
  operations: { run: runOperationsAI },
  revenueOperations: { run: runSalesAI },
  supplier: { run: runSupplierAI },
  workspace: { run: runWorkspaceAI },
};

export async function runDepartment(
  department: DepartmentName,
  context: DepartmentContext = {},
): Promise<DepartmentResult> {
  const module = departmentRegistry[department];

  if (!module) {
    return {
      department,
      summary: `Department "${department}" is not registered.`,
      actions: [],
      blockers: [`Department "${department}" is missing from the registry.`],
      recordsUpdated: [],
      success: false,
    };
  }

  try {
    return await module.run(context);
  } catch (error) {
    return {
      department,
      summary: `Department "${department}" failed during execution.`,
      actions: [],
      blockers: [
        error instanceof Error ? error.message : "Unknown department error",
      ],
      recordsUpdated: [],
      success: false,
    };
  }
}

export async function runDepartments(
  departments: DepartmentName[],
  context: DepartmentContext = {},
): Promise<DepartmentResult[]> {
  const uniqueDepartments = [...new Set(departments)];
  const results: DepartmentResult[] = [];

  for (const department of uniqueDepartments) {
    results.push(await runDepartment(department, context));
  }

  return results;
}

export interface CompanyOrchestrationResult {
  success: boolean;
  summary: string;
  departments: DepartmentName[];
  results: DepartmentResult[];
  durationMs: number;
  totals: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export async function orchestrateCompany(
  departments: DepartmentName[],
  context: DepartmentContext = {},
): Promise<CompanyOrchestrationResult> {
  const startedAt = Date.now();
  const results = await runDepartments(departments, context);

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.length - succeeded;

  return {
    success: failed === 0,
    summary: `Ran ${results.length} department(s): ${succeeded} succeeded, ${failed} failed.`,
    departments,
    results,
    durationMs: Date.now() - startedAt,
    totals: {
      total: results.length,
      succeeded,
      failed,
    },
  };
}