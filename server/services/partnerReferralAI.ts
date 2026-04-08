import OpenAI from "openai";
import { db } from "../db";
import { partnerReferrals, partnerReferralEvents } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface PartnerReferralAIOutput {
  summary: string;
  fitScore: number;
  urgencyScore: number;
  closeLikelihoodScore: number;
  estimatedValueBand: string;
  priority: "high" | "medium" | "low";
  recommendedOwner: string;
  nextBestAction: string;
  serviceMix: string[];
  riskFlags: string[];
  tags: string[];
}

export async function scorePartnerReferral(referralId: string): Promise<PartnerReferralAIOutput | null> {
  const [referral] = await db.select().from(partnerReferrals).where(eq(partnerReferrals.id, referralId)).limit(1);
  if (!referral) return null;

  const context = `
Company: ${referral.clientCompany || referral.clientName || "Unknown"}
Contact: ${referral.contactName || ""} — ${referral.contactEmail || ""} — ${referral.contactPhone || ""}
Location: ${referral.officeLocation || "Unknown"}
Office Size: ${referral.officeSize || "Unknown"} sqm
Staff Count: ${referral.staffCount || "Unknown"}
Project Type: ${referral.projectType || "Unknown"}
Project Stage: ${referral.projectStage || "Unknown"}
Estimated Value: ${referral.estimatedValue ? `$${referral.estimatedValue.toLocaleString()}` : "Unknown"}
Notes: ${referral.sourceNotes || referral.notes || "None"}
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a senior sales intelligence analyst for The Corporate Desk, a premium Australian commercial office furniture and workspace solutions company. Score referral opportunities for sales prioritisation. Always return valid JSON.`,
        },
        {
          role: "user",
          content: `Score this partner referral for The Corporate Desk and return a JSON object with these exact fields:
- summary: string (2-3 sentence executive brief)
- fitScore: number 0-100 (how well this fits our core offering)
- urgencyScore: number 0-100 (how time-sensitive)
- closeLikelihoodScore: number 0-100 (probability of winning)
- estimatedValueBand: string (e.g. "$20k-$50k")
- priority: "high" | "medium" | "low"
- recommendedOwner: string (e.g. "Ben")
- nextBestAction: string (specific recommended action)
- serviceMix: string[] (array of relevant services e.g. ["furniture supply", "layout planning"])
- riskFlags: string[] (array of risk factors)
- tags: string[] (array of relevant tags e.g. ["brisbane", "relocation", "mid-market"])

Referral data:
${context}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty AI response");

    const parsed = JSON.parse(raw);

    await db.update(partnerReferrals).set({
      aiSummary: parsed.summary || null,
      aiFitScore: Number(parsed.fitScore) || null,
      aiUrgencyScore: Number(parsed.urgencyScore) || null,
      aiCloseLikelihoodScore: Number(parsed.closeLikelihoodScore) || null,
      aiPriority: parsed.priority || null,
      aiRecommendedOwner: parsed.recommendedOwner || null,
      aiNextBestAction: parsed.nextBestAction || null,
      aiTagsJson: Array.isArray(parsed.tags) ? parsed.tags : [],
      aiRiskFlagsJson: Array.isArray(parsed.riskFlags) ? parsed.riskFlags : [],
      updatedAt: new Date(),
    }).where(eq(partnerReferrals.id, referralId));

    await db.insert(partnerReferralEvents).values({
      referralId,
      eventType: "scored",
      eventNote: `AI scored: fit=${parsed.fitScore}, urgency=${parsed.urgencyScore}, close=${parsed.closeLikelihoodScore}`,
      metadataJson: { fitScore: parsed.fitScore, urgencyScore: parsed.urgencyScore, closeLikelihoodScore: parsed.closeLikelihoodScore },
      createdBy: "nexora-ai",
    });

    return {
      summary: parsed.summary,
      fitScore: parsed.fitScore,
      urgencyScore: parsed.urgencyScore,
      closeLikelihoodScore: parsed.closeLikelihoodScore,
      estimatedValueBand: parsed.estimatedValueBand,
      priority: parsed.priority,
      recommendedOwner: parsed.recommendedOwner,
      nextBestAction: parsed.nextBestAction,
      serviceMix: parsed.serviceMix || [],
      riskFlags: parsed.riskFlags || [],
      tags: parsed.tags || [],
    };
  } catch (err: any) {
    console.error("[PartnerReferralAI] Score failed:", err?.message);
    await db.insert(partnerReferralEvents).values({
      referralId,
      eventType: "scored",
      eventNote: `AI scoring failed: ${err?.message}`,
      metadataJson: { error: err?.message },
      createdBy: "nexora-ai",
    });
    return null;
  }
}
