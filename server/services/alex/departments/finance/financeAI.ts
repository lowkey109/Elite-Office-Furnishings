import nina from "./nina.js";
import type { DepartmentContext, DepartmentResult } from "../../companyOrchestrator";

export async function runFinanceAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult> {
  const company = context.companyName ?? "The Corporate Desk";
  const request = context.userRequest ?? "No request provided";

  return {
    department: "finance",
    summary: `${nina.title} reviewed the request for ${company} and focused on margin, pricing, and cash flow.`,
    actions: [
      "Review quote profitability before issue",
      "Check payment terms and deposit requirements",
      "Validate pricing assumptions against target margins",
      `Finance reviewed request: "${request}"`,
    ],
    blockers: [],
    recordsUpdated: ["finance_review_prepared"],
    success: true,
  };
}