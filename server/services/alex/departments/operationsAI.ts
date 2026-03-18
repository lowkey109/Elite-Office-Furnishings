/**
 * Operations AI — ACTIVE EXECUTION
 *
 * Real work:
 *  1. Auto-resolve website issues detected >30 days ago (auto_resolved status)
 *  2. Clear stuck 'running' jobs older than 2 hours → mark as failed
 *  3. Detect template errors and report count
 *  4. Return system health score with before/after issue counts
 */

import { db } from "../../../db";
import { scheduledJobs, websiteIssues, outreachMessages, auditLogs } from "../../../../shared/schema";
import { desc, eq, count, sql, and } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

export async function runOperationsAI(): Promise<DepartmentResult> {
  const start = Date.now();
  const actions: string[] = [];
  const blockers: string[] = [];
  const recordsUpdated: string[] = [];

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const staleRunningThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours
  const autoResolveThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

  // ── Before state ──────────────────────────────────────────────────────────────
  const [beforeOpenIssues] = await db.select({ n: count() }).from(websiteIssues)
    .where(sql`${websiteIssues.status} IN ('open', 'detected')`);
  const [beforeFailedJobs] = await db.select({ n: count() }).from(scheduledJobs)
    .where(eq(scheduledJobs.status, "failed"));
  const [beforeRunningJobs] = await db.select({ n: count() }).from(scheduledJobs)
    .where(eq(scheduledJobs.status, "running"));

  const before = {
    openWebsiteIssues: beforeOpenIssues.n,
    failedJobs: beforeFailedJobs.n,
    runningJobs: beforeRunningJobs.n,
  };

  // ── Action 1: Auto-resolve old website issues (>30 days) ─────────────────────
  const oldIssues = await db.select().from(websiteIssues)
    .where(and(
      sql`${websiteIssues.status} IN ('open', 'detected')`,
      sql`${websiteIssues.detectedAt} <= ${autoResolveThreshold.toISOString()}`,
    )).limit(50);

  let autoResolved = 0;
  for (const issue of oldIssues) {
    try {
      await db.update(websiteIssues).set({
        status: "auto_resolved",
        resolvedAt: new Date(),
        resolutionNotes: `Auto-resolved by Alex Operations AI (issue age >30 days, detected: ${issue.detectedAt?.toISOString().slice(0, 10)})`,
      } as any).where(eq(websiteIssues.id, issue.id));
      recordsUpdated.push(`website_issues#${issue.id} (${issue.issueType}): status ${issue.status} → auto_resolved [age >30d]`);
      autoResolved++;
    } catch (err: any) {
      // Some tables may not have resolvedAt — skip without blocking
    }
  }
  if (autoResolved > 0) {
    actions.push(`${autoResolved} stale website issues (>30 days old) auto-resolved`);
  }

  // ── Action 2: Clear stuck 'running' jobs → mark failed ────────────────────────
  const stuckJobs = await db.select().from(scheduledJobs)
    .where(and(
      eq(scheduledJobs.status, "running"),
      sql`${scheduledJobs.createdAt} <= ${staleRunningThreshold.toISOString()}`,
    )).limit(20);

  let unstuck = 0;
  for (const job of stuckJobs) {
    try {
      await db.update(scheduledJobs).set({
        status: "failed",
        errorMessage: "Auto-failed by Alex Operations AI: stuck in running state for >2 hours",
        completedAt: new Date(),
      } as any).where(eq(scheduledJobs.id, job.id));
      recordsUpdated.push(`scheduled_jobs#${job.id} (${job.jobType}): status running → failed [stuck >2h]`);
      unstuck++;
    } catch {}
  }
  if (unstuck > 0) {
    actions.push(`${unstuck} stuck jobs cleared (were in 'running' state for >2 hours)`);
  }

  // ── Read: Template errors and remaining failures ──────────────────────────────
  const [templateErrors] = await db.select({ n: count() }).from(outreachMessages)
    .where(eq(outreachMessages.deliveryStatus, "template_error"));
  const [recentAudit] = await db.select({ n: count() }).from(auditLogs)
    .where(sql`${auditLogs.createdAt} >= ${since7d.toISOString()}`);
  const [afterOpenIssues] = await db.select({ n: count() }).from(websiteIssues)
    .where(sql`${websiteIssues.status} IN ('open', 'detected')`);
  const [afterFailedJobs] = await db.select({ n: count() }).from(scheduledJobs)
    .where(eq(scheduledJobs.status, "failed"));
  const [completedJobs] = await db.select({ n: count() }).from(scheduledJobs)
    .where(eq(scheduledJobs.status, "completed"));
  const [totalJobs] = await db.select({ n: count() }).from(scheduledJobs);

  // ── Blockers: what still needs human attention ────────────────────────────────
  if (afterFailedJobs.n > 0) {
    blockers.push(`${afterFailedJobs.n} scheduled jobs in failed state — review job_type patterns`);
  }
  if (afterOpenIssues.n > 0) {
    blockers.push(`${afterOpenIssues.n} website issues still open (remaining after auto-resolve)`);
  }
  if (templateErrors.n > 0) {
    blockers.push(`${templateErrors.n} outreach messages have template errors — call POST /api/admin/outreach/backfill-templates`);
  }

  if (autoResolved === 0 && unstuck === 0 && afterOpenIssues.n === 0 && afterFailedJobs.n === 0) {
    actions.push("All systems healthy — no issues or stuck jobs found");
  }

  const systemHealth = afterFailedJobs.n === 0 && afterOpenIssues.n === 0 ? "healthy"
    : (afterFailedJobs.n <= 5 && afterOpenIssues.n <= 5) ? "degraded"
    : "critical";

  const after = {
    openWebsiteIssues: afterOpenIssues.n,
    failedJobs: afterFailedJobs.n,
    autoResolved,
    stuckJobsCleared: unstuck,
  };

  const status = systemHealth === "healthy" ? "completed"
    : systemHealth === "degraded" ? "partial"
    : blockers.length > 0 ? "blocked"
    : "partial";

  return {
    department: "Operations",
    status,
    actionsTaken: actions.length > 0 ? actions : ["No operational actions needed"],
    blockers,
    recordsUpdated,
    before,
    after,
    executionMs: Date.now() - start,
    metrics: {
      autoResolved,
      stuckJobsCleared: unstuck,
      openWebsiteIssues: afterOpenIssues.n,
      failedJobs: afterFailedJobs.n,
      completedJobs: completedJobs.n,
      totalJobs: totalJobs.n,
      templateErrors: templateErrors.n,
      recentAdminActions: recentAudit.n,
      systemHealth,
    },
    recommendations: [
      afterFailedJobs.n > 10 ? `High job failure rate (${afterFailedJobs.n}) — check scheduler config and network` : "Job scheduler health acceptable",
      templateErrors.n > 0 ? `Run backfill endpoint to fix ${templateErrors.n} broken outreach templates` : "Outreach templates are clean",
      afterOpenIssues.n > 20 ? "Many open website issues — consider systematic review sprint" : afterOpenIssues.n > 0 ? `${afterOpenIssues.n} issues remaining — review in admin panel` : "Website issue queue is clear",
    ],
  };
}
