import { storage } from "../storage";
import { sendFollowUpEmail, getNextSendAt, TOTAL_STAGES } from "./followUpEmails";
import type { FollowUpSequence } from "@shared/schema";

// Internal email sender that uses the Resend API directly
// (to avoid circular import with email.ts)
import { Resend } from "resend";
import { assertNexoraExecutionApproved } from "./intelligence/nexora/nexoraExecutionGate";

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
    from: "The Corporate Desk <hello@thecorporatedesk.au>",
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
        const gate = assertNexoraExecutionApproved({
          moduleKey: "follow_up",
          intent: "send_message",
          requestedBy: "nexora",
          reason: `Nexora approved follow-up stage ${nextStage} for ${seq.leadCompany || seq.leadEmail}`,
          evidence: {
            sequenceId: seq.id,
            leadEmail: seq.leadEmail,
            leadCompany: seq.leadCompany,
            stage: nextStage,
            source: "follow_up_scheduler",
          },
        });

        await sendFollowUpEmail(seq, nextStage, internalSendEmail);
        console.log("[Nexora FollowUp] Sent through execution gate", {
          sequenceId: seq.id,
          stage: nextStage,
          decision: gate.decision,
          empireScore: gate.empireScore?.empireScore,
        });

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

export function startFollowUpScheduler(): void {
  console.log("[FollowUp] Legacy in-process scheduler disabled — use durable Nexora pg-boss worker QUEUES.FOLLOWUPS_SEND");
}

// Helper: create a follow-up sequence for a new lead
export async function startFollowUpForLead(lead: {
  id: string;
  name: string;
  email: string;
  company: string;
  type: string;
  officeSize?: string | number | null;
  staffCount?: string | number | null;
  budgetMin?: string | number | null;
  budgetMax?: string | number | null;
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
      officeSize: lead.officeSize == null ? null : Number(lead.officeSize) || null,
      staffCount: lead.staffCount ? Number(String(lead.staffCount).replace(/[^0-9.-]/g, "")) || null : null,
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
