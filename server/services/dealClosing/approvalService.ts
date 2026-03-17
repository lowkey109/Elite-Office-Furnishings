import { db } from "../../db";
import { approvals, quotes } from "../../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { pricingEngine, PRICING_RULES } from "./pricingEngine";

export class DealApprovalService {
  async checkAndCreateApproval(quoteId: string, opportunityId?: string): Promise<{ required: boolean; approval?: typeof approvals.$inferSelect; reason?: string }> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    if (!quote) throw new Error(`Quote ${quoteId} not found`);

    const costPrice = quote.costPrice || 0;
    const totalIncGst = quote.totalIncGst || 0;
    const discountPercent = quote.discountPercent || 0;

    const pricing = pricingEngine.calculate({ costPrice, sellPrice: totalIncGst, discountPercent });

    if (!pricing.requiresApproval) return { required: false };

    const existingPending = await db.select().from(approvals)
      .where(eq(approvals.quoteId, quoteId))
      .orderBy(desc(approvals.createdAt))
      .limit(1);

    if (existingPending.length > 0 && existingPending[0].status === "pending") {
      return { required: true, approval: existingPending[0], reason: existingPending[0].triggerReason || undefined };
    }

    const [newApproval] = await db.insert(approvals).values({
      opportunityId: opportunityId || quote.opportunityId || undefined,
      quoteId,
      requiredRole: "admin",
      triggerReason: pricing.approvalReason || "Approval required",
      status: "pending",
      marginAtApproval: Math.round(pricing.marginPercent * 10),
      dealValueAtApproval: pricing.discountedSellPrice,
    }).returning();

    return { required: true, approval: newApproval, reason: pricing.approvalReason };
  }

  async approve(approvalId: string, approvedBy: string): Promise<typeof approvals.$inferSelect> {
    const [updated] = await db.update(approvals)
      .set({ status: "approved", approvedBy, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(approvals.id, approvalId))
      .returning();

    if (updated.quoteId) {
      await db.update(quotes)
        .set({ pipelineStage: "approved", updatedAt: new Date() })
        .where(eq(quotes.id, updated.quoteId));
    }
    return updated;
  }

  async reject(approvalId: string, approvedBy: string, note?: string): Promise<typeof approvals.$inferSelect> {
    const [updated] = await db.update(approvals)
      .set({ status: "rejected", approvedBy, rejectedAt: new Date(), rejectionNote: note || null, updatedAt: new Date() })
      .where(eq(approvals.id, approvalId))
      .returning();
    return updated;
  }

  async getPendingApprovals() {
    const all = await db.select().from(approvals).orderBy(desc(approvals.createdAt));
    return all.filter(a => a.status === "pending");
  }

  async getApprovalStats() {
    const all = await db.select().from(approvals);
    return {
      total: all.length,
      pending: all.filter(a => a.status === "pending").length,
      approved: all.filter(a => a.status === "approved").length,
      rejected: all.filter(a => a.status === "rejected").length,
    };
  }

  async listApprovals(filters?: { status?: string }) {
    const all = await db.select().from(approvals).orderBy(desc(approvals.createdAt));
    if (filters?.status) return all.filter(a => a.status === filters.status);
    return all;
  }
}

export const dealApprovalService = new DealApprovalService();
