import type { DepartmentContext, DepartmentResult } from "../../companyOrchestrator";

const AGENT_TITLE = "Head of Workspace Strategy";

export async function runWorkspaceAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult> {
  return {
    department: "workspace",
    summary: `${AGENT_TITLE} prepared a workspace strategy response.`,
    actions: [
      "Review layout and fit-out intent",
      "Match furniture strategy to workplace outcome",
      "Highlight design and planning next step",
      "Prepare concept-to-delivery pathway",
    ],
    blockers: [],
    recordsUpdated: ["workspace_strategy_prepared"],
    success: true,
  };
}