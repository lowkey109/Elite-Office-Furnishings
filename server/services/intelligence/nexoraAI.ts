import OpenAI from "openai";
import type { DealHunterSignalLike, NormalizedAIDecision } from "./nexora/nexora-types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type AIAgentType = "value-forecaster" | "risk-analyst" | "intent-detector" | "market-dynamics";

interface NexoraAIInput extends DealHunterSignalLike {
  agent: AIAgentType;
  fallbackDecision: NormalizedAIDecision;
}

const AGENT_PROMPTS: Record<AIAgentType, string> = {
  "value-forecaster": `You are a B2B deal value forecaster. Analyse this workspace/office relocation or fit-out signal and estimate the deal action and priority. Return JSON: { "action": "pipeline"|"radar"|"both"|"hold", "priority": "critical"|"high"|"medium"|"low", "reason": string, "confidence": 0-1 }`,
  "risk-analyst": `You are a B2B deal risk analyst. Analyse this workspace signal for risk factors. Determine if we should pursue (pipeline), monitor (radar), both, or hold. Return JSON: { "action": "pipeline"|"radar"|"both"|"hold", "priority": "critical"|"high"|"medium"|"low", "reason": string, "confidence": 0-1 }`,
  "intent-detector": `You are a B2B purchase intent detector. Analyse this workspace signal and determine buyer intent strength. Return JSON: { "action": "pipeline"|"radar"|"both"|"hold", "priority": "critical"|"high"|"medium"|"low", "reason": string, "confidence": 0-1 }`,
  "market-dynamics": `You are a commercial real estate market dynamics analyst. Analyse this signal in context of market conditions. Return JSON: { "action": "pipeline"|"radar"|"both"|"hold", "priority": "critical"|"high"|"medium"|"low", "reason": string, "confidence": 0-1 }`,
};

export async function nexoraAIAnalysis(input: NexoraAIInput): Promise<NormalizedAIDecision> {
  const { agent, fallbackDecision, ...signal } = input;

  const systemPrompt = AGENT_PROMPTS[agent] ?? AGENT_PROMPTS["value-forecaster"];

  const userContent = `Signal data:
Company: ${signal.companyName ?? "unknown"}
City: ${signal.city ?? "unknown"}
Industry: ${signal.industry ?? "unknown"}
Signal Type: ${signal.signalType ?? "unknown"}
Signal Strength: ${signal.signalStrengthScore ?? "unknown"}
Estimated Value: ${signal.estimatedProjectValue ?? "unknown"}
Probability Tier: ${signal.probabilityTier ?? "unknown"}
Summary: ${signal.rawPayloadSummary ?? "no summary"}
Source: ${signal.sourceTitle ?? "unknown"} (${signal.sourceUrl ?? "no URL"})`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    max_tokens: 200,
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<NormalizedAIDecision>;

  const validActions = ["pipeline", "radar", "both", "hold"] as const;
  const validPriorities = ["critical", "high", "medium", "low"] as const;

  const action = validActions.includes(parsed.action as any)
    ? (parsed.action as NormalizedAIDecision["action"])
    : fallbackDecision.action;

  const priority = validPriorities.includes(parsed.priority as any)
    ? (parsed.priority as NormalizedAIDecision["priority"])
    : fallbackDecision.priority;

  const confidence = typeof parsed.confidence === "number"
    ? Math.max(0, Math.min(1, parsed.confidence))
    : fallbackDecision.confidence;

  return {
    action,
    priority,
    reason: parsed.reason ?? fallbackDecision.reason,
    confidence,
  };
}
