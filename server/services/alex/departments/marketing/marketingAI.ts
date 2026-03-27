import type { DepartmentContext, DepartmentResult } from "../../companyOrchestrator";
import { callAlexDepartmentAI } from "../../alexAiHelper";

const ROLE = "Head of Marketing";
const DEPARTMENT = "Marketing";

export async function runMarketingAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult & { metrics?: Record<string, number | string>; recommendations?: string[]; status?: string; actionsTaken?: string[] }> {
  const company = context.companyName ?? "The Corporate Desk";
  const request = context.userRequest ?? "Run a marketing department cycle review.";
  const meta = (context.metadata ?? {}) as Record<string, any>;

  const result = await callAlexDepartmentAI({
    department: DEPARTMENT,
    role: ROLE,
    systemPrompt: `You are the ${ROLE} at The Corporate Desk, an Australian B2B commercial office furniture company.
Your job is to review campaign performance, messaging alignment, lead source quality, and CTA effectiveness.

Respond with a JSON object ONLY. No extra text. Use this exact structure:
{
  "status": "completed" | "partial" | "blocked",
  "summary": "One-sentence summary of this marketing cycle.",
  "actionsTaken": ["action 1", "action 2", "action 3"],
  "blockers": [],
  "metrics": {
    "activeLeadSources": <number>,
    "topSourceName": "<string>",
    "campaignAlignment": "<good|needs_review>"
  },
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Be specific about what marketing actions are most relevant to current pipeline status.`,
    userMessage: `Company: ${company}
Request: ${request}
Business snapshot: ${JSON.stringify(meta)}

Review current marketing funnel, campaign messaging, and lead source quality. Align CTAs with pipeline stage.`,
    fallbackActions: [
      "Clarify offer positioning for current demand",
      "Turn priority messages into campaign-ready language",
      "Align CTAs with active pipeline goals",
    ],
    fallbackMetrics: {
      activeLeadSources: 3,
      topSourceName: "Office Move Radar",
      campaignAlignment: "needs_review",
    },
  });

  return {
    department: "marketing",
    summary: result.summary,
    actions: result.actionsTaken,
    blockers: result.blockers,
    recordsUpdated: ["marketing_ai_run"],
    success: result.status !== "failed",
    metrics: result.metrics,
    recommendations: result.recommendations,
    status: result.status,
    actionsTaken: result.actionsTaken,
  };
}
