import OpenAI from "openai";

const resolvedApiKey =
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim() ||
  process.env.OPENAI_API_KEY?.trim() ||
  "";

if (!resolvedApiKey) {
  console.warn(
    "[NexoraAI] No OpenAI API key found — AI analysis will be skipped. " +
    "Set AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY to enable it.",
  );
}

const oai = resolvedApiKey
  ? new OpenAI({
      apiKey: resolvedApiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    })
  : null;

export type NexoraAIResponse = {
  action: "pipeline" | "radar" | "both" | "hold";
  priority: "critical" | "high" | "medium" | "low";
  reason: string;
  confidence: number;
};

export async function nexoraAIAnalysis(input: unknown): Promise<NexoraAIResponse | null> {
  if (!oai) {
    console.warn("[NexoraAI] Skipping AI analysis — no API key configured.");
    return null;
  }

  try {
    const resp = await oai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Nexora, a CEO-level commercial opportunity intelligence system. " +
            "Assess office relocation, lease, fit-out, facilities, and growth signals. " +
            "Return only valid JSON with keys: action, priority, reason, confidence. " +
            "Valid action values: pipeline, radar, both, hold. " +
            "Valid priority values: critical, high, medium, low. " +
            "Confidence must be a number from 0 to 100.",
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    });

    const text = resp.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);

    return {
      action: ["pipeline", "radar", "both", "hold"].includes(parsed.action)
        ? parsed.action
        : "hold",
      priority: ["critical", "high", "medium", "low"].includes(parsed.priority)
        ? parsed.priority
        : "low",
      reason: typeof parsed.reason === "string" ? parsed.reason : "No reason returned",
      confidence: Number.isFinite(Number(parsed.confidence))
        ? Math.max(0, Math.min(100, Number(parsed.confidence)))
        : 0,
    };
  } catch (error) {
    console.error("[NEXORA_AI] analysis failed:", error);
    return null;
  }
}