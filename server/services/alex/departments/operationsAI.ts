import { db } from "../../../db";
import { scheduledJobs, websiteIssues, outreachMessages, auditLogs } from "../../../../shared/schema";
import { desc, eq } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

export async function runOperationsAI(): Promise<DepartmentResult> {
  const actions: string[] = [];
  const blockers: string[] = [];

  try {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [jobs, issues, templateErrors, recentAudit] = await Promise.all([
      db.select().from(scheduledJobs).orderBy(desc(scheduledJobs.createdAt)).limit(200),
      db.select().from(websiteIssues).limit(200),
      db.select().from(outreachMessages)
        .where(eq(outreachMessages.deliveryStatus, "template_error"))
        .limit(100),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100),
    ]);

    const failedJobs = jobs.filter(j => j.status === "failed");
    const pendingJobs = jobs.filter(j => j.status === "pending" || j.status === "running");
    const completedJobs = jobs.filter(j => j.status === "completed");
    const openIssues = issues.filter(i => i.status === "open" || i.status === "detected");
    const resolvedIssues = issues.filter(i => i.status === "resolved");
    const recentAuditActions = recentAudit.filter(a => new Date(a.createdAt ?? 0) >= since7d);

    if (completedJobs.length > 0) actions.push(`${completedJobs.length} scheduled jobs completed successfully`);
    if (resolvedIssues.length > 0) actions.push(`${resolvedIssues.length} website issues resolved`);
    if (recentAuditActions.length > 0) actions.push(`${recentAuditActions.length} admin actions logged in last 7 days`);
    if (pendingJobs.length > 0) actions.push(`${pendingJobs.length} jobs currently running or pending`);

    if (failedJobs.length > 0) blockers.push(`${failedJobs.length} scheduled jobs failed — check job logs`);
    if (openIssues.length > 0) blockers.push(`${openIssues.length} website issues still open`);
    if (templateErrors.length > 0) blockers.push(`${templateErrors.length} outreach template errors need backfill (call POST /api/admin/outreach/backfill-templates)`);

    const systemHealth = failedJobs.length === 0 && openIssues.length === 0 ? "healthy" :
      (failedJobs.length <= 2 && openIssues.length <= 2) ? "degraded" : "critical";

    return {
      department: "Operations",
      status: systemHealth === "healthy" ? "completed" : systemHealth === "degraded" ? "partial" : "blocked",
      actionsTaken: actions,
      blockers,
      metrics: {
        totalJobs: jobs.length,
        completedJobs: completedJobs.length,
        failedJobs: failedJobs.length,
        pendingJobs: pendingJobs.length,
        openWebsiteIssues: openIssues.length,
        resolvedWebsiteIssues: resolvedIssues.length,
        templateErrors: templateErrors.length,
        recentAdminActions: recentAuditActions.length,
        systemHealth,
      },
      recommendations: [
        failedJobs.length > 0 ? `Investigate ${failedJobs.length} failed jobs in scheduler` : "Job scheduler is healthy",
        templateErrors.length > 0 ? "Run backfill to fix template errors before next send cycle" : "All outreach templates are clean",
        openIssues.length > 3 ? "Multiple website issues open — review and prioritise fixes" : "Website issue queue is manageable",
      ],
    };
  } catch (err: any) {
    return {
      department: "Operations",
      status: "failed",
      actionsTaken: [],
      blockers: [`Operations AI error: ${err.message}`],
      metrics: {},
      recommendations: [],
    };
  }
}
