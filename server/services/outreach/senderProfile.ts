/**
 * Central Sender Profile — The Corporate Desk Outreach
 * Single source of truth for sender identity across ALL outreach emails.
 * Never use hardcoded names/phone/email anywhere else in the outreach pipeline.
 */

export const SENDER = {
  name: "Ben Mumford",
  company: "The Corporate Desk",
  title: "Premium Workspace Solutions",
  email: "sales@thecorporatedesk.au",
  phone: "0408 407 166",
  website: "https://thecorporatedesk.com.au",
  calendly: "https://calendly.com/thecorporatedesk",
} as const;

/**
 * The FROM address used when sending outreach emails.
 * Uses the verified TCD sender from environment where available.
 * Once verified: `${SENDER.name} <${SENDER.email}>`
 */
export const OUTREACH_FROM = `${SENDER.name} – ${SENDER.company} <hello@thecorporatedesk.au>`;

/**
 * HTML signature block appended to every outreach email body.
 * Renders cleanly in Gmail, Outlook, and Apple Mail.
 */
export function buildSignatureHtml(): string {
  return `
<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e8e4de;font-family:'Helvetica Neue',Arial,sans-serif">
  <p style="margin:0 0 2px;font-size:13px;color:#1a1a1a;font-weight:700;line-height:1.5">${SENDER.name}</p>
  <p style="margin:0 0 2px;font-size:12px;color:#5a5550;line-height:1.5">${SENDER.company} &nbsp;·&nbsp; ${SENDER.title}</p>
  <p style="margin:0 0 2px;font-size:12px;color:#5a5550;line-height:1.5">
    <a href="tel:${SENDER.phone.replace(/\s/g, "")}" style="color:#5a5550;text-decoration:none">${SENDER.phone}</a>
    &nbsp;·&nbsp;
    <a href="mailto:${SENDER.email}" style="color:#5a5550;text-decoration:none">${SENDER.email}</a>
  </p>
  <p style="margin:4px 0 0;font-size:11px;color:#9a9390;line-height:1.5">
    <a href="${SENDER.website}" style="color:#9a9390;text-decoration:none">${SENDER.website}</a>
  </p>
</div>`;
}

/**
 * Plain-text signature for fallback / text-only contexts.
 */
export function buildSignatureText(): string {
  return `
---
${SENDER.name}
${SENDER.company} · ${SENDER.title}
${SENDER.phone} · ${SENDER.email}
${SENDER.website}`;
}
