import OpenAI from "openai";
import { Resend } from "resend";
import type { Request, Response } from "express";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

const resend = new Resend(process.env.RESEND_API_KEY);

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
      const prompt = `
You are a high-level B2B partnership strategist for a premium office furniture company called The Corporate Desk.
Write a concise, confident supplier outreach email.
Target manufacturer:
- Company: ${supplier.name}
- Country: ${supplier.country}
Business context:
- The Corporate Desk is an Australian premium office furniture and fit-out company
- We want to explore a supplier/distribution relationship
- We are interested in catalogue access, pricing, minimum order quantities, and onboarding process
- Tone should be professional, commercially sharp, and warm
- Keep it short and useful
Return ONLY the email body text, no markdown, no subject line.
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const aiContent = completion.choices?.[0]?.message?.content;
      const message =
        (typeof aiContent === "string" ? aiContent.trim() : "") ||
        `Hi ${supplier.name},\n\nI'm reaching out from The Corporate Desk in Australia. We'd like to explore a supplier relationship and learn more about your catalogue, pricing, MOQs, and onboarding process.\n\nPlease let me know the best next step.\n\nKind regards,\nBen Mumford\nThe Corporate Desk`;

      const subject = "Supplier partnership enquiry from The Corporate Desk";

      try {
        const sendResult = await resend.emails.send({
          from: process.env.OUTREACH_FROM_EMAIL || "The Corporate Desk <onboarding@resend.dev>",
          to: [supplier.email],
          subject,
          text: message,
          replyTo: process.env.OUTREACH_REPLY_TO || "thecorporatedeskservice@gmail.com",
        });

        results.push({
          supplier: supplier.name,
          email: supplier.email,
          message,
          status: "sent",
          emailId: sendResult.data?.id,
        });
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
    const failedCount = results.filter((r) => r.status === "failed").length;

    return res.status(200).json({
      message: `Outreach complete. Sent: ${sentCount}, Failed: ${failedCount}`,
      results,
    });
  } catch (error: any) {
    console.error("Manufacturer outreach error:", error);
    return res.status(500).json({
      message: error?.message || "Outreach failed",
    });
  }
}