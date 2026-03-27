import type { DepartmentContext, DepartmentResult } from "../../companyOrchestrator";
import { callAlexDepartmentAI } from "../../alexAiHelper";

const ROLE = "Head of Client Experience";
const DEPARTMENT = "Outreach";

export async function runClientExperienceAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult & { metrics?: Record<string, number | string>; recommendations?: string[]; status?: string; actionsTaken?: string[] }> {
  const company = context.companyName ?? "the client";
  const request = context.userRequest ?? "Run a client experience and outreach cycle review.";
  const meta = (context.metadata ?? {}) as Record<string, any>;

  const result = await callAlexDepartmentAI({
    department: DEPARTMENT,
    role: ROLE,
    systemPrompt: `You are the ${ROLE} at The Corporate Desk, an Australian B2B commercial office furniture company.
Your job is to review the outreach pipeline, client communication touchpoints, and follow-up cadences.

Respond with a JSON object ONLY. No extra text. Use this exact structure:
{
  "status": "completed" | "partial" | "blocked",
  "summary": "One-sentence summary of this outreach cycle.",
  "actionsTaken": ["action 1", "action 2", "action 3"],
  "blockers": [],
  "metrics": {
    "totalSent": <number>,
    "draftQueued": <number>,
    "replyRate": <number between 0-100>
  },
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Focus on outreach readiness, stale leads that need follow-up, and messaging quality.`,
    userMessage: `Company: ${company}
Request: ${request}
Business snapshot: ${JSON.stringify(meta)}

Review client communication history, identify stale leads needing follow-up, and assess outreach pipeline health.`,
    fallbackActions: [
      "Review client communication history",
      "Identify next outreach touchpoints for stale leads",
      "Align follow-up messaging with project status",
    ],
    fallbackMetrics: {
      totalSent: meta.outreachSent ?? 0,
      draftQueued: meta.outreachDrafted ?? 0,
      replyRate: 0,
    },
  });

  return {
    department: "clientExperience",
    summary: result.summary,
    actions: result.actionsTaken,
    blockers: result.blockers,
    recordsUpdated: ["client_experience_ai_run"],
    success: result.status !== "failed",
    metrics: result.metrics,
    recommendations: result.recommendations,
    status: result.status,
    actionsTaken: result.actionsTaken,
  };
}
