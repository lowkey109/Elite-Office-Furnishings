import { db } from "../../db";
import { outreachSuppressions, outreachMessages, outreachAuditEvents } from "../../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { normaliseCompanyName, normaliseEmail } from "./outreach-hashing";

/**
 * Configuration for rate limits and cooldowns.
 * These are hard caps — no exceptions.
 */
const RATE_LIMITS = {
  maxPerDay: 20,           // max emails sent in a 24h window globally
  maxPerHour: 5,           // max emails sent in a 1h window globally
  maxPerCompanyPerCampaign: 1,   // max first-contact per company per campaign
  maxPerEmailPerCampaign: 1,     // max per recipient per campaign
  cooldownDays: 30,        // days before same company can be contacted again (even different campaign)
};

/**
 * Check if an outreach should be suppressed.
 * Returns { suppressed: true, reason } or { suppressed: false }.
 */
export async function checkSuppression(opts: {
  companyName: string;
  recipientEmail: string;
  campaignKey?: string;
}): Promise<{ suppressed: boolean; reason?: string }> {
  const normCompany = normaliseCompanyName(opts.companyName);
  const normEmail = normaliseEmail(opts.recipientEmail);
  const now = new Date();

  // Check company-level suppression
  const companySuppression = await db.select()
    .from(outreachSuppressions)
    .where(
      and(
        sql`lower(trim(${outreachSuppressions.companyName})) = ${normCompany}`,
        eq(outreachSuppressions.active, 1)
      )
    )
    .limit(1);

  if (companySuppression.length > 0) {
    const s = companySuppression[0];
    // Check expiry
    if (!s.expiresAt || s.expiresAt > now) {
      return { suppressed: true, reason: `Company suppressed: ${s.reason}` };
    }
  }

  // Check recipient-level suppression
  const emailSuppression = await db.select()
    .from(outreachSuppressions)
    .where(
      and(
        sql`lower(trim(${outreachSuppressions.recipientEmail})) = ${normEmail}`,
        eq(outreachSuppressions.active, 1)
      )
    )
    .limit(1);

  if (emailSuppression.length > 0) {
    const s = emailSuppression[0];
    if (!s.expiresAt || s.expiresAt > now) {
      return { suppressed: true, reason: `Recipient suppressed: ${s.reason}` };
    }
  }

  return { suppressed: false };
}

/**
 * Check if this company/email has already been contacted for this campaign.
 * Uses the existing outreach_messages table.
 */
export async function checkAlreadySent(opts: {
  companyName: string;
  recipientEmail: string;
  campaignKey?: string;
}): Promise<{ alreadySent: boolean; existingMessageId?: string }> {
  const normCompany = normaliseCompanyName(opts.companyName);
  const normEmail = normaliseEmail(opts.recipientEmail);

  const existing = await db.select({ id: outreachMessages.id, deliveryStatus: outreachMessages.deliveryStatus })
    .from(outreachMessages)
    .where(
      and(
        sql`lower(trim(${outreachMessages.companyName})) = ${normCompany}`,
        sql`lower(trim(${outreachMessages.recipientEmail})) = ${normEmail}`,
        sql`${outreachMessages.deliveryStatus} IN ('sent', 'sending', 'locked')`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { alreadySent: true, existingMessageId: existing[0].id };
  }
  return { alreadySent: false };
}

/**
 * Check if within cooldown window for this company.
 * No contact within COOLDOWN_DAYS, regardless of campaign.
 */
export async function checkCooldown(opts: {
  companyName: string;
}): Promise<{ inCooldown: boolean; lastSentAt?: Date }> {
  const normCompany = normaliseCompanyName(opts.companyName);
  const cooldownSince = new Date(Date.now() - RATE_LIMITS.cooldownDays * 24 * 60 * 60 * 1000);

  const recent = await db.select({ sentAt: outreachMessages.sentAt })
    .from(outreachMessages)
    .where(
      and(
        sql`lower(trim(${outreachMessages.companyName})) = ${normCompany}`,
        eq(outreachMessages.deliveryStatus, "sent"),
        sql`${outreachMessages.sentAt} >= ${cooldownSince}`
      )
    )
    .orderBy(sql`${outreachMessages.sentAt} DESC`)
    .limit(1);

  if (recent.length > 0) {
    return { inCooldown: true, lastSentAt: recent[0].sentAt ?? undefined };
  }
  return { inCooldown: false };
}

/**
 * Check global rate limits (per day and per hour).
 */
export async function checkRateLimits(): Promise<{ exceeded: boolean; reason?: string }> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [hourlyResult, dailyResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(outreachMessages)
      .where(
        and(
          eq(outreachMessages.deliveryStatus, "sent"),
          sql`${outreachMessages.sentAt} >= ${hourAgo}`
        )
      ),
    db.select({ count: sql<number>`count(*)::int` })
      .from(outreachMessages)
      .where(
        and(
          eq(outreachMessages.deliveryStatus, "sent"),
          sql`${outreachMessages.sentAt} >= ${dayAgo}`
        )
      ),
  ]);

  const hourlyCount = hourlyResult[0]?.count ?? 0;
  const dailyCount = dailyResult[0]?.count ?? 0;

  if (hourlyCount >= RATE_LIMITS.maxPerHour) {
    return { exceeded: true, reason: `Hourly rate limit reached: ${hourlyCount}/${RATE_LIMITS.maxPerHour} in last hour` };
  }
  if (dailyCount >= RATE_LIMITS.maxPerDay) {
    return { exceeded: true, reason: `Daily rate limit reached: ${dailyCount}/${RATE_LIMITS.maxPerDay} in last 24h` };
  }
  return { exceeded: false };
}

/**
 * Write an audit event to the database.
 */
export async function writeAuditEvent(opts: {
  entityType: string;
  entityId?: string;
  eventType: string;
  companyName?: string;
  recipientEmail?: string;
  campaignKey?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(outreachAuditEvents).values({
      entityType: opts.entityType,
      entityId: opts.entityId,
      eventType: opts.eventType,
      companyName: opts.companyName,
      recipientEmail: opts.recipientEmail,
      campaignKey: opts.campaignKey,
      details: opts.details ? JSON.stringify(opts.details) : null,
    });
  } catch (err) {
    console.error("[OutreachAudit] Failed to write audit event:", err);
  }
}

/**
 * Insert a suppression for a company to prevent future contact.
 */
export async function suppressCompany(opts: {
  companyName: string;
  reason: string;
  campaignKey?: string;
  note?: string;
  expiresAt?: Date;
}): Promise<void> {
  const normCompany = normaliseCompanyName(opts.companyName);
  await db.insert(outreachSuppressions).values({
    suppressionScope: "company",
    companyName: normCompany,
    campaignKey: opts.campaignKey,
    reason: opts.reason,
    active: 1,
    note: opts.note,
    expiresAt: opts.expiresAt,
  });
  await writeAuditEvent({
    entityType: "suppression",
    eventType: "company_suppressed",
    companyName: opts.companyName,
    campaignKey: opts.campaignKey,
    details: { reason: opts.reason, note: opts.note },
  });
}

/**
 * Insert a suppression for a recipient email.
 */
export async function suppressRecipient(opts: {
  recipientEmail: string;
  companyName?: string;
  reason: string;
  campaignKey?: string;
  note?: string;
  expiresAt?: Date;
}): Promise<void> {
  const normEmail = normaliseEmail(opts.recipientEmail);
  await db.insert(outreachSuppressions).values({
    suppressionScope: "recipient",
    recipientEmail: normEmail,
    companyName: opts.companyName,
    campaignKey: opts.campaignKey,
    reason: opts.reason,
    active: 1,
    note: opts.note,
    expiresAt: opts.expiresAt,
  });
  await writeAuditEvent({
    entityType: "suppression",
    eventType: "recipient_suppressed",
    companyName: opts.companyName,
    recipientEmail: opts.recipientEmail,
    campaignKey: opts.campaignKey,
    details: { reason: opts.reason, note: opts.note },
  });
}
