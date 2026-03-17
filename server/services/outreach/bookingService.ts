/**
 * Auto Booking Engine
 * Provider-abstracted booking link generation and meeting creation.
 * SAFE_MODE: simulates booking only, no real calendar events created.
 */

import { db } from "../../db";
import {
  meetingBookingEvents,
  outreachThreads,
  outreachEvents,
  dealExecution,
} from "@shared/schema";
import { eq } from "drizzle-orm";

const SAFE_MODE = process.env.SAFE_MODE === "true";

type BookingProvider = "google" | "calendly" | "manual";

function getActiveProvider(): BookingProvider {
  const provider = process.env.BOOKING_PROVIDER as BookingProvider;
  if (["google", "calendly", "manual"].includes(provider)) return provider;
  return "manual";
}

function getBookingLink(companyName?: string, threadId?: string): string {
  const provider = getActiveProvider();

  if (provider === "calendly" && process.env.CALENDLY_LINK) {
    const base = process.env.CALENDLY_LINK;
    const params = new URLSearchParams();
    if (companyName) params.set("name", companyName);
    if (threadId) params.set("ref", threadId);
    return `${base}?${params.toString()}`;
  }

  if (provider === "google" && process.env.BOOKING_BASE_URL) {
    return `${process.env.BOOKING_BASE_URL}?company=${encodeURIComponent(companyName ?? "")}&ref=${threadId ?? ""}`;
  }

  // Manual fallback — use a placeholder or configured URL
  const baseUrl = process.env.BOOKING_BASE_URL ?? "https://thecorporatedesk.com.au/book";
  return `${baseUrl}?company=${encodeURIComponent(companyName ?? "")}&ref=${threadId ?? ""}`;
}

export async function createBookingLink(params: {
  threadId: string;
  companyId: string;
  companyName: string;
  contactId?: string | null;
  opportunityId?: string | null;
}): Promise<{ bookingLink: string; bookingEventId: string; provider: BookingProvider; isSandbox: boolean }> {
  const provider = getActiveProvider();
  const bookingLink = getBookingLink(params.companyName, params.threadId);
  const isSandbox = SAFE_MODE;

  // Record booking event
  const [event] = await db.insert(meetingBookingEvents).values({
    companyId: params.companyId,
    companyName: params.companyName,
    contactId: params.contactId ?? null,
    opportunityId: params.opportunityId ?? null,
    threadId: params.threadId,
    bookingProvider: provider,
    bookingStatus: "link_created",
    bookingLink,
    isSandbox,
    meetingTitle: `Workspace Planning Call — ${params.companyName}`,
  }).returning();

  // Update thread with booking link
  await db.update(outreachThreads)
    .set({ bookingLink, bookingStatus: "link_created", updatedAt: new Date() })
    .where(eq(outreachThreads.id, params.threadId));

  // Log event
  await db.insert(outreachEvents).values({
    threadId: params.threadId,
    eventType: "booking_link_created",
    payloadJson: JSON.stringify({ provider, bookingLink, isSandbox }),
  });

  console.log(`[BookingService] Link created for ${params.companyName}: ${bookingLink} (provider: ${provider}, sandbox: ${isSandbox})`);
  return { bookingLink, bookingEventId: event.id, provider, isSandbox };
}

export async function recordBookingClick(threadId: string, bookingEventId: string): Promise<void> {
  await db.update(meetingBookingEvents)
    .set({ bookingStatus: "clicked", updatedAt: new Date() })
    .where(eq(meetingBookingEvents.id, bookingEventId));

  await db.update(outreachThreads)
    .set({ bookingStatus: "clicked", updatedAt: new Date() })
    .where(eq(outreachThreads.id, threadId));

  await db.insert(outreachEvents).values({
    threadId,
    eventType: "booking_clicked",
    payloadJson: JSON.stringify({ bookingEventId }),
  });
}

export async function confirmMeeting(params: {
  threadId: string;
  bookingEventId: string;
  meetingTime: Date;
  calendarEventId?: string;
}): Promise<void> {
  if (SAFE_MODE) {
    console.log(`[BookingService] SAFE_MODE — simulating meeting confirmation for thread ${params.threadId}`);
  }

  await db.update(meetingBookingEvents)
    .set({
      bookingStatus: "confirmed",
      meetingTime: params.meetingTime,
      calendarEventId: params.calendarEventId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(meetingBookingEvents.id, params.bookingEventId));

  // Get thread to find companyId for deal_execution update
  const [thread] = await db.select({ companyId: outreachThreads.companyId, companyName: outreachThreads.companyName })
    .from(outreachThreads)
    .where(eq(outreachThreads.id, params.threadId))
    .limit(1);

  await db.update(outreachThreads)
    .set({ status: "booked", bookingStatus: "booked", updatedAt: new Date() })
    .where(eq(outreachThreads.id, params.threadId));

  // Update deal_execution pipeline stage to meeting_booked
  if (thread?.companyId) {
    await db.update(dealExecution)
      .set({
        stage: "meeting_booked",
        meetingBooked: true,
        meetingTime: params.meetingTime,
        lastAction: "Meeting booked via outreach sequence",
        nextAction: "Send agenda, prepare proposal",
        lastContactedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dealExecution.companyId, thread.companyId));
  }

  await db.insert(outreachEvents).values({
    threadId: params.threadId,
    eventType: "meeting_booked",
    payloadJson: JSON.stringify({
      meetingTime: params.meetingTime.toISOString(),
      calendarEventId: params.calendarEventId,
      isSandbox: SAFE_MODE,
    }),
  });

  console.log(`[BookingService] Meeting confirmed for ${thread?.companyName ?? params.threadId} at ${params.meetingTime.toISOString()}`);
}

export async function getBookingStats() {
  const events = await db.select().from(meetingBookingEvents).limit(500);

  const byStatus: Record<string, number> = {};
  for (const e of events) {
    byStatus[e.bookingStatus] = (byStatus[e.bookingStatus] ?? 0) + 1;
  }

  const confirmed = events.filter(e => e.bookingStatus === "confirmed");
  const clicked = events.filter(e => ["clicked", "confirmed"].includes(e.bookingStatus));

  return {
    provider: getActiveProvider(),
    isSandbox: SAFE_MODE,
    totalLinks: events.length,
    clicked: clicked.length,
    confirmed: confirmed.length,
    conversionRate: events.length > 0 ? Math.round((confirmed.length / events.length) * 100) : 0,
    byStatus,
    recentMeetings: confirmed.slice(0, 5).map(e => ({
      companyName: e.companyName,
      meetingTime: e.meetingTime,
      provider: e.bookingProvider,
    })),
  };
}
