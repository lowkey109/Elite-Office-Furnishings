import OpenAI from "openai";
import { Resend } from "resend";
import type { Request, Response } from "express";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Cooldown tracking ────────────────────────────────────────────────────────
// Prevents sending to the same supplier more than once per 30 days
const sentCooldowns = new Map<string, number>();
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function isOnCooldown(supplierKey: string): boolean {
  const last = sentCooldowns.get(supplierKey);
  if (!last) return false;
  return Date.now() - last < COOLDOWN_MS;
}

function markSent(supplierKey: string) {
  sentCooldowns.set(supplierKey, Date.now());
}

// ─── Sender identity ─────────────────────────────────────────────────────────
const SENDER_NAME = process.env.OUTREACH_SENDER_NAME || "Ben Mumford";
const SENDER_TITLE = process.env.OUTREACH_SENDER_TITLE || "Director, The Corporate Desk";

// ─── Sanitise AI output ──────────────────────────────────────────────────────
// Replaces any unfilled placeholders like [Your Name], [Name], [Your Title] etc.
function sanitiseEmail(text: string): string {
  return text
    .replace(/\[Your Name\]/gi, SENDER_NAME)
    .replace(/\[Name\]/gi, SENDER_NAME)
    .replace(/\[Your Title\]/gi, SENDER_TITLE)
    .replace(/\[Title\]/gi, SENDER_TITLE)
    .replace(/\[Your Company\]/gi, "The Corporate Desk")
    .replace(/\[Company\]/gi, "The Corporate Desk")
    .replace(/\[Your Position\]/gi, SENDER_TITLE)
    .replace(/\[[^\]]{1,40}\]/g, ""); // strip any remaining unfilled placeholders
}

export async function runManufacturerOutreach(req: Request, res: Response) {
  try {
    const suppliers = [
      {
        name: "Foshan Jinsong Furniture",
        email: "thecorporatedeskservice@gmail.com",
        country: "China",
      },
    ];

    const results: Array<{
      supplier: string;
      email: string;
      message: string;
      status: string;
      emailId?: string;
      error?: string;
    }> = [];

    for (const supplier of suppliers) {
      const supplierKey = `${supplier.name}::${supplier.email}`.toLowerCase();

      // Skip if already emailed recently
      if (isOnCooldown(supplierKey)) {
        results.push({
          supplier: supplier.name,
          email: supplier.email,
          message: "",
          status: "skipped — cooldown active (30 days)",
        });
        console.log(`⏭️  Skipping ${supplier.name} — cooldown active`);
        continue;
      }

      const prompt = `
You are a high-level B2B partnership strategist for a premium office furniture company called The Corporate Desk.
Write a concise, confident supplier outreach email.

Sender details (use these exactly — do NOT use placeholders):
- Name: ${SENDER_NAME}
- Title: ${SENDER_TITLE}
- Company: The Corporate Desk
- Country: Australia

Target manufacturer:
- Company: ${supplier.name}
- Country: ${supplier.country}

Business context:
- The Corporate Desk is an Australian premium office furniture and fit-out company
- We want to explore a supplier/distribution relationship
- We are interested in catalogue access, pricing, minimum order quantities, and onboarding process
- Tone should be professional, commercially sharp, and warm
- Keep it short and useful (3–4 short paragraphs maximum)

IMPORTANT: Sign the email with the sender's real name and title as provided above.
Return ONLY the email body text. No markdown, no subject line, no placeholders.
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const aiContent = completion.choices?.[0]?.message?.content;
      const rawMessage = typeof aiContent === "string" ? aiContent.trim() : "";

      const message = sanitiseEmail(rawMessage) ||
        `Dear ${supplier.name} Team,\n\nI hope this message finds you well. My name is ${SENDER_NAME} and I represent The Corporate Desk, a leading provider of premium office furniture in Australia.\n\nWe are impressed by your product range and believe there is a strong alignment between our businesses. We would like to explore a potential supplier relationship and request access to your product catalogue, pricing details, minimum order quantities, and insights into your onboarding process.\n\nI look forward to the possibility of partnering together.\n\nWarm regards,\n${SENDER_NAME}\n${SENDER_TITLE}\nThe Corporate Desk`;

      const subject = `Supplier partnership enquiry — The Corporate Desk (Australia)`;

      try {
        const sendResult = await resend.emails.send({
          from: process.env.OUTREACH_FROM_EMAIL || "The Corporate Desk <hello@thecorporatedesk.au>",
          to: [supplier.email],
          subject,
          text: message,
          replyTo: process.env.OUTREACH_REPLY_TO || "thecorporatedeskservice@gmail.com",
        });

        markSent(supplierKey);

        results.push({
          supplier: supplier.name,
          email: supplier.email,
          message,
          status: "sent",
          emailId: sendResult.data?.id,
        });

        console.log(`✉️  Manufacturer outreach sent to ${supplier.name}`);
      } catch (sendError: any) {
        results.push({
          supplier: supplier.name,
          email: supplier.email,
          message,
          status: "failed",
          error: sendError?.message || "Email send failed",
        });
      }
    }

    const sentCount = results.filter((r) => r.status === "sent").length;
    const skippedCount = results.filter((r) => r.status.startsWith("skipped")).length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    return res.status(200).json({
      message: `Outreach complete. Sent: ${sentCount}, Skipped (cooldown): ${skippedCount}, Failed: ${failedCount}`,
      results,
    });
  } catch (error: any) {
    console.error("Manufacturer outreach error:", error);
    return res.status(500).json({
      message: error?.message || "Outreach failed",
    });
  }
}
