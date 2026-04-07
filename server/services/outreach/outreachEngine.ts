/**
 * Outreach Engine
 * Manages outreach threads, sequences, and state transitions.
 * Integrates with intelligence data to create and prioritize outreach candidates.
 */

import { db } from "../../db";
import { storage } from "../../storage";
import {
  outreachThreads,
  outreachSequences,
  outreachEvents,
  outreachMessages,
  companyContacts,
  meetingBookingEvents,
} from "@shared/schema";
import { eq, and, lte, desc, lt } from "drizzle-orm";
import { generateOutreachMessage } from "./outreachGenerationService";

const SAFE_MODE = process.env.SAFE_MODE === "true";

// Sequence timing anchored from thread creation (not compounded)
const SEQUENCE_DAYS = [0, 3, 7, 14];

type OutreachAngle = "lease_timing" | "move_planning" | "market_development" | "general";

function determineAngle(moveProbability: number | null, leaseContext: boolean): OutreachAngle {
  if (leaseContext) return "lease_timing";
  if ((moveProbability ?? 0) >= 70) return "move_planning";
  return "general";
}

export async function createOutreachThread(params: {
  companyId: string;
  companyName: string;
  city?: string | null;
  industry?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  opportunityScore?: number;
  relocationProbability?: number;
  signals?: string[];
  leaseExpiryTiming?: string | null;
}): Promise<string> {
  const angle = determineAngle(
    params.relocationProbability ?? null,
    !!params.leaseExpiryTiming
  );

  // Check for existing thread
  const existing = await db
    .select()
    .from(outreachThreads)
    .where(and(
      eq(outreachThreads.companyId, params.companyId),
      eq(outreachThreads.status, "active")
    ))
    .limit(1);

  if (existing.length > 0) {
    const existingThread = existing[0];
    if (params.contactId && (!existingThread.resolvedEmail || existingThread.contactReadiness === "NEEDS_CONTACT")) {
      try {
        const { resolveProspectEmail, getContactReadiness } = await import("./prospectEmailResolver");
        const resolution = await resolveProspectEmail({ companyId: params.companyId, contactId: params.contactId });
        if (resolution.resolvedEmail) {
          await db.update(outreachThreads).set({
            contactId: params.contactId,
            resolvedEmail: resolution.resolvedEmail,
            resolvedEmailSource: resolution.sourceType,
            contactReadiness: getContactReadiness(resolution),
            updatedAt: new Date(),
          }).where(eq(outreachThreads.id, existingThread.id));
          console.log(`[OutreachEngine] Updated existing thread ${existingThread.id} with resolved email ${resolution.resolvedEmail}`);
        }
      } catch (err: any) {
        console.warn(`[OutreachEngine] Failed to update existing thread email: ${err.message}`);
      }
    }
    console.log(`[OutreachEngine] Active thread already exists for ${params.companyName}`);
    return existingThread.id;
  }

  // Get booking link from env
  const bookingLink = process.env.BOOKING_BASE_URL
    ? `${process.env.BOOKING_BASE_URL}?company=${encodeURIComponent(params.companyName)}`
    : process.env.CALENDLY_LINK ?? "https://calendly.com/thecorporatedesk";

  let resolvedEmail: string | null = null;
  let resolvedEmailSource: string | null = null;
  let contactReadiness = "NEEDS_CONTACT";

  if (params.contactId) {
    try {
      const { resolveProspectEmail, getContactReadiness } = await import("./prospectEmailResolver");
      const resolution = await resolveProspectEmail({ companyId: params.companyId, contactId: params.contactId });
      if (resolution.resolvedEmail) {
        resolvedEmail = resolution.resolvedEmail;
        resolvedEmailSource = resolution.sourceType;
        contactReadiness = getContactReadiness(resolution);
      }
    } catch (err: any) {
      console.warn(`[OutreachEngine] Email resolution failed for contact ${params.contactId}: ${err.message}`);
    }
  }

  const [thread] = await db.insert(outreachThreads).values({
    companyId: params.companyId,
    companyName: params.companyName,
    contactId: params.contactId ?? null,
    opportunityId: params.opportunityId ?? null,
    status: "active",
    channel: "email",
    currentStage: 0,
    outreachAngle: angle,
    opportunityScore: params.opportunityScore ?? null,
    relocationProbability: params.relocationProbability ?? null,
    bookingLink,
    bookingStatus: "link_created",
    resolvedEmail,
    resolvedEmailSource,
    contactReadiness,
  }).returning();

  // Log creation event
  await db.insert(outreachEvents).values({
    threadId: thread.id,
    eventType: "created",
    payloadJson: { companyName: params.companyName, angle, bookingLink },
  });

  // Schedule sequence
  const now = new Date();
  for (const dayOffset of SEQUENCE_DAYS) {
    const scheduledFor = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    await db.insert(outreachSequences).values({
      threadId: thread.id,
      sequenceType: angle === "lease_timing" ? "lease_expiry" : angle === "move_planning" ? "tenant_movement" : "standard",
      stage: SEQUENCE_DAYS.indexOf(dayOffset),
      scheduledFor,
      status: "scheduled",
    });
  }

  // Generate intro message draft immediately
  const contact = params.contactId
    ? (await db.select().from(companyContacts).where(eq(companyContacts.id, params.contactId)).limit(1))[0]
    : null;

  await generateOutreachMessage(thread.id, {
    companyName: params.companyName,
    city: params.city ?? null,
    industry: params.industry ?? null,
    contactName: contact?.contactName ?? null,
    contactRole: contact?.role ?? null,
    signals: params.signals ?? [],
    leaseExpiryTiming: params.leaseExpiryTiming ?? null,
    outreachAngle: angle,
    isGenericContact: contact?.contactType === "generic_fallback",
    stage: 0,
  });

  console.log(`[OutreachEngine] Created thread ${thread.id} for ${params.companyName} (angle: ${angle})`);
  return thread.id;
}

export async function processScheduledFollowUps(): Promise<{ processed: number; sent: number; skipped: number }> {
  const now = new Date();

  // Get sequences due now that haven't been sent
  const dueSequences = await db
    .select()
    .from(outreachSequences)
    .where(and(
      eq(outreachSequences.status, "scheduled"),
      lte(outreachSequences.scheduledFor, now)
    ))
    .limit(50);

  let processed = 0;
  let sent = 0;
  let skipped = 0;

  for (const seq of dueSequences) {
    processed++;

    // Get thread
    const threads = await db
      .select()
      .from(outreachThreads)
      .where(eq(outreachThreads.id, seq.threadId))
      .limit(1);

    if (threads.length === 0) {
      await db.update(outreachSequences)
        .set({ status: "skipped", stopReason: "thread_not_found" })
        .where(eq(outreachSequences.id, seq.id));
      skipped++;
      continue;
    }

    const thread = threads[0];

    // Check stop conditions
    const stopConditions = ["stopped", "replied", "booked", "completed"];
    if (stopConditions.includes(thread.status)) {
      await db.update(outreachSequences)
        .set({ status: "stopped", stopReason: `thread_status_${thread.status}` })
        .where(eq(outreachSequences.id, seq.id));
      skipped++;
      continue;
    }

    // Generate next follow-up message
    const contact = thread.contactId
      ? (await db.select().from(companyContacts).where(eq(companyContacts.id, thread.contactId)).limit(1))[0]
      : null;

    await generateOutreachMessage(seq.threadId, {
      companyName: thread.companyName,
      city: null,
      industry: null,
      contactName: contact?.contactName ?? null,
      contactRole: contact?.role ?? null,
      outreachAngle: (thread.outreachAngle as any) ?? "general",
      isGenericContact: contact?.contactType === "generic_fallback",
      stage: seq.stage,
    });

    // Mark sequence item as sent (or draft in SAFE_MODE)
    const status = SAFE_MODE ? "sent" : "sent"; // Always mark as sent (actual email sending handled separately)
    await db.update(outreachSequences)
      .set({ status, sentAt: new Date() })
      .where(eq(outreachSequences.id, seq.id));

    // Update thread stage
    await db.update(outreachThreads)
      .set({ currentStage: seq.stage, updatedAt: new Date() })
      .where(eq(outreachThreads.id, seq.threadId));

    await db.insert(outreachEvents).values({
      threadId: seq.threadId,
      eventType: SAFE_MODE ? "draft_generated" : "sent",
      payloadJson: { stage: seq.stage, sequenceId: seq.id },
    });

    sent++;
  }

  console.log(`[OutreachEngine] Follow-ups: ${processed} processed, ${sent} sent, ${skipped} skipped`);
  return { processed, sent, skipped };
}

export async function pauseThread(threadId: string): Promise<void> {
  await db.update(outreachThreads)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(outreachThreads.id, threadId));

  await db.update(outreachSequences)
    .set({ status: "skipped", stopReason: "manual_pause" })
    .where(and(
      eq(outreachSequences.threadId, threadId),
      eq(outreachSequences.status, "scheduled")
    ));

  await db.insert(outreachEvents).values({
    threadId,
    eventType: "paused",
    payloadJson: { reason: "manual" },
  });
}

export async function stopThread(threadId: string, reason = "manual"): Promise<void> {
  await db.update(outreachThreads)
    .set({ status: "stopped", stopReason: reason, updatedAt: new Date() })
    .where(eq(outreachThreads.id, threadId));

  await db.update(outreachSequences)
    .set({ status: "stopped", stopReason: reason })
    .where(and(
      eq(outreachSequences.threadId, threadId),
      eq(outreachSequences.status, "scheduled")
    ));

  await db.insert(outreachEvents).values({
    threadId,
    eventType: "stopped",
    payloadJson: { reason },
  });
}

export async function markThreadReplied(threadId: string): Promise<void> {
  await stopThread(threadId, "reply_received");
  await db.update(outreachThreads)
    .set({ status: "replied" })
    .where(eq(outreachThreads.id, threadId));
}

export async function markThreadBooked(threadId: string, meetingTime?: Date): Promise<void> {
  await stopThread(threadId, "meeting_booked");
  await db.update(outreachThreads)
    .set({ status: "booked", bookingStatus: "booked" })
    .where(eq(outreachThreads.id, threadId));

  await db.insert(outreachEvents).values({
    threadId,
    eventType: "meeting_booked",
    payloadJson: { meetingTime: meetingTime?.toISOString() },
  });
}

export async function getOutreachReadyCompanies(limit = 20) {
  const companies = await storage.getCompanyIntelligenceRecords({});
  const existingThreads = await db.select().from(outreachThreads).limit(500);
  const threadedCompanyIds = new Set(existingThreads.map(t => t.companyId));

  return companies
    .filter(c =>
      (c.confidenceScore ?? 0) >= 60 &&
      (c.moveProbability ?? 0) >= 50 &&
      !threadedCompanyIds.has(c.id)
    )
    .sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0))
    .slice(0, limit)
    .map(c => ({
      id: c.id,
      companyName: c.companyName,
      city: c.city,
      industry: c.industry,
      confidenceScore: c.confidenceScore,
      moveProbability: c.moveProbability,
      radarSignalCount: c.radarSignalCount,
      priorityLevel: c.priorityLevel,
    }));
}

export async function getFollowUpsDue(limit = 20) {
  const now = new Date();
  const due = await db
    .select()
    .from(outreachSequences)
    .where(and(
      eq(outreachSequences.status, "scheduled"),
      lte(outreachSequences.scheduledFor, now)
    ))
    .limit(limit);

  const results = [];
  for (const seq of due) {
    const threads = await db.select().from(outreachThreads)
      .where(eq(outreachThreads.id, seq.threadId)).limit(1);
    if (threads.length > 0) {
      results.push({ ...seq, thread: threads[0] });
    }
  }
  return results;
}

export async function getActiveThreads(limit = 50) {
  return db
    .select()
    .from(outreachThreads)
    .where(eq(outreachThreads.status, "active"))
    .orderBy(desc(outreachThreads.updatedAt))
    .limit(limit);
}

export async function getMeetingsBooked(limit = 20) {
  return db
    .select()
    .from(meetingBookingEvents)
    .where(eq(meetingBookingEvents.bookingStatus, "confirmed"))
    .orderBy(desc(meetingBookingEvents.createdAt))
    .limit(limit);
}

export async function createOutreachForHighValueOpportunities(): Promise<{ created: number }> {
  if (SAFE_MODE) {
    console.log("[OutreachEngine] SAFE_MODE active — threads created as drafts only");
  }

  const ready = await getOutreachReadyCompanies(10);
  let created = 0;

  for (const company of ready) {
    try {
      // Get primary contact
      const contacts = await db
        .select()
        .from(companyContacts)
        .where(eq(companyContacts.companyIntelligenceId, company.id))
        .limit(5);

      const primary = contacts.find(c => c.isPrimary) ?? contacts[0];

      await createOutreachThread({
        companyId: company.id,
        companyName: company.companyName,
        city: company.city,
        industry: company.industry,
        contactId: primary?.id ?? null,
        opportunityScore: company.confidenceScore ?? undefined,
        relocationProbability: company.moveProbability ?? undefined,
        signals: [],
      });
      created++;
    } catch (err) {
      console.error(`[OutreachEngine] Error creating thread for ${company.companyName}:`, err);
    }
  }

  console.log(`[OutreachEngine] Created ${created} new outreach threads`);
  return { created };
}
