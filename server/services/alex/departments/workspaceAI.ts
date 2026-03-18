/**
 * Workspace AI — ACTIVE EXECUTION
 *
 * Real work:
 *  1. Find planningRequests in status 'New' → update to 'In Progress'
 *  2. Flag high-value requests (staffCount > 50 or budget > $50k) → set estimatedValue
 *  3. Find free/unpaid requests → compute upgrade opportunity value
 *  4. If no requests → return "skipped" not "completed"
 */

import { db } from "../../../db";
import { planningRequests, leads } from "../../../../shared/schema";
import { desc, eq, count, sql, and, isNull } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

// Budget tier → estimated project value
const BUDGET_VALUE_MAP: Record<string, number> = {
  "Under $10,000": 8000,
  "$10,000 - $30,000": 20000,
  "$30,000 - $80,000": 55000,
  "$80,000 - $150,000": 115000,
  "$150,000 - $300,000": 225000,
  "Over $300,000": 350000,
};

export async function runWorkspaceAI(): Promise<DepartmentResult> {
  const start = Date.now();
  const actions: string[] = [];
  const blockers: string[] = [];
  const recordsUpdated: string[] = [];

  // ── Before state ──────────────────────────────────────────────────────────────
  const allRequests = await db.select().from(planningRequests)
    .orderBy(desc(planningRequests.createdAt)).limit(500);

  const before = {
    totalRequests: allRequests.length,
    newStatus: allRequests.filter(r => r.status === "New").length,
    inProgress: allRequests.filter(r => r.status === "In Progress").length,
    paidRequests: allRequests.filter(r => r.isPaid).length,
  };

  if (allRequests.length === 0) {
    // No requests at all — this is genuinely empty, not an error
    const layoutLeads = await db.select({ n: count() }).from(leads).limit(1);
    return {
      department: "Workspace",
      status: "skipped",
      actionsTaken: ["No planning requests in database — workspace pipeline is empty"],
      blockers: ["planning_requests table is empty — no submissions received yet"],
      recordsUpdated: [],
      before,
      after: { ...before },
      executionMs: Date.now() - start,
      metrics: {
        totalRequests: 0,
        newStatus: 0,
        inProgress: 0,
        paidRequests: 0,
        unpaidRequests: 0,
      },
      recommendations: [
        "Drive traffic to /upload-your-floor-plan to generate planning requests",
        "Check free layout plan form at /free-office-layout-plan",
      ],
    };
  }

  // ── Action 1: Advance 'New' requests → 'In Progress' ─────────────────────────
  const newRequests = allRequests.filter(r => r.status === "New");
  let advanced = 0;
  for (const req of newRequests.slice(0, 20)) {
    try {
      await db.update(planningRequests).set({
        status: "In Progress",
        adminNotes: (req.adminNotes ?? "") + `\n[Alex ${new Date().toISOString()}] Picked up for processing`,
      }).where(eq(planningRequests.id, req.id));
      recordsUpdated.push(`planning_requests#${req.id} (${req.company || req.name}): status New → In Progress`);
      advanced++;
    } catch (err: any) {
      blockers.push(`Could not advance request ${req.id}: ${err.message}`);
    }
  }
  if (advanced > 0) actions.push(`${advanced} planning requests moved from New → In Progress`);

  // ── Action 2: Compute and stamp estimated value where missing ─────────────────
  const needsValue = allRequests.filter(r =>
    !r.estimatedValue &&
    r.budgetRange &&
    BUDGET_VALUE_MAP[r.budgetRange]
  );

  let valued = 0;
  for (const req of needsValue.slice(0, 20)) {
    const estValue = BUDGET_VALUE_MAP[req.budgetRange!];
    try {
      await db.update(planningRequests).set({
        estimatedValue: `$${estValue.toLocaleString("en-AU")}`,
      }).where(eq(planningRequests.id, req.id));
      recordsUpdated.push(`planning_requests#${req.id} (${req.company || req.name}): estimatedValue → $${estValue.toLocaleString("en-AU")} [from budgetRange: ${req.budgetRange}]`);
      valued++;
    } catch {}
  }
  if (valued > 0) actions.push(`${valued} requests had estimated project value stamped from budget range`);

  // ── Action 3: Flag high-value upgrade opportunities (free → paid) ─────────────
  const freePlans = allRequests.filter(r => !r.isPaid && r.paymentStatus !== "paid");
  const upgradeOpportunities = freePlans.filter(r => {
    const staffNum = parseInt(r.staffCount ?? "0", 10);
    const budgetValue = BUDGET_VALUE_MAP[r.budgetRange ?? ""] ?? 0;
    return staffNum >= 20 || budgetValue >= 30000;
  });

  if (upgradeOpportunities.length > 0) {
    const totalOpportunityValue = upgradeOpportunities.reduce((sum, r) => {
      return sum + (BUDGET_VALUE_MAP[r.budgetRange ?? ""] ?? 10000);
    }, 0);
    actions.push(`${upgradeOpportunities.length} free plans are upgrade-ready (staff≥20 or budget≥$30k) — estimated $${totalOpportunityValue.toLocaleString("en-AU")} opportunity`);
  }

  // ── After state ───────────────────────────────────────────────────────────────
  const after = {
    totalRequests: allRequests.length,
    newStatus: newRequests.length - advanced,
    inProgress: before.inProgress + advanced,
    paidRequests: before.paidRequests,
    valueStamped: valued,
    upgradeOpportunities: upgradeOpportunities.length,
  };

  const paidRequests = allRequests.filter(r => r.isPaid);
  const paidValue = paidRequests.reduce((sum, r) => {
    const v = parseInt((r.estimatedValue ?? "$0").replace(/[^0-9]/g, "") || "0", 10);
    return sum + v;
  }, 0);

  const status = actions.length > 0 ? "completed" : "partial";

  return {
    department: "Workspace",
    status,
    actionsTaken: actions.length > 0 ? actions : ["No actionable items — all requests are current"],
    blockers,
    recordsUpdated,
    before,
    after,
    executionMs: Date.now() - start,
    metrics: {
      totalRequests: allRequests.length,
      advancedToInProgress: advanced,
      valueStamped: valued,
      upgradeOpportunities: upgradeOpportunities.length,
      paidRequests: paidRequests.length,
      freeUnpaidRequests: freePlans.length,
      paidValueAud: paidValue,
      conversionRatePct: allRequests.length > 0 ? Math.round((paidRequests.length / allRequests.length) * 100) : 0,
    },
    recommendations: [
      advanced > 0 ? `${advanced} requests now In Progress — assign to team member for design work` : "All requests are already progressed",
      upgradeOpportunities.length > 0 ? `${upgradeOpportunities.length} high-value free plans — send upgrade email sequence` : "No compelling upgrade targets this cycle",
      freePlans.length > paidRequests.length ? "Free plans outnumber paid — conversion focus needed" : "Paid plan ratio is healthy",
    ],
  };
}
