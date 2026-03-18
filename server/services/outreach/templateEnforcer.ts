/**
 * Template Enforcer
 * Enforces sender identity and rejects any email with unresolved placeholders.
 *
 * Rules:
 *  1. Replace all known [Var] placeholders with real values
 *  2. Scan for any remaining [bracket] vars — BLOCK if found
 *  3. Append Ben Mumford signature if not already present
 *  4. Return { ok: true, html, subject } or { ok: false, reason, remaining }
 *
 * Called BEFORE every send and AT generation time. Never bypassed.
 */

import { SENDER, buildSignatureHtml } from "./senderProfile";

export type EnforcementOk = {
  ok: true;
  html: string;
  subject: string;
  wasModified: boolean;
};

export type EnforcementBlocked = {
  ok: false;
  reason: string;
  remainingPlaceholders: string[];
};

export type EnforcementResult = EnforcementOk | EnforcementBlocked;

// Any [Word Word] remaining after substitution is a template error
const BRACKET_PATTERN = /\[([^\]]{1,60})\]/g;

// Booking link substitutions
const BOOKING_LINK_HTML = `<a href="${SENDER.calendly}" style="color:#0f0f13;font-weight:600">book a time here</a>`;
const BOOKING_LINK_HREF = SENDER.calendly;

/**
 * Core enforcement function.
 * @param html - Raw email HTML body from AI or fallback generator
 * @param subject - Email subject line
 * @param firstName - Prospect's first name (fallback: "there")
 */
export function enforceTemplate(params: {
  html: string;
  subject: string;
  firstName?: string | null;
}): EnforcementResult {
  let { html, subject } = params;
  const firstName = (params.firstName?.trim()) || "there";
  const original = html;

  // ── Step 0: Normalize plain text to HTML FIRST, before any replacements ────
  // This prevents HTML anchor tags inserted by replacement from being escaped
  const isPlainText =
    !html.includes("<p") &&
    !html.includes("<div") &&
    !html.includes("<br") &&
    !html.includes("<a ") &&
    !html.includes("&lt;");

  if (isPlainText) {
    // Escape any raw HTML entities, convert newlines to <br> tags
    const escaped = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // Convert double newlines to paragraph breaks, single to <br>
    const paragraphed = escaped
      .split(/\n{2,}/)
      .map((para) => `<p style="font-size:14px;color:#1a1a1a;line-height:1.8;margin:0 0 16px">${para.replace(/\n/g, "<br>")}</p>`)
      .join("\n");
    html = paragraphed;
  }

  // ── Step 1: Replace all known placeholder patterns (on HTML) ───────────────

  html = html
    // Sender identity
    .replace(/\[Your Name\]/gi, SENDER.name)
    .replace(/\[My Name\]/gi, SENDER.name)
    .replace(/\[Name\]/gi, SENDER.name)
    .replace(/\[Your Company\]/gi, SENDER.company)
    .replace(/\[Company Name\]/gi, SENDER.company)
    .replace(/\[Your Phone\]/gi, SENDER.phone)
    .replace(/\[Phone\]/gi, SENDER.phone)
    .replace(/\[Your Email\]/gi, SENDER.email)

    // Prospect first name
    .replace(/\[First Name\]/gi, firstName)
    .replace(/\[Contact Name\]/gi, firstName)
    .replace(/\[Prospect Name\]/gi, firstName)
    .replace(/\[Recipient Name\]/gi, firstName)

    // Booking links — all map to clickable HTML anchor
    .replace(/\[Book a time here\]/gi, BOOKING_LINK_HTML)
    .replace(/\[Schedule a call\]/gi, BOOKING_LINK_HTML)
    .replace(/\[Book a call\]/gi, BOOKING_LINK_HTML)
    .replace(/\[Calendly Link\]/gi, BOOKING_LINK_HTML)
    .replace(/\[Booking Link\]/gi, BOOKING_LINK_HTML)
    .replace(/\[Link\]/gi, BOOKING_LINK_HREF)

    // Titles / misc
    .replace(/\[Your Title\]/gi, SENDER.title)
    .replace(/\[Title\]/gi, SENDER.title)
    .replace(/\[Your Position\]/gi, SENDER.title)
    .replace(/\[Position\]/gi, SENDER.title);

  // Do the same for subject line
  subject = subject
    .replace(/\[Your Name\]/gi, SENDER.name)
    .replace(/\[First Name\]/gi, firstName)
    .replace(/\[Company Name\]/gi, SENDER.company)
    .replace(/\[Your Company\]/gi, SENDER.company);

  // ── Step 2: Scan for any remaining [bracket] placeholders ─────────────────
  const remaining = [...html.matchAll(BRACKET_PATTERN)].map((m) => m[0]);
  const remainingInSubject = [...subject.matchAll(BRACKET_PATTERN)].map((m) => m[0]);
  const allRemaining = [...new Set([...remaining, ...remainingInSubject])];

  if (allRemaining.length > 0) {
    return {
      ok: false,
      reason: `TEMPLATE_ERROR: Unresolved placeholders detected — ${allRemaining.join(", ")}. Email blocked to protect sender reputation.`,
      remainingPlaceholders: allRemaining,
    };
  }

  // ── Step 3: Append signature (idempotent — check before appending) ─────────
  const alreadySigned =
    html.includes(SENDER.name) && html.includes(SENDER.phone);

  if (!alreadySigned) {
    html = `${html}${buildSignatureHtml()}`;
  }

  return {
    ok: true,
    html,
    subject,
    wasModified: html !== original,
  };
}

/**
 * Quick check — does this content have any unresolved brackets?
 * Used for fast pre-flight checks without full enforcement.
 */
export function hasUnresolvedPlaceholders(content: string): boolean {
  return BRACKET_PATTERN.test(content);
}
