import { createHash } from "crypto";

/**
 * Normalise a company name to a stable, comparable form.
 * Strips Pty Ltd, Inc, Co, etc. Lowercases and collapses whitespace.
 */
export function normaliseCompanyName(raw?: string): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/\b(pty\s*ltd|pty|ltd|inc|llc|co\.|co|corporation|corp|group|holdings|australia|au)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalise an email address.
 */
export function normaliseEmail(raw?: string): string {
  if (!raw) return "";
  return raw.toLowerCase().trim();
}

/**
 * Hash the email body text for change detection.
 */
export function hashBody(body: string): string {
  return createHash("sha256").update(body.trim()).digest("hex").slice(0, 16);
}

/**
 * Build a stable identity hash for a logical outreach action.
 * Uses: normalised company name + normalised email + campaign key.
 *
 * This is the STRICT form — one first-contact per company+email+campaign.
 * Even if the body changes, we treat this as the same logical action.
 */
export function buildIdentityHash(opts: {
  companyName: string;
  recipientEmail: string;
  campaignKey: string;
}): string {
  const key = [
    normaliseCompanyName(opts.companyName),
    normaliseEmail(opts.recipientEmail),
    (opts.campaignKey || "default").toLowerCase().trim(),
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Build a follow-up identity hash that includes the stage number.
 * This allows follow-ups to be sent as separate logical actions.
 */
export function buildFollowUpIdentityHash(opts: {
  companyName: string;
  recipientEmail: string;
  campaignKey: string;
  stage: number;
}): string {
  const key = [
    normaliseCompanyName(opts.companyName),
    normaliseEmail(opts.recipientEmail),
    (opts.campaignKey || "default").toLowerCase().trim(),
    `stage:${opts.stage}`,
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}
