/**
 * Outreach Generation Service
 * Generates personalized, signal-based outreach messages using AI.
 * SAFE_MODE: only generates drafts, never sends.
 * All generated content is enforced through templateEnforcer before saving.
 */

import OpenAI from "openai";
import { db } from "../../db";
import {
  outreachMessages,
  outreachEvents,
  outreachThreads,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { enforceTemplate } from "./templateEnforcer";
import { SENDER } from "./senderProfile";

const SAFE_MODE = process.env.SAFE_MODE === "true";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

type MessageType = "intro" | "followup" | "final" | "forward_request";
type OutreachAngle = "lease_timing" | "move_planning" | "market_development" | "general";

interface GenerationContext {
  companyName: string;
  city: string | null;
  industry: string | null;
  contactName?: string | null;
  contactRole?: string | null;
  signals?: string[];
  leaseExpiryTiming?: string | null;
  outreachAngle: OutreachAngle;
  isGenericContact?: boolean;
  stage: number; // 0=intro, 1=followup1, 2=followup2, 3=final
}

function getStageLabel(stage: number): MessageType {
  if (stage === 0) return "intro";
  if (stage === 3) return "final";
  return "followup";
}

function getAngleContext(angle: OutreachAngle): string {
  switch (angle) {
    case "lease_timing":
      return "Their lease is approaching expiry and they may need to plan a fit-out or office move.";
    case "move_planning":
      return "There are strong signals this company is actively planning an office move or expansion.";
    case "market_development":
      return "This suburb/area has high demand and they may benefit from understanding workspace options.";
    default:
      return "They may be in the market for commercial office furniture or a workspace fit-out.";
  }
}

function getSubjectLine(stage: number, companyName: string, angle: OutreachAngle): string {
  if (stage === 0) {
    if (angle === "lease_timing") return `Workspace planning ahead of your lease renewal — ${companyName}`;
    if (angle === "move_planning") return `Office planning support for ${companyName}`;
    return `Premium workspace solutions for ${companyName}`;
  }
  if (stage === 1) return `Following up — workspace planning for ${companyName}`;
  if (stage === 2) return `Quick follow-up — ${companyName} workspace`;
  return `Final note — ${companyName}`;
}

export async function generateOutreachMessage(
  threadId: string,
  context: GenerationContext
): Promise<{ messageId: string; subject: string; body: string }> {
  const stage = context.stage;
  const messageType = getStageLabel(stage);
  const subject = getSubjectLine(stage, context.companyName, context.outreachAngle);
  const angleContext = getAngleContext(context.outreachAngle);

  const sigString = context.signals?.length
    ? `Recent signals detected: ${context.signals.slice(0, 3).join(", ")}.`
    : "";

  const contactFirstName = context.contactName
    ? context.contactName.split(" ")[0]
    : "there";

  const prompt = `You are a sales writer for The Corporate Desk — a premium commercial office furniture and fit-out company in Australia.
The sender is ${SENDER.name} (${SENDER.phone} · ${SENDER.email}).

Write a professional, personalized, SHORT outreach email.

Context:
- Company: ${context.companyName}
- City: ${context.city ?? "Australia"}
- Industry: ${context.industry ?? "unknown"}
- Contact first name: ${contactFirstName}
- Role: ${context.contactRole ?? "Workplace/Operations"}
- Angle: ${angleContext}
- ${sigString}
- Email stage: ${messageType === "intro" ? "First contact" : messageType === "final" ? "Final follow-up" : `Follow-up ${stage}`}
${context.isGenericContact ? `- NOTE: This is going to a general company inbox. Include: "I'm trying to reach the person responsible for workplace planning, facilities, operations, or office strategy. If that's not you, I'd appreciate you forwarding this."` : ""}
${context.leaseExpiryTiming ? `- Lease context: ${context.leaseExpiryTiming}` : ""}

CRITICAL RULES — STRICTLY ENFORCED:
- Start the email with "Hi ${contactFirstName}," on the first line
- Maximum 120 words (body only — not counting the opening greeting)
- Professional but warm tone
- Reference something specific about the company or city
- End with a booking CTA: "Would a 15-minute call be useful? Book here: ${SENDER.calendly}"
- Do NOT be pushy or salesy
- No generic boilerplate
- ABSOLUTELY NO bracket placeholders like [Your Name], [First Name], [Link], etc.
- Write the ACTUAL name "${SENDER.name}" wherever the sender's name is needed
- Return ONLY the email body (no subject line, NO signature — signature is auto-appended)
- Do NOT include any closing like "Best regards, [Name]" — the signature block is handled separately

Write the email body only:`;

  let body = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    } as any);
    body = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[OutreachGeneration] AI generation failed:", err);
    body = buildFallbackMessage(context, subject, stage);
  }

  // ── Template enforcement: replace placeholders + append signature ────────────
  const contactFirstName = context.contactName?.split(" ")[0] ?? null;
  const enforcement = enforceTemplate({ html: body, subject, firstName: contactFirstName });

  let finalBody = body;
  let finalSubject = subject;
  let deliveryStatus: string = "draft";
  let blockingReason: string | null = null;

  if (!enforcement.ok) {
    // Template has unresolved placeholders — save as template_error
    console.error(`[OutreachGeneration] TEMPLATE_ERROR for thread ${threadId}: ${enforcement.reason}`);
    finalBody = body; // save original for debugging
    deliveryStatus = "blocked";
    blockingReason = enforcement.reason;
  } else {
    finalBody = enforcement.html;
    finalSubject = enforcement.subject;
    if (enforcement.wasModified) {
      console.log(`[OutreachGeneration] Template enforced for thread ${threadId} — placeholders resolved + signature appended`);
    }
  }

  // Save message to DB (always as draft unless template error)
  const [msg] = await db.insert(outreachMessages).values({
    threadId,
    direction: "outbound",
    channel: "email",
    subject: finalSubject,
    body: finalBody,
    stage,
    messageType: context.isGenericContact ? "forward_request" : messageType,
    deliveryStatus,
    blockingReason,
  }).returning();

  // Log event
  await db.insert(outreachEvents).values({
    threadId,
    eventType: "message_generated",
    payloadJson: JSON.stringify({ stage, messageType, subject }),
  });

  console.log(`[OutreachGeneration] Generated ${messageType} for thread ${threadId} (stage ${stage}), SAFE_MODE=${SAFE_MODE}, templateOk=${enforcement.ok}`);

  return { messageId: msg.id, subject: finalSubject, body: finalBody };
}

function buildFallbackMessage(ctx: GenerationContext, subject: string, stage: number): string {
  const firstName = ctx.contactName ? ctx.contactName.split(" ")[0] : "there";
  const greeting = `Hi ${firstName},`;
  const fw = ctx.isGenericContact
    ? "\n\nIf you're not the right person for this, I'd appreciate you forwarding this to whoever handles workplace planning, facilities, or office operations."
    : "";

  if (stage === 0) {
    return `${greeting}

I'm reaching out from The Corporate Desk — we help Australian companies create premium, functional workspaces with tailored office furniture solutions.

We've been working with businesses in ${ctx.city ?? "your area"} to plan fit-outs and workspace upgrades, and I thought ${ctx.companyName} might be a great fit.

Would a brief call to explore options make sense? Happy to work around your schedule.${fw}

Book a time: ${SENDER.calendly}`;
  }

  return `${greeting}

Just following up on my previous note about workspace planning at ${ctx.companyName}.${fw}

If the timing isn't right, no problem — happy to reconnect when it suits you.

Book a time: ${SENDER.calendly}`;
}

export async function generateFullSequence(
  threadId: string,
  context: Omit<GenerationContext, "stage">
): Promise<{ stages: number; messages: string[] }> {
  const stages = [0, 1, 2, 3];
  const messageIds: string[] = [];

  for (const stage of stages) {
    const { messageId } = await generateOutreachMessage(threadId, { ...context, stage });
    messageIds.push(messageId);
  }

  return { stages: stages.length, messages: messageIds };
}

export async function getOutreachStats() {
  const messages = await db.select().from(outreachMessages).limit(2000);
  const threads = await db.select().from(outreachThreads).limit(1000);

  const drafts = messages.filter(m => m.deliveryStatus === "draft").length;
  const sent = messages.filter(m => m.deliveryStatus === "sent").length;
  const opened = messages.filter(m => m.openedAt !== null).length;
  const replied = messages.filter(m => m.repliedAt !== null).length;
  const failed = messages.filter(m => m.deliveryStatus === "failed").length;

  const activeThreads = threads.filter(t => t.status === "active").length;
  const bookedThreads = threads.filter(t => t.status === "booked").length;
  const repliedThreads = threads.filter(t => t.status === "replied").length;

  return {
    drafts,
    sent,
    opened,
    replied,
    failed,
    replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
    activeThreads,
    bookedThreads,
    repliedThreads,
    totalThreads: threads.length,
    safeMode: SAFE_MODE,
  };
}
