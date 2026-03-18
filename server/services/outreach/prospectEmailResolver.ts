/**
 * Central Prospect Email Resolver
 * THE authoritative function for finding a real external email target for a prospect.
 * Used by ALL outreach sends — never silently falls back to internal TCD inboxes.
 */

import { db } from "../../db";
import { companyContacts } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const INTERNAL_DOMAINS = [
  "thecorporatedesk.com.au",
  "resend.dev",
  "gmail.com",
  "example.com",
  "test.com",
  "placeholder.com",
];

const INTERNAL_EXACT = [
  "thecorporatedeskservice@gmail.com",
  "service@thecorporatedesk.com.au",
  "onboarding@resend.dev",
];

export type ResolvedTarget = {
  resolvedEmail: string;
  sourceType: "contact_direct" | "company_generic" | "generic_fallback";
  confidence: number;
  contactName?: string;
  blockingReason?: never;
};

export type BlockedTarget = {
  resolvedEmail: null;
  sourceType: "blocked";
  confidence: 0;
  contactName?: never;
  blockingReason: string;
};

export type EmailResolutionResult = ResolvedTarget | BlockedTarget;

function isInternalEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (INTERNAL_EXACT.some((e) => e === lower)) return true;
  const domain = lower.split("@")[1] ?? "";
  return INTERNAL_DOMAINS.some((d) => domain === d);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Resolve the best external email target for a prospect outreach.
 * Priority:
 *   1. Primary contact email (contact_direct)
 *   2. Best non-primary decision-maker contact email
 *   3. Company generic email (company_generic — if it's not internal)
 *   4. Generic fallback contact (generic_fallback — info@domain.com.au style)
 *   5. BLOCKED — no valid external email found
 *
 * NEVER returns an internal TCD email for prospect outreach.
 */
export async function resolveProspectEmail(params: {
  companyId: string;
  contactId?: string | null;
}): Promise<EmailResolutionResult> {
  const { companyId, contactId } = params;

  // 1. Try the attached contactId first
  if (contactId) {
    const contacts = await db
      .select()
      .from(companyContacts)
      .where(eq(companyContacts.id, contactId))
      .limit(1);

    const c = contacts[0];
    if (c?.email && isValidEmail(c.email) && !isInternalEmail(c.email)) {
      if (c.isBlocked) {
        return {
          resolvedEmail: null,
          sourceType: "blocked",
          confidence: 0,
          blockingReason: `Contact ${c.contactName ?? c.email} is marked as blocked`,
        };
      }
      return {
        resolvedEmail: c.email,
        sourceType: c.contactType === "generic_fallback" ? "generic_fallback" : "contact_direct",
        confidence: c.confidenceScore ?? 70,
        contactName: c.contactName ?? undefined,
      };
    }
  }

  // 2. Search all contacts for this company — primary first, then by confidence
  const allContacts = await db
    .select()
    .from(companyContacts)
    .where(
      and(
        eq(companyContacts.companyIntelligenceId, companyId),
        eq(companyContacts.isBlocked, false)
      )
    );

  // Sort: isPrimary DESC, contactType (direct beats generic), confidenceScore DESC
  const sorted = allContacts
    .filter((c) => c.email && isValidEmail(c.email!) && !isInternalEmail(c.email!))
    .sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      if (a.contactType === "direct" && b.contactType !== "direct") return -1;
      if (a.contactType !== "direct" && b.contactType === "direct") return 1;
      return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
    });

  if (sorted.length > 0) {
    const best = sorted[0];
    return {
      resolvedEmail: best.email!,
      sourceType: best.contactType === "generic_fallback" ? "generic_fallback" : "contact_direct",
      confidence: best.confidenceScore ?? 60,
      contactName: best.contactName ?? undefined,
    };
  }

  // 3. No valid external contact email found
  return {
    resolvedEmail: null,
    sourceType: "blocked",
    confidence: 0,
    blockingReason: `No valid external prospect email found for companyId: ${companyId}. Add a real contact email to unblock outreach.`,
  };
}

/**
 * Quick check — is this thread ready to send outreach?
 */
export function getContactReadiness(result: EmailResolutionResult): string {
  if (result.resolvedEmail && result.sourceType !== "blocked") {
    return "READY_TO_CONTACT";
  }
  return "NEEDS_CONTACT";
}
