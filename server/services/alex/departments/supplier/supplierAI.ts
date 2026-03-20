import mason from "./mason.js";
import type { DepartmentContext, DepartmentResult } from "../../companyOrchestrator";

export async function runSupplierAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult> {
  return {
    department: "supplier",
    summary: `${mason.title} reviewed supplier and procurement implications.`,
    actions: [
      "Check supplier fit for requested outcome",
      "Validate pricing and procurement path",
      "Review stock, lead times, and substitutions",
      "Prepare supplier-side delivery notes",
    ],
    blockers: [],
    recordsUpdated: ["supplier_review_prepared"],
    success: true,
  };
}