/**
 * TCD AI Company Orchestrator — runTcdAiCompany()
 *
 * The single master entry point that runs all AI departments in sequence,
 * aggregates real outputs, and returns an executive summary.
 *
 * Safety: In-memory lock prevents concurrent runs.
 * Persistence: Every run is written to alex_company_runs table.
 */

import { db } from "../../db";
import { alexCompanyRuns } from "../../../shared/schema";
import { desc, eq } from "drizzle-orm";

import { runIntelligenceAI } from "./departments/intelligenceAI";
import { runSalesAI } from "./departments/salesAI";
import { runOutreachAI } from "./departments/outreachAI";
import { runWorkspaceAI } from "./departments/workspaceAI";
import { runMarketingAI } from "./departments/marketingAI";
import { runOperationsAI } from "./departments/operationsAI";
import { runFinanceAI } from "./departments/financeAI";

// ── Shared type exported to all department files ───────────────────────────────

export interface DepartmentResult {
  department: string;
  status: "completed" | "partial" | "blocked" | "failed" | "skipped";
  actionsTaken: string[];
  blockers: string[];
  metrics: Record<string, number | string>;
  recommendations: string[];
  executionMs: number;
  recordsUpdated: string[]; // human-readable: "deal_execution#abc123: stage signal_detected → contacted"
  before: Record<string, number | string>;
  after: Record<string, number | string>;
}

export interface CompanyRunResult {
  runId: string;
  status: "completed" | "partial" | "failed";
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  departments: DepartmentResult[];
  summary: string;
  totalActionsTaken: number;
  totalBlockers: number;
  allBlockers: string[];
  allRecommendations: string[];
  metrics: Record<string, unknown>;
}

// ── Global run lock (prevents concurrent runs) ─────────────────────────────────

let _isRunning = false;
let _currentRunId: string | null = null;

export function isCompanyRunning(): boolean {
  return _isRunning;
}

export function getCurrentRunId(): string | null {
  return _currentRunId;
}

// ── Main Orchestrator ──────────────────────────────────────────────────────────

export async function runTcdAiCompany(triggeredBy = "manual"): Promise<CompanyRunResult> {
  if (_isRunning) {
    throw new Error("A company run is already in progress. Wait for it to complete.");
  }

  _isRunning = true;
  const startedAt = new Date();

  // Create run record
  const [runRow] = await db.insert(alexCompanyRuns).values({
    status: "running",
    triggeredBy,
    startedAt,
  }).returning();

  _currentRunId = runRow.id;

  console.log(`[TCD Company] ▶ Run started: ${runRow.id} (triggered by: ${triggeredBy})`);

  const departments: DepartmentResult[] = [];

  const runDept = async (name: string, fn: () => Promise<DepartmentResult>) => {
    console.log(`[TCD Company] → Running ${name} AI...`);
    try {
      const result = await fn();
      departments.push(result);
      console.log(`[TCD Company] ✓ ${name}: ${result.status} — ${result.actionsTaken.length} actions, ${result.blockers.length} blockers`);
    } catch (err: any) {
      const failed: DepartmentResult = {
        department: name,
        status: "failed",
        actionsTaken: [],
        blockers: [`Unexpected error: ${err.message}`],
        metrics: {},
        recommendations: [],
      };
      departments.push(failed);
      console.error(`[TCD Company] ✗ ${name} failed:`, err.message);
    }
  };

  // ── Execution order ──────────────────────────────────────────────────────────
  await runDept("Intelligence", runIntelligenceAI);
  await runDept("Sales", runSalesAI);
  await runDept("Outreach", runOutreachAI);
  await runDept("Workspace", runWorkspaceAI);
  await runDept("Marketing", runMarketingAI);
  await runDept("Operations", runOperationsAI);
  await runDept("Finance", runFinanceAI);

  // ── Aggregate results ────────────────────────────────────────────────────────

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  const totalActionsTaken = departments.reduce((s, d) => s + d.actionsTaken.length, 0);
  const allBlockers = departments.flatMap(d => d.blockers);
  const totalBlockers = allBlockers.length;
  const allRecommendations = departments.flatMap(d => d.recommendations);

  const failedDepts = departments.filter(d => d.status === "failed");
  const blockedDepts = departments.filter(d => d.status === "blocked");
  const completedDepts = departments.filter(d => d.status === "completed");

  const overallStatus: CompanyRunResult["status"] =
    failedDepts.length >= 3 ? "failed" :
    blockedDepts.length > 0 || failedDepts.length > 0 ? "partial" :
    "completed";

  // ── Executive summary ────────────────────────────────────────────────────────

  const summary = buildExecutiveSummary(departments, totalActionsTaken, totalBlockers, durationMs);

  // ── Persist aggregated metrics ───────────────────────────────────────────────

  const metricsSnapshot: Record<string, unknown> = {};
  departments.forEach(d => {
    Object.entries(d.metrics).forEach(([k, v]) => {
      metricsSnapshot[`${d.department.toLowerCase()}_${k}`] = v;
    });
  });

  await db.update(alexCompanyRuns).set({
    status: overallStatus,
    completedAt,
    durationMs,
    summary,
    departmentResultsJson: JSON.stringify(departments),
    totalActionsTaken,
    totalBlockers,
  }).where(eq(alexCompanyRuns.id, runRow.id));

  console.log(`[TCD Company] ■ Run complete: ${runRow.id} — ${overallStatus} in ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`[TCD Company]   Actions: ${totalActionsTaken}, Blockers: ${totalBlockers}`);

  _isRunning = false;
  _currentRunId = null;

  return {
    runId: runRow.id,
    status: overallStatus,
    startedAt,
    completedAt,
    durationMs,
    departments,
    summary,
    totalActionsTaken,
    totalBlockers,
    allBlockers,
    allRecommendations,
    metrics: metricsSnapshot,
  };
}

function buildExecutiveSummary(
  departments: DepartmentResult[],
  totalActions: number,
  totalBlockers: number,
  durationMs: number,
): string {
  const lines: string[] = [];

  lines.push(`TCD AI Company ran all 7 departments in ${(durationMs / 1000).toFixed(1)}s.`);
  lines.push(`${totalActions} total actions recorded across the business.`);

  const completedNames = departments.filter(d => d.status === "completed").map(d => d.department);
  const blockedNames = departments.filter(d => d.status === "blocked" || d.status === "failed").map(d => d.department);
  const partialNames = departments.filter(d => d.status === "partial").map(d => d.department);

  if (completedNames.length > 0) lines.push(`Departments fully operational: ${completedNames.join(", ")}.`);
  if (partialNames.length > 0) lines.push(`Partial status (data gaps): ${partialNames.join(", ")}.`);
  if (blockedNames.length > 0) lines.push(`Blocked/failed: ${blockedNames.join(", ")} — review blockers.`);

  if (totalBlockers === 0) {
    lines.push("No blockers detected. System is operating cleanly.");
  } else {
    lines.push(`${totalBlockers} blockers require attention — see department details.`);
  }

  // Highlight top insight per department
  const topInsights = departments
    .filter(d => d.actionsTaken.length > 0)
    .map(d => `${d.department}: ${d.actionsTaken[0]}`);

  if (topInsights.length > 0) {
    lines.push("Key findings: " + topInsights.slice(0, 4).join(" | "));
  }

  return lines.join(" ");
}

// ── Run History ────────────────────────────────────────────────────────────────

export async function getCompanyRunHistory(limit = 20): Promise<typeof alexCompanyRuns.$inferSelect[]> {
  return db.select().from(alexCompanyRuns)
    .orderBy(desc(alexCompanyRuns.startedAt))
    .limit(limit);
}

export async function getLatestCompanyRun(): Promise<typeof alexCompanyRuns.$inferSelect | null> {
  const [row] = await db.select().from(alexCompanyRuns)
    .orderBy(desc(alexCompanyRuns.startedAt))
    .limit(1);
  return row ?? null;
}
