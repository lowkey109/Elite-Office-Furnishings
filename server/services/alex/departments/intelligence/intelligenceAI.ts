import type { DepartmentContext, DepartmentResult } from "../../companyOrchestrator";
import { callAlexDepartmentAI } from "../../alexAiHelper";

const ROLE = "Head of Intelligence";
const DEPARTMENT = "Intelligence";

export async function runIntelligenceAI(
  context: DepartmentContext = {},
): Promise<DepartmentResult & { metrics?: Record<string, number | string>; recommendations?: string[]; status?: string; actionsTaken?: string[] }> {
  const company = context.companyName ?? "The Corporate Desk";
  const request = context.userRequest ?? "Run an intelligence department cycle review.";
  const meta = (context.metadata ?? {}) as Record<string, any>;
  const safeMode = context.safeMode ?? true;

  const result = await callAlexDepartmentAI({
    department: DEPARTMENT,
    role: ROLE,
    systemPrompt: `You are the ${ROLE} at The Corporate Desk, an Australian B2B commercial office furniture company.
Your job is to analyse market intelligence signals, score leads, detect office move signals, and prioritise high-intent companies.

Safe mode: ${safeMode ? "ON (review only, no automated actions)" : "OFF (full autonomous mode)"}.

Respond with a JSON object ONLY. No extra text. Use this exact structure:
{
  "status": "completed" | "partial" | "blocked",
  "summary": "One-sentence summary of this intelligence cycle.",
  "actionsTaken": ["action 1", "action 2", "action 3"],
  "blockers": [],
  "metrics": {
    "totalLeads": <number>,
    "highIntentLeads": <number>,
    "newSignalsDetected": <number>
  },
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Base your response on the business context provided. Identify the highest-priority intelligence findings.`,
    userMessage: `Company: ${company}
Request: ${request}
Business snapshot: ${JSON.stringify(meta)}

Review office move signals, expand/relocate indicators, and lead scoring. Surface the top opportunities that need immediate attention.`,
    fallbackActions: [
      "Review office-move and expansion signals",
      "Prioritise high-intent companies",
      "Send strongest opportunities to revenue operations",
      "Prepare intelligence notes for follow-up",
    ],
    fallbackMetrics: {
      totalLeads: meta.totalLeads ?? 0,
      highIntentLeads: meta.highValueLeads ?? 0,
      newSignalsDetected: 0,
    },
  });

  return {
    department: "intelligence",
    summary: result.summary,
    actions: result.actionsTaken,
    blockers: result.blockers,
    recordsUpdated: ["intelligence_ai_run"],
    success: result.status !== "failed",
    metrics: result.metrics,
    recommendations: result.recommendations,
    status: result.status,
    actionsTaken: result.actionsTaken,
  };
}
