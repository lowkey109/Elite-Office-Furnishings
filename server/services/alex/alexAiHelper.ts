const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";

const OPENAI_MODEL = "gpt-4o-mini";

export interface TcdDepartmentResult {
  department: string;
  status: "completed" | "partial" | "blocked" | "failed";
  actionsTaken: string[];
  blockers: string[];
  metrics: Record<string, number | string>;
  recommendations: string[];
  summary: string;
}

export interface TcdBusinessSnapshot {
  totalLeads: number;
  highValueLeads: number;
  totalPipelineValue: number;
  avgLeadScore: number;
  stageCounts: Record<string, number>;
  outreachSent: number;
  outreachDrafted: number;
  recentLeadCompanies: string[];
}

export async function callAlexDepartmentAI(params: {
  department: string;
  role: string;
  systemPrompt: string;
  userMessage: string;
  fallbackActions: string[];
  fallbackMetrics: Record<string, number | string>;
}): Promise<TcdDepartmentResult> {
  if (!OPENAI_API_KEY) {
    console.warn(`[Alex ${params.department}] No OpenAI API key — returning fallback.`);
    return {
      department: params.department,
      status: "completed",
      actionsTaken: params.fallbackActions,
      blockers: [],
      metrics: params.fallbackMetrics,
      recommendations: [],
      summary: `${params.role} completed review (AI unavailable).`,
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userMessage },
        ],
        temperature: 0.35,
        max_tokens: 700,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Alex ${params.department}] OpenAI HTTP ${response.status}:`, errText);
      return {
        department: params.department,
        status: "partial",
        actionsTaken: params.fallbackActions,
        blockers: [`AI service error: HTTP ${response.status}`],
        metrics: params.fallbackMetrics,
        recommendations: [],
        summary: `${params.role} completed with limited AI support.`,
      };
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw);

    return {
      department: params.department,
      status: parsed.status ?? "completed",
      actionsTaken: Array.isArray(parsed.actionsTaken) ? parsed.actionsTaken : params.fallbackActions,
      blockers: Array.isArray(parsed.blockers) ? parsed.blockers : [],
      metrics:
        parsed.metrics && typeof parsed.metrics === "object"
          ? parsed.metrics
          : params.fallbackMetrics,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary
          : `${params.role} completed review.`,
    };
  } catch (err: any) {
    console.error(`[Alex ${params.department}] Unexpected error:`, err.message);
    return {
      department: params.department,
      status: "partial",
      actionsTaken: params.fallbackActions,
      blockers: [err.message ?? "Unknown error"],
      metrics: params.fallbackMetrics,
      recommendations: [],
      summary: `${params.role} encountered an error during this cycle.`,
    };
  }
}
