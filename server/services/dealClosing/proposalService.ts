import { desc } from "drizzle-orm";
import { db } from "../../db";
import { quotes, proposals } from "@shared/schema";
import { eq } from "drizzle-orm";

interface ProposalContent {
  clientName: string;
  companyName?: string;
  email?: string;
  staffCount?: number | null;
  subtotal?: number | null;
  freightCost?: number | null;
  installationCost?: number | null;
  otherCosts?: number | null;
  discount?: number | null;
  gst?: number | null;
  totalIncGst?: number | null;
  validityDays?: number | null;
  preparedBy?: string | null;
  quoteItems?: unknown;
}

export class ProposalService {
  async generateFromQuote(quoteId: string, options?: { opportunityId?: string; title?: string }): Promise<typeof proposals.$inferSelect> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    if (!quote) throw new Error(`Quote ${quoteId} not found`);

    const existingVersions = await db.select().from(proposals)
      .where(eq(proposals.quoteId, quoteId))
      .orderBy(desc(proposals.version))
      .limit(1);
    const nextVersion = existingVersions.length > 0 ? (existingVersions[0].version + 1) : 1;

    const content: ProposalContent = {
      clientName: quote.clientName,
      companyName: quote.companyName || undefined,
      email: quote.email,
      staffCount: quote.staffCount || undefined,
      subtotal: quote.subtotal || 0,
      freightCost: quote.freightCost || 0,
      installationCost: quote.installationCost || 0,
      otherCosts: quote.otherCosts || 0,
      discount: quote.discount || 0,
      gst: quote.gst || 0,
      totalIncGst: quote.totalIncGst || 0,
      validityDays: quote.validityDays || 30,
      preparedBy: quote.preparedBy || "The Corporate Desk",
      quoteItems: quote.quoteItems || undefined,
    };

    const htmlContent = generateHtmlProposal(content as unknown as Record<string, unknown>);

    const [newProposal] = await db.insert(proposals).values({
      quoteId,
      version: nextVersion,
      title: options?.title || `Workspace Proposal – ${content.companyName || content.clientName}`,
      clientName: content.clientName,
      companyName: content.companyName || undefined,
      email: content.email || undefined,
      htmlContent,
      contentJson: content as unknown as Record<string, unknown>,
      status: "draft",
      validUntil: new Date(Date.now() + (content.validityDays || 30) * 24 * 60 * 60 * 1000),
    }).returning();

    await db.update(quotes).set({ pipelineStage: "proposal_sent", updatedAt: new Date() }).where(eq(quotes.id, quoteId));

    // T003: Auto-attach Stripe payment link to proposal (SAFE_MODE-aware)
    try {
      if (content.totalIncGst && content.totalIncGst > 0) {
        const { createPaymentLink } = await import("../stripe/paymentLinkService");
        const paymentResult = await createPaymentLink({
          quoteId,
          clientName: content.clientName,
          clientEmail: content.email || "billing@thecorporatedesk.com.au",
          companyName: content.companyName,
          opportunityId: options?.opportunityId,
          amount: content.totalIncGst,
          currency: "aud",
          linkType: "full",
          description: `Office Workspace — ${content.companyName || content.clientName}`,
        });
        // Store payment link on proposal (via quote's stripePaymentLinkId on dealExecution if available)
        if (paymentResult.linkUrl && options?.opportunityId) {
          const { dealExecution } = await import("../../../shared/schema");
          await db.update(dealExecution)
            .set({ stripePaymentLinkId: paymentResult.linkId, updatedAt: new Date() })
            .where(eq(dealExecution.companyId, options.opportunityId));
        }
      }
    } catch (_stripeErr) {
      // Non-critical — Stripe link failure should not block proposal generation
    }

    return newProposal;
  }
}


function generateHtmlProposal(content: Record<string, unknown>): string {
  const title = String(content.title ?? content.quoteNumber ?? "Proposal");
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body><pre>${JSON.stringify(content, null, 2)}</pre></body>
</html>`;
}
