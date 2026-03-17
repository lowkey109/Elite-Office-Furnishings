import { db } from "../../db";
import { commissions, partners } from "../../../shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export class CommissionService {
  async createCommission(input: {
    partnerId: string;
    opportunityId?: string;
    quoteId?: string;
    referralId?: string;
    dealValue: number;
    commissionPercent?: number;
    notes?: string;
  }): Promise<typeof commissions.$inferSelect> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, input.partnerId)).limit(1);
    const commPercent = input.commissionPercent ?? (partner ? 5 : 5);
    const commAmount = Math.round(input.dealValue * (commPercent / 100));

    const [commission] = await db.insert(commissions).values({
      partnerId: input.partnerId,
      opportunityId: input.opportunityId,
      quoteId: input.quoteId,
      referralId: input.referralId,
      dealValue: input.dealValue,
      commissionPercent: commPercent,
      commissionAmount: commAmount,
      currency: "aud",
      status: "pending",
      notes: input.notes,
    }).returning();

    return commission;
  }

  async approveCommission(commissionId: string): Promise<typeof commissions.$inferSelect> {
    const [updated] = await db.update(commissions)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(commissions.id, commissionId))
      .returning();
    return updated;
  }

  async markPaid(commissionId: string, invoiceRef?: string): Promise<typeof commissions.$inferSelect> {
    const [updated] = await db.update(commissions)
      .set({ status: "paid", paidAt: new Date(), invoiceRef: invoiceRef || null, updatedAt: new Date() })
      .where(eq(commissions.id, commissionId))
      .returning();

    if (updated) {
      await db.update(partners)
        .set({ totalRevenueGenerated: sql`${partners.totalRevenueGenerated} + ${updated.dealValue}`, updatedAt: new Date() })
        .where(eq(partners.id, updated.partnerId));
    }
    return updated;
  }

  async getCommissionsByPartner(partnerId: string) {
    const all = await db.select().from(commissions).orderBy(desc(commissions.createdAt));
    return all.filter(c => c.partnerId === partnerId);
  }

  async getCommissionStats() {
    const all = await db.select().from(commissions);
    const pending = all.filter(c => c.status === "pending");
    const approved = all.filter(c => c.status === "approved");
    const paid = all.filter(c => c.status === "paid");
    const totalPayable = [...pending, ...approved].reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
    const totalPaid = paid.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

    return {
      total: all.length,
      pending: pending.length,
      approved: approved.length,
      paid: paid.length,
      totalPayableAud: totalPayable / 100,
      totalPaidAud: totalPaid / 100,
    };
  }

  async listAll(filters?: { status?: string; partnerId?: string }) {
    const all = await db.select().from(commissions).orderBy(desc(commissions.createdAt));
    return all.filter(c => {
      if (filters?.status && c.status !== filters.status) return false;
      if (filters?.partnerId && c.partnerId !== filters.partnerId) return false;
      return true;
    });
  }
}

export const commissionService = new CommissionService();
