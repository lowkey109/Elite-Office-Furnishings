import { db } from "../../../db";
import { planningRequests, leads } from "../../../../shared/schema";
import { desc, eq } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

export async function runWorkspaceAI(): Promise<DepartmentResult> {
  const actions: string[] = [];
  const blockers: string[] = [];

  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [allRequests, allLeads] = await Promise.all([
      db.select().from(planningRequests).orderBy(desc(planningRequests.createdAt)).limit(500),
      db.select().from(leads).orderBy(desc(leads.createdAt)).limit(500),
    ]);

    const layoutPlanLeads = allLeads.filter(l => l.formType === "layout-plan" || l.officeSize != null);
    const newRequests30d = allRequests.filter(r => new Date(r.createdAt ?? 0) >= since30d);
    const paidRequests = allRequests.filter(r => r.isPaid === true || r.paymentStatus === "paid");
    const unpaidRequests = allRequests.filter(r => !r.isPaid && r.paymentStatus !== "paid");
    const newStatus = allRequests.filter(r => r.status === "New" || r.status === "new");
    const inProgress = allRequests.filter(r => ["In Progress", "in_progress", "Processing"].includes(r.status ?? ""));
    const completed = allRequests.filter(r => ["Complete", "Completed", "completed"].includes(r.status ?? ""));

    const totalEstimatedValue = paidRequests.reduce((sum, r) => {
      const val = r.estimatedValue ? parseInt(r.estimatedValue.replace(/[^0-9]/g, "") || "0", 10) : 0;
      return sum + val;
    }, 0);

    if (allRequests.length > 0) actions.push(`${allRequests.length} total workspace planning requests received`);
    if (newRequests30d.length > 0) actions.push(`${newRequests30d.length} new planning requests in last 30 days`);
    if (paidRequests.length > 0) actions.push(`${paidRequests.length} plans unlocked/paid (value: $${totalEstimatedValue.toLocaleString("en-AU")})`);
    if (completed.length > 0) actions.push(`${completed.length} workspace plans delivered`);
    if (layoutPlanLeads.length > 0) actions.push(`${layoutPlanLeads.length} free layout plan leads captured`);

    if (newStatus.length > 5) blockers.push(`${newStatus.length} workspace requests still in "New" status — need review`);
    if (unpaidRequests.length > 10) blockers.push(`${unpaidRequests.length} unpaid/free plans — conversion opportunity`);
    if (allRequests.length === 0) blockers.push("No workspace planning requests received yet");

    const conversionRate = allRequests.length > 0 ? Math.round((paidRequests.length / allRequests.length) * 100) : 0;

    return {
      department: "Workspace",
      status: actions.length > 0 ? "completed" : "partial",
      actionsTaken: actions,
      blockers,
      metrics: {
        totalRequests: allRequests.length,
        newRequests30d: newRequests30d.length,
        paidUnlocked: paidRequests.length,
        unpaidFree: unpaidRequests.length,
        newStatus: newStatus.length,
        inProgress: inProgress.length,
        completed: completed.length,
        layoutPlanLeads: layoutPlanLeads.length,
        estimatedPaidValueAud: totalEstimatedValue,
        conversionRatePct: conversionRate,
      },
      recommendations: [
        unpaidRequests.length > 0 ? `${unpaidRequests.length} free plans not yet converted — send upgrade prompts` : "All requests are paid",
        newStatus.length > 3 ? "Multiple requests awaiting action — assign to team member" : "Request queue is managed",
        conversionRate < 20 ? "Low plan conversion rate — review paywall messaging" : `Healthy conversion rate (${conversionRate}%)`,
      ],
    };
  } catch (err: any) {
    return {
      department: "Workspace",
      status: "failed",
      actionsTaken: [],
      blockers: [`Workspace AI error: ${err.message}`],
      metrics: {},
      recommendations: [],
    };
  }
}
