import harper from "./harper.js";
import type { DepartmentContext, DepartmentResult } from "../../companyOrchestrator";

export async function runMarketingAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult> {
  const request = context.userRequest ?? "No request provided";

  return {
    department: "marketing",
    summary: `${harper.title} translated the request into a marketing execution angle.`,
    actions: [
      "Clarify offer positioning",
      "Turn message into campaign-ready language",
      "Align CTA with pipeline goal",
      `Marketing context captured from request: "${request}"`,
    ],
    blockers: [],
    recordsUpdated: ["marketing_plan_prepared"],
    success: true,
  };
}