/**
 * OUTREACH SEND GATEWAY
 *
 * This is the ONE and ONLY entry point for all outreach email sends.
 * Every send MUST go through this gateway. Direct calls to sendOutreachEmail()
 * from outside this file are NOT permitted for outreach/campaign emails.
 *
 * Safety guarantees provided by this gateway:
 * 1. Identity hash deduplication (DB unique constraint + pre-check)
 * 2. Suppression check (company + recipient)
 * 3. Cooldown window enforcement
 * 4. Rate limiting (hourly + daily)
 * 5. Safe mode support (queue without sending)
 * 6. Write-before-send discipline
 * 7. Full audit trail
 * 8. Status state machine enforcement
 */

import { db } from "../../db";
import { outreachMessages } from "../../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { buildIdentityHash, buildFollowUpIdentityHash, normaliseCompanyName, normaliseEmail } from "./outreach-hashing";
import { checkSuppression, checkAlreadySent, checkCooldown, checkRateLimits, writeAuditEvent } from "./outreach-guards";

// Safe mode: set SAFE_MODE=true to queue without sending
// Default is SAFE_MODE=true for safety. Must explicitly set SAFE_MODE=false to enable live sends.
const GATEWAY_SAFE_MODE = process.env.SAFE_MODE !== "false";

export interface OutreachSendRequest {
  messageId: string;           // ID of existing outreach_messages record
  companyName: string;
  recipientEmail: string;
  subject: string;
  html: string;
  campaignKey?: string;        // defaults to "default"
  stage?: number;              // 0 = first contact, >0 = follow-up
  isFollowUp?: boolean;        // if true, uses stage-specific identity hash
  overrideSafeMode?: boolean;  // only for admin-initiated sends with explicit approval
}

export interface GatewayResult {
  sent: boolean;
  blocked: boolean;
  suppressed: boolean;
  deduplicated: boolean;
  rateLimited: boolean;
  safeMode: boolean;
  reason?: string;
  providerMessageId?: string;
}

/**
 * The safe outreach send gateway.
 * All checks run before any email is sent.
 * DB record is updated at every status transition.
 */
export async function sendOutreachSafely(opts: OutreachSendRequest): Promise<GatewayResult> {
  const campaignKey = opts.campaignKey || "default";
  const stage = opts.stage ?? 0;
  const normCompany = normaliseCompanyName(opts.companyName);
  const normEmail = normaliseEmail(opts.recipientEmail);

  const identityHash = opts.isFollowUp
    ? buildFollowUpIdentityHash({ companyName: opts.companyName, recipientEmail: opts.recipientEmail, campaignKey, stage })
    : buildIdentityHash({ companyName: opts.companyName, recipientEmail: opts.recipientEmail, campaignKey });

  const context = { companyName: opts.companyName, recipientEmail: opts.recipientEmail, campaignKey, stage, identityHash, messageId: opts.messageId };

  // ── 1. Suppression check ──
  const suppCheck = await checkSuppression({ companyName: opts.companyName, recipientEmail: opts.recipientEmail, campaignKey });
  if (suppCheck.suppressed) {
    await markMessageStatus(opts.messageId, "suppressed", {
      suppressionReason: suppCheck.reason,
      identityHash,
      companyName: normCompany,
      campaignKey,
    });
    await writeAuditEvent({ entityType: "message", entityId: opts.messageId, eventType: "suppressed", ...context, details: { reason: suppCheck.reason } });
    console.log(`[OutreachGateway] SUPPRESSED — ${opts.companyName} <${opts.recipientEmail}>: ${suppCheck.reason}`);
    return { sent: false, blocked: false, suppressed: true, deduplicated: false, rateLimited: false, safeMode: false, reason: suppCheck.reason };
  }

  // ── 2. Already sent check (belt-and-suspenders on top of identity_hash unique constraint) ──
  if (!opts.isFollowUp) {
    const sentCheck = await checkAlreadySent({ companyName: opts.companyName, recipientEmail: opts.recipientEmail, campaignKey });
    if (sentCheck.alreadySent) {
      await markMessageStatus(opts.messageId, "blocked", {
        blockingReason: `Duplicate prevented: already sent (message ${sentCheck.existingMessageId})`,
        identityHash,
        companyName: normCompany,
        campaignKey,
      });
      await writeAuditEvent({ entityType: "message", entityId: opts.messageId, eventType: "dedup_prevented", ...context, details: { existingMessageId: sentCheck.existingMessageId } });
      console.log(`[OutreachGateway] DEDUP BLOCKED — ${opts.companyName} already received this outreach`);
      return { sent: false, blocked: true, suppressed: false, deduplicated: true, rateLimited: false, safeMode: false, reason: "Duplicate send prevented" };
    }

    // ── 3. Cooldown check (only for first contact) ──
    const cooldown = await checkCooldown({ companyName: opts.companyName });
    if (cooldown.inCooldown) {
      const reason = `Cooldown active — last sent ${cooldown.lastSentAt?.toISOString()}`;
      await markMessageStatus(opts.messageId, "blocked", {
        blockingReason: reason,
        identityHash,
        companyName: normCompany,
        campaignKey,
      });
      await writeAuditEvent({ entityType: "message", entityId: opts.messageId, eventType: "cooldown_blocked", ...context, details: { lastSentAt: cooldown.lastSentAt } });
      console.log(`[OutreachGateway] COOLDOWN BLOCKED — ${opts.companyName}: ${reason}`);
      return { sent: false, blocked: true, suppressed: false, deduplicated: false, rateLimited: false, safeMode: false, reason };
    }
  }

  // ── 4. Rate limit check ──
  const rateCheck = await checkRateLimits();
  if (rateCheck.exceeded) {
    await markMessageStatus(opts.messageId, "blocked", {
      blockingReason: rateCheck.reason,
      identityHash,
      companyName: normCompany,
      campaignKey,
    });
    await writeAuditEvent({ entityType: "message", entityId: opts.messageId, eventType: "rate_limited", ...context, details: { reason: rateCheck.reason } });
    console.log(`[OutreachGateway] RATE LIMITED — ${rateCheck.reason}`);
    return { sent: false, blocked: true, suppressed: false, deduplicated: false, rateLimited: true, safeMode: false, reason: rateCheck.reason };
  }

  // ── 5. Safe mode check ──
  const inSafeMode = GATEWAY_SAFE_MODE && !opts.overrideSafeMode;
  if (inSafeMode) {
    await markMessageStatus(opts.messageId, "blocked", {
      blockingReason: "SAFE_MODE — send suppressed by gateway",
      identityHash,
      companyName: normCompany,
      campaignKey,
    });
    await writeAuditEvent({ entityType: "message", entityId: opts.messageId, eventType: "safe_mode_blocked", ...context });
    console.log(`[OutreachGateway] SAFE_MODE — would have sent to ${opts.recipientEmail} for ${opts.companyName}`);
    return { sent: false, blocked: true, suppressed: false, deduplicated: false, rateLimited: false, safeMode: true, reason: "Safe mode active" };
  }

  // ── 6. Write identity hash + lock the message before sending ──
  try {
    await db.update(outreachMessages)
      .set({
        deliveryStatus: "locked",
        identityHash,
        companyName: normCompany,
        campaignKey,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(outreachMessages.id, opts.messageId));
  } catch (lockErr: any) {
    // If unique constraint on identity_hash fires here, the message was already sent concurrently
    if (lockErr.code === "23505") {
      console.log(`[OutreachGateway] CONCURRENT DEDUP — identity_hash conflict for ${opts.companyName}`);
      await writeAuditEvent({ entityType: "message", entityId: opts.messageId, eventType: "dedup_prevented", ...context, details: { error: "identity_hash unique constraint violation" } });
      return { sent: false, blocked: true, suppressed: false, deduplicated: true, rateLimited: false, safeMode: false, reason: "Concurrent duplicate prevented" };
    }
    throw lockErr;
  }

  // ── 7. Move to sending ──
  await db.update(outreachMessages)
    .set({ deliveryStatus: "sending", updatedAt: new Date() })
    .where(eq(outreachMessages.id, opts.messageId));

  await writeAuditEvent({ entityType: "message", entityId: opts.messageId, eventType: "sending", ...context });

  // ── 8. Call email provider ──
  try {
    const { sendOutreachEmail } = await import("../../email");
    const sendResult = await sendOutreachEmail({
      to: opts.recipientEmail,
      subject: opts.subject,
      html: opts.html,
      companyName: opts.companyName,
    });

    const providerMessageId = (sendResult as any)?.id ?? null;

    // ── 9. Mark sent ──
    await db.update(outreachMessages)
      .set({
        deliveryStatus: "sent",
        sentAt: new Date(),
        recipientEmail: normEmail,
        resendMessageId: providerMessageId,
        updatedAt: new Date(),
      })
      .where(eq(outreachMessages.id, opts.messageId));

    await writeAuditEvent({ entityType: "message", entityId: opts.messageId, eventType: "sent", ...context, details: { providerMessageId } });
    console.log(`[OutreachGateway] SENT ✓ — ${opts.companyName} <${opts.recipientEmail}> (${providerMessageId})`);

    return { sent: true, blocked: false, suppressed: false, deduplicated: false, rateLimited: false, safeMode: false, providerMessageId };

  } catch (sendErr: any) {
    const errorMsg = sendErr?.message ?? String(sendErr);

    // ── 10. Mark failed ──
    await db.update(outreachMessages)
      .set({
        deliveryStatus: "failed",
        failedAt: new Date(),
        lastError: errorMsg.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(outreachMessages.id, opts.messageId));

    await writeAuditEvent({ entityType: "message", entityId: opts.messageId, eventType: "failed", ...context, details: { error: errorMsg } });
    console.error(`[OutreachGateway] SEND FAILED — ${opts.companyName}: ${errorMsg}`);

    return { sent: false, blocked: false, suppressed: false, deduplicated: false, rateLimited: false, safeMode: false, reason: errorMsg };
  }
}

/**
 * Internal helper to update a message's status safely.
 */
async function markMessageStatus(
  messageId: string,
  status: string,
  extra: Partial<{
    blockingReason: string;
    suppressionReason: string;
    lastError: string;
    identityHash: string;
    companyName: string;
    campaignKey: string;
  }>
): Promise<void> {
  try {
    await db.update(outreachMessages)
      .set({
        deliveryStatus: status,
        updatedAt: new Date(),
        ...extra,
      })
      .where(eq(outreachMessages.id, messageId));
  } catch (err) {
    console.error(`[OutreachGateway] Failed to update message ${messageId} to ${status}:`, err);
  }
}
