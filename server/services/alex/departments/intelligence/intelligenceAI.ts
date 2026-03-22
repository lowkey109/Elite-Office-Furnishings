import type { DepartmentContext, DepartmentResult } from "../../companyOrchestrator";

const AGENT_TITLE = "Head of Intelligence";

export async function runIntelligenceAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult> {
  const safeMode = context.safeMode ?? true;

  return {
    department: "intelligence",
    summary: `${AGENT_TITLE} reviewed the request and prepared an intelligence action path. Safe mode: ${safeMode ? "ON" : "OFF"}.`,
    actions: [
      "Review office-move and expansion signals",
      "Prioritise high-intent companies",
      "Send strongest opportunities to revenue operations",
      "Prepare intelligence notes for follow-up",
    ],
    blockers: [],
    recordsUpdated: ["intelligence_review_prepared"],
    success: true,
  };
}