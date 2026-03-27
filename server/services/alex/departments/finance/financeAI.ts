import type { DepartmentContext, DepartmentResult } from "../../companyOrchestrator";
import { callAlexDepartmentAI } from "../../alexAiHelper";

const ROLE = "Head of Finance";
const DEPARTMENT = "Finance";

export async function runFinanceAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult & { metrics?: Record<string, number | string>; recommendations?: string[]; status?: string; actionsTaken?: string[] }> {
  const company = context.companyName ?? "The Corporate Desk";
  const request = context.userRequest ?? "Run a finance department cycle review.";
  const meta = (context.metadata ?? {}) as Record<string, any>;

  const result = await callAlexDepartmentAI({
    department: DEPARTMENT,
    role: ROLE,
    systemPrompt: `You are the ${ROLE} at The Corporate Desk, an Australian B2B commercial office furniture company.
Your job is to review the financial state of the business each cycle.

Respond with a JSON object ONLY. No extra text. Use this exact structure:
{
  "status": "completed" | "partial" | "blocked",
  "summary": "One-sentence summary of this finance cycle review.",
  "actionsTaken": ["action 1", "action 2", "action 3"],
  "blockers": [],
  "metrics": {
    "totalRevenueAud": <number estimate based on pipeline>,
    "pendingInvoicesAud": <number>,
    "avgDealValueAud": <number>
  },
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Base your response on the business context provided. Be specific and commercial, not generic.`,
    userMessage: `Company: ${company}
Request: ${request}
Pipeline context: ${JSON.stringify(meta)}

Review current financial position, pricing margins, outstanding invoices, and payment terms. Identify any cash flow risks.`,
    fallbackActions: [
      "Review quote profitability before issue",
      "Check payment terms and deposit requirements",
      "Validate pricing assumptions against target margins",
    ],
    fallbackMetrics: {
      totalRevenueAud: meta.totalPipelineValue ?? 0,
      pendingInvoicesAud: 0,
      avgDealValueAud: 0,
    },
  });

  return {
    department: "finance",
    summary: result.summary,
    actions: result.actionsTaken,
    blockers: result.blockers,
    recordsUpdated: ["finance_ai_run"],
    success: result.status !== "failed",
    metrics: result.metrics,
    recommendations: result.recommendations,
    status: result.status,
    actionsTaken: result.actionsTaken,
  };
}
