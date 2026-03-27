import type { DepartmentContext, DepartmentResult } from "../../companyOrchestrator";
import { callAlexDepartmentAI } from "../../alexAiHelper";

const ROLE = "Head of Supplier Procurement";
const DEPARTMENT = "Operations";

export async function runSupplierAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult & { metrics?: Record<string, number | string>; recommendations?: string[]; status?: string; actionsTaken?: string[] }> {
  const company = context.companyName ?? "The Corporate Desk";
  const request = context.userRequest ?? "Run a supplier and operations cycle review.";
  const meta = (context.metadata ?? {}) as Record<string, any>;

  const result = await callAlexDepartmentAI({
    department: DEPARTMENT,
    role: ROLE,
    systemPrompt: `You are the ${ROLE} at The Corporate Desk, an Australian B2B commercial office furniture company.
Your job is to review supplier relationships, procurement pathways, stock availability, lead times, and delivery execution.

Respond with a JSON object ONLY. No extra text. Use this exact structure:
{
  "status": "completed" | "partial" | "blocked",
  "summary": "One-sentence summary of this operations cycle.",
  "actionsTaken": ["action 1", "action 2", "action 3"],
  "blockers": [],
  "metrics": {
    "activeSuppliers": <number>,
    "pendingOrders": <number>,
    "avgLeadTimeDays": <number>
  },
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Focus on procurement readiness for the current pipeline volume.`,
    userMessage: `Company: ${company}
Request: ${request}
Business snapshot: ${JSON.stringify(meta)}

Review supplier fit for the current pipeline, validate pricing and procurement paths, check stock, lead times, and substitutions.`,
    fallbackActions: [
      "Check supplier fit for requested project outcomes",
      "Validate pricing and procurement paths",
      "Review stock, lead times, and substitutions",
    ],
    fallbackMetrics: {
      activeSuppliers: 0,
      pendingOrders: 0,
      avgLeadTimeDays: 0,
    },
  });

  return {
    department: "supplier",
    summary: result.summary,
    actions: result.actionsTaken,
    blockers: result.blockers,
    recordsUpdated: ["supplier_ai_run"],
    success: result.status !== "failed",
    metrics: result.metrics,
    recommendations: result.recommendations,
    status: result.status,
    actionsTaken: result.actionsTaken,
  };
}
