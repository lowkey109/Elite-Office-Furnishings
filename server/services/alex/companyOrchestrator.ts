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

import { runFinanceAI } from "./departments/finance/financeAI";
import { runClientExperienceAI } from "./departments/clientExperience/clientExperienceRunner";
import { runIntelligenceAI } from "./departments/intelligence/intelligenceAI";
import { runMarketingAI } from "./departments/marketing/marketingAI";
import { runOperationsAI } from "./departments/operations/revenueOperations/operationsAI";
import { runSalesAI } from "./departments/operations/revenueOperations/salesAI";
import { runSupplierAI } from "./departments/supplier/supplierAI";
import { runWorkspaceAI } from "./departments/workspace/workspaceAI";

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

// ─── TCD Company Run (Full AI Orchestration) ─────────────────────────────────

let _companyRunning = false;
let _currentRunId: string | null = null;

export function isCompanyRunning(): boolean {
  return _companyRunning;
}

export function getCurrentRunId(): string | null {
  return _currentRunId;
}

export async function getLatestCompanyRun() {
  try {
    const { db } = await import("../db");
    const { alexCompanyRuns } = await import("../../../shared/schema");
    const { desc } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(alexCompanyRuns)
      .orderBy(desc(alexCompanyRuns.createdAt))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getCompanyRunHistory(limit = 20) {
  try {
    const { db } = await import("../db");
    const { alexCompanyRuns } = await import("../../../shared/schema");
    const { desc } = await import("drizzle-orm");
    return db
      .select()
      .from(alexCompanyRuns)
      .orderBy(desc(alexCompanyRuns.createdAt))
      .limit(Math.min(limit, 50));
  } catch {
    return [];
  }
}

async function getBusinessSnapshot() {
  try {
    const { db } = await import("../db");
    const { planningRequests, leadOutreach } = await import("../../../shared/schema");

    const requests = await db.select().from(planningRequests);

    const STYLE_RATES: Record<string, number> = {
      "Luxury Executive": 1500,
      "Corporate Prestige": 1200,
      "Modern Open Plan": 950,
      "Warm Timber / Premium": 1100,
      Minimal: 800,
      "Mixed / Flexible": 900,
    };

    let totalPipelineValue = 0;
    let highValueLeads = 0;
    const recentLeadCompanies: string[] = [];

    for (const r of requests) {
      const sqm = parseFloat(r.squareMetres || "0");
      const rate = STYLE_RATES[r.stylePreference || ""] ?? 900;
      const value = sqm >= 20 ? Math.round(sqm * rate) : 0;
      totalPipelineValue += value;
      if (value >= 80000) highValueLeads++;
      if (r.companyName && recentLeadCompanies.length < 5) {
        recentLeadCompanies.push(r.companyName);
      }
    }

    let outreachSent = 0;
    let outreachDrafted = 0;
    try {
      const outreachRows = await db.select().from(leadOutreach);
      outreachSent = outreachRows.filter((o) => o.status === "sent").length;
      outreachDrafted = outreachRows.filter((o) => o.status === "draft").length;
    } catch {}

    return {
      totalLeads: requests.length,
      highValueLeads,
      totalPipelineValue,
      avgLeadScore: 0,
      stageCounts: {
        New: requests.filter((r) => r.status === "New").length,
        "In Review": requests.filter((r) => r.status === "In Review").length,
        Quoted: requests.filter((r) => r.status === "Quoted").length,
        Converted: requests.filter((r) => r.status === "Converted").length,
      },
      paidCount: requests.filter((r) => r.isPaid).length,
      outreachSent,
      outreachDrafted,
      recentLeadCompanies,
    };
  } catch {
    return {
      totalLeads: 0,
      highValueLeads: 0,
      totalPipelineValue: 0,
      avgLeadScore: 0,
      stageCounts: {},
      paidCount: 0,
      outreachSent: 0,
      outreachDrafted: 0,
      recentLeadCompanies: [],
    };
  }
}

export async function runTcdAiCompany(triggeredBy = "manual") {
  if (_companyRunning) {
    throw new Error("A company run is already in progress.");
  }

  _companyRunning = true;
  const startedAt = Date.now();
  let runId: string | null = null;

  try {
    const { db } = await import("../db");
    const { alexCompanyRuns } = await import("../../../shared/schema");

    const [runRow] = await db
      .insert(alexCompanyRuns)
      .values({ status: "running", triggeredBy })
      .returning();
    runId = runRow.id;
    _currentRunId = runId;

    console.log(`[TCD Company] Run ${runId} started by "${triggeredBy}"`);

    const snapshot = await getBusinessSnapshot();
    console.log(`[TCD Company] Business snapshot: ${JSON.stringify(snapshot)}`);

    const context: DepartmentContext = {
      companyName: "The Corporate Desk",
      userRequest: `Full company AI cycle. Snapshot: ${JSON.stringify(snapshot)}`,
      safeMode: true,
      metadata: snapshot as unknown as Record<string, unknown>,
    };

    const deptNames: DepartmentName[] = [
      "intelligence",
      "operations",
      "clientExperience",
      "workspace",
      "marketing",
      "supplier",
      "finance",
    ];

    const results = await runDepartments(deptNames, context);

    const DEPT_DISPLAY_NAME: Record<string, string> = {
      finance: "Finance",
      intelligence: "Intelligence",
      operations: "Sales",
      clientExperience: "Outreach",
      workspace: "Workspace",
      marketing: "Marketing",
      supplier: "Operations",
      revenueOperations: "Sales",
    };

    const departmentResults = results.map((r) => {
      const ext = r as DepartmentResult & {
        metrics?: Record<string, number | string>;
        recommendations?: string[];
        status?: string;
        actionsTaken?: string[];
      };
      const rawDept = (ext as any).department as string;
      return {
        department: DEPT_DISPLAY_NAME[rawDept] ?? rawDept,
        status: ext.status ?? (r.success ? "completed" : "failed"),
        actionsTaken: ext.actionsTaken ?? r.actions,
        blockers: r.blockers,
        metrics: ext.metrics ?? {},
        recommendations: ext.recommendations ?? [],
        summary: r.summary,
      };
    });

    const totalActionsTaken = departmentResults.reduce(
      (s, d) => s + (d.actionsTaken?.length ?? 0),
      0,
    );
    const totalBlockers = departmentResults.reduce(
      (s, d) => s + (d.blockers?.length ?? 0),
      0,
    );
    const allSucceeded = results.every((r) => r.success);
    const finalStatus = allSucceeded ? "completed" : "partial";

    const summary = `TCD AI Company run completed. ${deptNames.length} departments active. ${totalActionsTaken} actions taken, ${totalBlockers} blocker(s) identified. Pipeline: $${snapshot.totalPipelineValue.toLocaleString()} across ${snapshot.totalLeads} leads.`;

    const durationMs = Date.now() - startedAt;

    const { eq } = await import("drizzle-orm");
    await db
      .update(alexCompanyRuns)
      .set({
        status: finalStatus,
        completedAt: new Date(),
        durationMs,
        summary,
        departmentResultsJson: JSON.stringify(departmentResults),
        totalActionsTaken,
        totalBlockers,
      })
      .where(eq(alexCompanyRuns.id, runId));

    console.log(`[TCD Company] Run ${runId} completed in ${durationMs}ms. Status: ${finalStatus}`);

    return { runId, status: finalStatus, summary, departmentResults, durationMs };
  } catch (err: any) {
    console.error("[TCD Company] Fatal error:", err.message);
    if (runId) {
      try {
        const { db } = await import("../db");
        const { alexCompanyRuns } = await import("../../../shared/schema");
        const { eq } = await import("drizzle-orm");
        await db
          .update(alexCompanyRuns)
          .set({
            status: "failed",
            completedAt: new Date(),
            durationMs: Date.now() - startedAt,
            summary: `Run failed: ${err.message}`,
          })
          .where(eq(alexCompanyRuns.id, runId));
      } catch {}
    }
    throw err;
  } finally {
    _companyRunning = false;
    _currentRunId = null;
  }
}