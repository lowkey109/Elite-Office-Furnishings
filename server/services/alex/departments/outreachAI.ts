import { db } from "../../../db";
import { outreachThreads, outreachMessages } from "../../../../shared/schema";
import { desc, eq, sql } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

export async function runOutreachAI(): Promise<DepartmentResult> {
  const actions: string[] = [];
  const blockers: string[] = [];

  try {
    const [threads, messages] = await Promise.all([
      db.select().from(outreachThreads).orderBy(desc(outreachThreads.updatedAt)).limit(500),
      db.select().from(outreachMessages).orderBy(desc(outreachMessages.createdAt)).limit(1000),
    ]);

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const draftMessages = messages.filter(m => m.deliveryStatus === "draft" && m.direction === "outbound");
    const sentMessages = messages.filter(m => m.deliveryStatus === "sent" && m.direction === "outbound");
    const failedMessages = messages.filter(m => m.deliveryStatus === "failed" && m.direction === "outbound");
    const templateErrors = messages.filter(m => m.deliveryStatus === "template_error");
    const recentSent = sentMessages.filter(m => new Date(m.createdAt ?? 0) >= since7d);
    const inboundReplies = messages.filter(m => m.direction === "inbound");

    const activeThreads = threads.filter(t => t.status === "active");
    const repliedThreads = threads.filter(t => t.status === "replied");
    const staleThreads = threads.filter(t => {
      const updated = new Date(t.updatedAt ?? 0);
      return t.status === "active" && (Date.now() - updated.getTime()) > 7 * 24 * 60 * 60 * 1000;
    });

    const domainVerified = process.env.OUTREACH_DOMAIN_VERIFIED === "true";

    if (sentMessages.length > 0) actions.push(`${sentMessages.length} outreach emails delivered total`);
    if (recentSent.length > 0) actions.push(`${recentSent.length} emails sent in last 7 days`);
    if (draftMessages.length > 0) actions.push(`${draftMessages.length} messages queued and ready to send`);
    if (repliedThreads.length > 0) actions.push(`${repliedThreads.length} threads have received replies`);
    if (inboundReplies.length > 0) actions.push(`${inboundReplies.length} inbound replies received`);
    if (activeThreads.length > 0) actions.push(`${activeThreads.length} active outreach threads`);

    if (!domainVerified && draftMessages.length > 0) {
      blockers.push(`${draftMessages.length} emails queued but BLOCKED — domain not verified in Resend. Verify thecorporatedesk.au at resend.com/domains then call POST /api/admin/outreach/flush-send`);
    }
    if (failedMessages.length > 0) {
      blockers.push(`${failedMessages.length} outreach emails failed delivery`);
    }
    if (templateErrors.length > 0) {
      blockers.push(`${templateErrors.length} messages have template errors — run backfill`);
    }
    if (staleThreads.length > 0) {
      blockers.push(`${staleThreads.length} threads have had no activity in 7+ days`);
    }

    const replyRate = sentMessages.length > 0 ? Math.round((inboundReplies.length / sentMessages.length) * 100) : 0;

    return {
      department: "Outreach",
      status: blockers.length === 0 ? "completed" : draftMessages.length > 0 ? "partial" : "blocked",
      actionsTaken: actions,
      blockers,
      metrics: {
        totalThreads: threads.length,
        activeThreads: activeThreads.length,
        repliedThreads: repliedThreads.length,
        staleThreads: staleThreads.length,
        totalSent: sentMessages.length,
        recentSent7d: recentSent.length,
        draftQueued: draftMessages.length,
        failedDelivery: failedMessages.length,
        templateErrors: templateErrors.length,
        inboundReplies: inboundReplies.length,
        replyRatePct: replyRate,
        domainVerified: domainVerified ? 1 : 0,
      },
      recommendations: [
        draftMessages.length > 0 && !domainVerified ? "Verify domain in Resend to unlock email sends" : draftMessages.length > 0 ? "Flush queued messages via admin panel" : "Outreach queue is empty — generate new messages",
        staleThreads.length > 3 ? "Several threads gone cold — consider automated follow-up" : "Thread freshness is acceptable",
        replyRate > 5 ? `Good reply rate (${replyRate}%) — focus on converting replies to meetings` : "Low reply rate — consider refreshing email templates",
      ],
    };
  } catch (err: any) {
    return {
      department: "Outreach",
      status: "failed",
      actionsTaken: [],
      blockers: [`Outreach AI error: ${err.message}`],
      metrics: {},
      recommendations: [],
    };
  }
}
