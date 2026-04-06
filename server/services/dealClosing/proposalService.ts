import { db } from "../../db";
import { quotes, proposals } from "@shared/schema";
import { eq } from "drizzle-orm";

interface ProposalContent {
  clientName: string;
  companyName?: string;
  email?: string;
  validityDays?: number;
  totalIncGst?: number;
}

export async function generateFromQuote(quoteId: string) {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId));

  if (!quote) {
    throw new Error("Quote not found");
  }

  const content: ProposalContent = {
    clientName: (quote as any).clientName || quote.companyName || "Client",
    companyName: quote.companyName || undefined,
    email: quote.email || undefined,
    validityDays: 30,
    totalIncGst: (quote as any).totalIncGst || 0,
  };

  const htmlContent = `<h1>Proposal for ${content.clientName}</h1>`;

  // ✅ FIXED INSERT (clientName REQUIRED, no quoteId)
  const [proposal] = await db.insert(proposals).values({
    clientName: content.clientName,
    companyName: content.companyName || null,
    email: content.email || null,
    htmlContent,
    contentJson: JSON.stringify(content),
    status: "draft",
    validUntil: new Date(
      Date.now() + (content.validityDays || 30) * 24 * 60 * 60 * 1000
    ),
  } as any).returning();

  await db.update(quotes)
    .set({
      pipelineStage: "proposal_sent",
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId));

  // ✅ FIXED STRIPE BLOCK
  try {
    if (content.totalIncGst && content.totalIncGst > 0) {
      const { createPaymentLink } = await import("../stripe/paymentLinkService");

      await createPaymentLink({
        quoteId,
        clientName: content.clientName,
        clientEmail: content.email || undefined,
        amount: content.totalIncGst,
        linkType: "full",
      } as any);
    }
  } catch (err: any) {
    console.warn("Stripe link failed:", err?.message);
  }

  return proposal;
}
