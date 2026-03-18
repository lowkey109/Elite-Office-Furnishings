/**
 * Outreach AI — ACTIVE EXECUTION
 *
 * Real work:
 *  1. Call createOutreachForHighValueOpportunities() → create new threads + draft messages
 *  2. Attempt to flush draft queue:
 *     - LIVE_MODE=true → call sendOutreachEmail for each draft
 *     - LIVE_MODE=false (domain not verified) → mark as safe_mode_queued, report blocked
 *  3. Report queue state, reply rate, stale threads
 *
 * Never simulates sends — if domain is not verified, status is "blocked".
 */

import { db } from "../../../db";
import { outreachThreads, outreachMessages, outreachEvents } from "../../../../shared/schema";
import { desc, eq, and, count, sql } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

const LIVE_MODE = process.env.RESEND_API_KEY !== undefined && process.env.OUTREACH_DOMAIN_VERIFIED === "true";
const MAX_FLUSH = 5; // max emails to send per orchestrator cycle (rate safety)

export async function runOutreachAI(): Promise<DepartmentResult> {
  const start = Date.now();
  const actions: string[] = [];
  const blockers: string[] = [];
  const recordsUpdated: string[] = [];

  // ── Before state ──────────────────────────────────────────────────────────────
  const [beforeThreads] = await db.select({ n: count() }).from(outreachThreads);
  const [beforeDrafts] = await db.select({ n: count() }).from(outreachMessages)
    .where(and(eq(outreachMessages.deliveryStatus, "draft"), eq(outreachMessages.direction, "outbound")));
  const [beforeSent] = await db.select({ n: count() }).from(outreachMessages)
    .where(eq(outreachMessages.deliveryStatus, "sent"));

  const before = {
    totalThreads: beforeThreads.n,
    draftMessages: beforeDrafts.n,
    sentMessages: beforeSent.n,
  };

  // ── Action 1: Create new outreach threads for high-value companies ─────────────
  let threadsCreated = 0;
  try {
    const { createOutreachForHighValueOpportunities } = await import("../../outreach/outreachEngine");
    const result = await createOutreachForHighValueOpportunities();
    threadsCreated = result.created;
    if (threadsCreated > 0) {
      actions.push(`${threadsCreated} new outreach threads created for high-value companies`);
      recordsUpdated.push(`outreach_threads: +${threadsCreated} new threads inserted (with draft messages)`);
    } else {
      actions.push("No new companies ready for outreach (all eligible companies already have active threads)");
    }
  } catch (err: any) {
    blockers.push(`Thread creation error: ${err.message}`);
  }

  // ── Action 2: Flush draft queue (send or report blocked) ─────────────────────
  // Re-read draft count after thread creation (new drafts may have been added)
  const freshDrafts = await db.select({
    id: outreachMessages.id,
    threadId: outreachMessages.threadId,
    subject: outreachMessages.subject,
    createdAt: outreachMessages.createdAt,
  }).from(outreachMessages)
    .innerJoin(outreachThreads, eq(outreachMessages.threadId, outreachThreads.id))
    .where(and(
      eq(outreachMessages.deliveryStatus, "draft"),
      eq(outreachMessages.direction, "outbound"),
      eq(outreachThreads.status, "active"),
    ))
    .orderBy(desc(outreachMessages.createdAt))
    .limit(MAX_FLUSH + 50); // read more than MAX_FLUSH so we can report total

  const totalQueued = freshDrafts.length;
  let flushed = 0;
  let flushBlocked = false;

  if (!LIVE_MODE) {
    // Domain not verified — cannot send
    flushBlocked = true;
    const domainReason = process.env.RESEND_API_KEY
      ? "domain thecorporatedesk.au not verified in Resend (set OUTREACH_DOMAIN_VERIFIED=true after verification)"
      : "RESEND_API_KEY not configured";
    blockers.push(`${totalQueued} emails queued but BLOCKED — ${domainReason}. Verify at resend.com/domains then call POST /api/admin/outreach/flush-send`);
  } else {
    // Domain verified — attempt real sends for up to MAX_FLUSH drafts
    const { resolveProspectEmail } = await import("../../outreach/prospectEmailResolver");
    const { sendOutreachEmail } = await import("../../email");

    for (const draft of freshDrafts.slice(0, MAX_FLUSH)) {
      try {
        const thread = await db.select().from(outreachThreads).where(eq(outreachThreads.id, draft.threadId)).limit(1);
        if (!thread[0]) continue;

        const resolved = await resolveProspectEmail({
          companyId: thread[0].companyId,
          contactId: thread[0].contactId ?? null,
        });

        if (!resolved.resolvedEmail || resolved.sourceType === "blocked") {
          await db.update(outreachMessages).set({
            deliveryStatus: "blocked",
            blockingReason: resolved.blockingReason ?? "No external email found",
          }).where(eq(outreachMessages.id, draft.id));
          recordsUpdated.push(`outreach_messages#${draft.id}: delivery_status draft → blocked [no email]`);
          continue;
        }

        const msgRow = await db.select().from(outreachMessages).where(eq(outreachMessages.id, draft.id)).limit(1);
        if (!msgRow[0]?.subject || !msgRow[0]?.body) continue;

        await new Promise(resolve => setTimeout(resolve, 250)); // Resend rate limit
        const sendResult = await (sendOutreachEmail as any)({
          to: resolved.resolvedEmail,
          subject: msgRow[0].subject!,
          html: msgRow[0].body!,
          companyName: thread[0].companyName,
          firstName: null,
        });

        await db.update(outreachMessages).set({
          deliveryStatus: "sent",
          sentAt: new Date(),
          recipientEmail: resolved.resolvedEmail,
          resendMessageId: (sendResult as any)?.id ?? null,
        }).where(eq(outreachMessages.id, draft.id));

        await db.insert(outreachEvents).values({
          threadId: draft.threadId,
          eventType: "sent",
          payloadJson: JSON.stringify({ messageId: draft.id, via: "alex_orchestrator", liveMode: true }),
        });

        recordsUpdated.push(`outreach_messages#${draft.id} (${thread[0].companyName}): delivery_status draft → sent [${resolved.resolvedEmail}]`);
        flushed++;
      } catch (err: any) {
        await db.update(outreachMessages).set({
          deliveryStatus: "failed",
          blockingReason: err.message,
        }).where(eq(outreachMessages.id, draft.id));
        recordsUpdated.push(`outreach_messages#${draft.id}: delivery_status draft → failed [${err.message}]`);
        blockers.push(`Send failed for message ${draft.id}: ${err.message}`);
      }
    }

    if (flushed > 0) {
      actions.push(`${flushed} emails dispatched via Resend (LIVE MODE)`);
    }
    if (totalQueued > MAX_FLUSH) {
      actions.push(`${totalQueued - MAX_FLUSH} additional drafts remain queued (flush capped at ${MAX_FLUSH} per cycle)`);
    }
  }

  if (totalQueued === 0 && threadsCreated === 0) {
    actions.push("Outreach queue is empty — all threads are current");
  }

  // ── After state ───────────────────────────────────────────────────────────────
  const [afterThreads] = await db.select({ n: count() }).from(outreachThreads);
  const [afterDrafts] = await db.select({ n: count() }).from(outreachMessages)
    .where(and(eq(outreachMessages.deliveryStatus, "draft"), eq(outreachMessages.direction, "outbound")));
  const [afterSent] = await db.select({ n: count() }).from(outreachMessages)
    .where(eq(outreachMessages.deliveryStatus, "sent"));
  const [afterReplied] = await db.select({ n: count() }).from(outreachThreads)
    .where(eq(outreachThreads.status, "replied"));
  const [afterActive] = await db.select({ n: count() }).from(outreachThreads)
    .where(eq(outreachThreads.status, "active"));

  const after = {
    totalThreads: afterThreads.n,
    draftMessages: afterDrafts.n,
    sentMessages: afterSent.n,
    newThreadsCreated: threadsCreated,
    emailsFlushed: flushed,
  };

  const replyRate = afterSent.n > 0 ? Math.round((afterReplied.n / afterSent.n) * 100) : 0;
  const status = flushBlocked && totalQueued > 0 ? "blocked"
    : blockers.length > 0 ? "partial"
    : "completed";

  return {
    department: "Outreach",
    status,
    actionsTaken: actions,
    blockers,
    recordsUpdated,
    before,
    after,
    executionMs: Date.now() - start,
    metrics: {
      threadsCreated,
      emailsFlushed: flushed,
      totalQueued,
      totalThreads: afterThreads.n,
      activeThreads: afterActive.n,
      repliedThreads: afterReplied.n,
      totalSent: afterSent.n,
      replyRatePct: replyRate,
      liveMode: LIVE_MODE ? 1 : 0,
      domainVerified: process.env.OUTREACH_DOMAIN_VERIFIED === "true" ? 1 : 0,
    },
    recommendations: [
      flushBlocked ? "Verify thecorporatedesk.au domain in Resend to unlock sends" : `Live sends enabled (flushed ${flushed} this cycle)`,
      afterActive.n > 20 ? `${afterActive.n} active threads — check follow-up schedule` : "Thread volume is manageable",
      replyRate > 0 ? `${replyRate}% reply rate — convert replies to bookings` : "No replies yet — check deliverability after domain verification",
    ],
  };
}
