import type { DepartmentContext, DepartmentResult } from "../../companyOrchestrator";
import { callAlexDepartmentAI } from "../../alexAiHelper";

const ROLE = "Head of Workspace Strategy";
const DEPARTMENT = "Workspace";

export async function runWorkspaceAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult & { metrics?: Record<string, number | string>; recommendations?: string[]; status?: string; actionsTaken?: string[] }> {
  const company = context.companyName ?? "The Corporate Desk";
  const request = context.userRequest ?? "Run a workspace strategy cycle review.";
  const meta = (context.metadata ?? {}) as Record<string, any>;

  const result = await callAlexDepartmentAI({
    department: DEPARTMENT,
    role: ROLE,
    systemPrompt: `You are the ${ROLE} at The Corporate Desk, an Australian B2B commercial office furniture company.
Your job is to review workspace planning requests, layout intent, furniture strategies, and fit-out timelines.

Respond with a JSON object ONLY. No extra text. Use this exact structure:
{
  "status": "completed" | "partial" | "blocked",
  "summary": "One-sentence summary of this workspace cycle.",
  "actionsTaken": ["action 1", "action 2", "action 3"],
  "blockers": [],
  "metrics": {
    "totalRequests": <number>,
    "paidUnlocked": <number>,
    "avgStaffCount": <number>
  },
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Be specific about workspace strategy priorities based on the pipeline context.`,
    userMessage: `Company: ${company}
Request: ${request}
Business snapshot: ${JSON.stringify(meta)}

Review open workspace planning requests, fit-out intent signals, layout priorities, and concept-to-delivery pathways for active opportunities.`,
    fallbackActions: [
      "Review layout and fit-out intent across open requests",
      "Match furniture strategy to workplace outcome",
      "Highlight design and planning next steps",
    ],
    fallbackMetrics: {
      totalRequests: meta.totalLeads ?? 0,
      paidUnlocked: meta.paidCount ?? 0,
      avgStaffCount: 0,
    },
  });

  return {
    department: "workspace",
    summary: result.summary,
    actions: result.actionsTaken,
    blockers: result.blockers,
    recordsUpdated: ["workspace_ai_run"],
    success: result.status !== "failed",
    metrics: result.metrics,
    recommendations: result.recommendations,
    status: result.status,
    actionsTaken: result.actionsTaken,
  };
}
