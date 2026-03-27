import type { DepartmentContext, DepartmentResult } from "../../../companyOrchestrator";
import { callAlexDepartmentAI } from "../../../alexAiHelper";

const ROLE = "Head of Revenue Operations";
const DEPARTMENT = "Sales";

export async function runOperationsAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult & { metrics?: Record<string, number | string>; recommendations?: string[]; status?: string; actionsTaken?: string[] }> {
  const company = context.companyName ?? "The Corporate Desk";
  const request = context.userRequest ?? "Run a revenue operations cycle review.";
  const meta = (context.metadata ?? {}) as Record<string, any>;
  const safeMode = context.safeMode ?? true;

  const result = await callAlexDepartmentAI({
    department: DEPARTMENT,
    role: ROLE,
    systemPrompt: `You are the ${ROLE} at The Corporate Desk, an Australian B2B commercial office furniture company.
Your job is to review the sales pipeline, deal velocity, follow-up priorities, and revenue forecast.

Safe mode: ${safeMode ? "ON (review only)" : "OFF (autonomous mode)"}.

Respond with a JSON object ONLY. No extra text. Use this exact structure:
{
  "status": "completed" | "partial" | "blocked",
  "summary": "One-sentence summary of this sales cycle.",
  "actionsTaken": ["action 1", "action 2", "action 3"],
  "blockers": [],
  "metrics": {
    "activeDeals": <number>,
    "pipelineValueAud": <number>,
    "dealsNeedingAction": <number>
  },
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Identify which deals need immediate action and what the revenue forecast looks like.`,
    userMessage: `Company: ${company}
Request: ${request}
Business snapshot: ${JSON.stringify(meta)}

Review deal stage velocity, identify pipeline gaps and follow-up priorities, and prepare outreach or quote escalation recommendations.`,
    fallbackActions: [
      "Review deal stage and velocity across active pipeline",
      "Identify pipeline gaps and follow-up priorities",
      "Prepare outreach or quote escalation path",
    ],
    fallbackMetrics: {
      activeDeals: meta.totalLeads ?? 0,
      pipelineValueAud: meta.totalPipelineValue ?? 0,
      dealsNeedingAction: meta.highValueLeads ?? 0,
    },
  });

  return {
    department: "operations",
    summary: result.summary,
    actions: result.actionsTaken,
    blockers: result.blockers,
    recordsUpdated: ["operations_ai_run"],
    success: result.status !== "failed",
    metrics: result.metrics,
    recommendations: result.recommendations,
    status: result.status,
    actionsTaken: result.actionsTaken,
  };
}
