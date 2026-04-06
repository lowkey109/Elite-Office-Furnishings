import { storage } from "../storage";
import { sendFollowUpEmail, getNextSendAt, TOTAL_STAGES } from "./followUpEmails";
import type { FollowUpSequence } from "@shared/schema";

// Internal email sender that uses the Resend API directly
// (to avoid circular import with email.ts)
import { Resend } from "resend";

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const SAFE_MODE = process.env.SAFE_MODE === "true";

async function internalSendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (SAFE_MODE) {
    console.log(`[FollowUp] SAFE_MODE — suppressed follow-up email "${opts.subject}" to ${opts.to}`);
    return;
  }
  const resend = getResend();
  if (!resend) {
    console.log(`[FollowUp] Email not sent (no RESEND_API_KEY): ${opts.subject} → ${opts.to}`);
    return;
  }
  await resend.emails.send({
    from: "The Corporate Desk <onboarding@resend.dev>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

let _running = false;

export async function runFollowUpScheduler(): Promise<void> {
  if (_running) return;
  _running = true;

  try {
    const dueSequences = await storage.getDueFollowUpSequences();

    if (dueSequences.length > 0) {
      console.log(`[FollowUp] Processing ${dueSequences.length} due sequence(s)`);
    }

    for (const seq of dueSequences) {
      try {
        const nextStage = seq.stage + 1;

        if (nextStage > TOTAL_STAGES) {
          await storage.updateFollowUpSequenceStatus(seq.id, "completed");
          continue;
        }

        // Send the email for this stage
        await sendFollowUpEmail(seq, nextStage, internalSendEmail);

        // Calculate next send time
        const isLastStage = nextStage >= TOTAL_STAGES;
        const nextSendAt = isLastStage ? null : getNextSendAt(nextStage + 1);
        const newStatus = isLastStage ? "completed" : "active";
        const stagesCompleted = [...(seq.stagesCompleted || []), String(nextStage)];

        await storage.advanceFollowUpSequence(
          seq.id,
          nextStage,
          nextSendAt,
          newStatus,
          stagesCompleted
        );

        console.log(`[FollowUp] Sent stage ${nextStage} to ${seq.leadEmail} (${seq.leadType}) — status: ${newStatus}`);
      } catch (err: any) {
        console.error(`[FollowUp] Failed to process sequence ${seq.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[FollowUp] Scheduler error:", err.message);
  } finally {
    _running = false;
  }
}

const INTERVAL_MS = 60 * 60 * 1000; // Every hour

export function startFollowUpScheduler(): void {
  console.log("[FollowUp] Scheduler started — checking every hour");
  // Run once on startup to catch any overdue sequences
  setTimeout(() => runFollowUpScheduler(), 10_000);
  setInterval(() => runFollowUpScheduler(), INTERVAL_MS);
}

// Helper: create a follow-up sequence for a new lead
export async function startFollowUpForLead(lead: {
  id: string;
  name: string;
  email: string;
  company: string;
  type: string;
  officeSize?: string | null;
  staffCount?: string | null;
  budget?: string | null;
}): Promise<void> {
  try {
    // Don't create duplicate sequences
    const existing = await storage.getFollowUpSequenceByLeadId(lead.id);
    if (existing) return;

    // Calculate when to send stage 1 (24 hours from now)
    const nextSendAt = getNextSendAt(1);

    await storage.createFollowUpSequence({
      leadId: lead.id,
      leadName: lead.name,
      leadEmail: lead.email,
      leadCompany: lead.company,
      leadType: lead.type,
      officeSize: lead.officeSize ? `${lead.officeSize} sqm` : (lead.officeSize || null),
      staffCount: lead.staffCount || null,
      budget: lead.budgetRange || lead.budget || null,
      stage: 0,
      status: "active",
      nextSendAt,
      lastSentAt: null,
      stagesCompleted: [],
    });

    console.log(`[FollowUp] Sequence started for lead ${lead.id} (${lead.email}) — first email in 24h`);
  } catch (err: any) {
    console.error("[FollowUp] Failed to start sequence:", err.message);
  }
}
