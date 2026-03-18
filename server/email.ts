import { Resend } from "resend";
import type { OppSignal } from "./services/opportunityScoring";

const TCD_RECIPIENTS = [
  "thecorporatedeskservice@gmail.com",
];

const TCD_FROM = "The Corporate Desk <onboarding@resend.dev>";
const TCD_PHONE = "1300 977 607";
const TCD_EMAIL = "service@thecorporatedesk.com.au";
const TCD_WEBSITE = "https://thecorporatedesk.com.au";
const TCD_AEST = () => new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }) + " AEST";

// ─── Resend client ─────────────────────────────────────────────────────────────

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const SAFE_MODE = process.env.SAFE_MODE === "true";

async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ id?: string; provider?: string }> {
  const toList = Array.isArray(opts.to) ? opts.to.join(", ") : opts.to;
  console.log(`[Email] ▶ SEND START — to: ${toList} | subject: "${opts.subject}" | from: ${TCD_FROM}`);

  if (SAFE_MODE) {
    console.log(`[Email] ⏸ SAFE_MODE — suppressed email to ${toList}`);
    return {};
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[Email] ✗ FAIL — RESEND_API_KEY not set — email not sent");
    return {};
  }

  const resend = getResend()!;

  try {
    const result = await resend.emails.send({
      from: TCD_FROM,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
    });

    if (result.error) {
      console.error(`[Email] ✗ FAIL — to: ${toList} | subject: "${opts.subject}" | error: ${result.error.message}`);
      throw new Error(`Resend error: ${result.error.message}`);
    }

    console.log(`[Email] ✓ SENT — to: ${toList} | subject: "${opts.subject}" | messageId: ${result.data?.id ?? "unknown"}`);
    return { id: result.data?.id, provider: "resend" };
  } catch (err: any) {
    console.error(`[Email] ✗ EXCEPTION — to: ${toList} | subject: "${opts.subject}" | ${err.message}`);
    throw err;
  }
}

// ─── Admin template (dark luxury) ────────────────────────────────────────────

function adminRow(label: string, value: string | number | null | undefined): string {
  if (!value && value !== 0) return "";
  return `<tr>
    <td style="padding:8px 14px;border-bottom:1px solid #252530;color:#888;font-size:12px;width:170px;vertical-align:top;white-space:nowrap">${label}</td>
    <td style="padding:8px 14px;border-bottom:1px solid #252530;color:#f0f0f0;font-size:13px;vertical-align:top">${value}</td>
  </tr>`;
}

function adminSectionHeader(label: string): string {
  return `<tr>
    <td colspan="2" style="padding:14px 14px 6px;background:#0f0f13;color:#c9a84c;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase">${label}</td>
  </tr>`;
}

function adminSignalsBlock(signals: OppSignal[]): string {
  if (!signals.length) return "";
  const items = signals.map(s =>
    `<li style="font-size:12px;margin-bottom:5px;line-height:1.5">
      <span style="color:#c9a84c;font-weight:700">${s.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
      <span style="color:#777"> — ${s.reason}</span>
    </li>`
  ).join("");
  return `<tr>
    <td colspan="2" style="padding:10px 14px 12px;border-bottom:1px solid #252530">
      <ul style="margin:0;padding-left:18px">${items}</ul>
    </td>
  </tr>`;
}

function adminCtaButton(label: string, href: string): string {
  return `<tr>
    <td colspan="2" style="padding:16px 14px">
      <a href="${href}" style="display:inline-block;background:#c9a84c;color:#0f0f13;font-weight:700;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:13px;letter-spacing:0.3px">${label} →</a>
    </td>
  </tr>`;
}

function adminTemplate(title: string, body: string, accentColor = "#c9a84c"): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:660px;margin:28px auto;background:#14141c;border-radius:10px;overflow:hidden;border:1px solid #252530">
    <div style="background:linear-gradient(135deg,#1c1c28 0%,#0f0f16 100%);padding:24px 28px;border-bottom:2px solid ${accentColor}">
      <div style="font-size:10px;color:${accentColor};letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;font-weight:600">The Corporate Desk · Internal Alert</div>
      <div style="font-size:20px;font-weight:700;color:#ffffff;line-height:1.3">${title}</div>
    </div>
    <div style="padding:24px 28px">
      <table style="width:100%;border-collapse:collapse;background:#1a1a24;border-radius:8px;overflow:hidden;border:1px solid #252530">
        ${body}
      </table>
    </div>
    <div style="padding:14px 28px;border-top:1px solid #1e1e28">
      <a href="${TCD_WEBSITE}/admin/command-centre" style="color:${accentColor};font-size:12px;text-decoration:none;font-weight:600">→ Command Centre</a>
    </div>
  </div>
</body>
</html>`;
}

// ─── Customer template (clean, premium) ──────────────────────────────────────

function customerTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:580px;margin:32px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.07)">
    <div style="background:#0f0f13;padding:26px 32px">
      <div style="font-size:9px;color:#c9a84c;letter-spacing:4px;text-transform:uppercase;margin-bottom:8px;font-weight:700">The Corporate Desk</div>
      <div style="font-size:18px;font-weight:700;color:#ffffff;line-height:1.35">${title}</div>
    </div>
    <div style="padding:30px 32px 24px">
      ${body}
    </div>
    <div style="background:#f7f5f2;border-top:1px solid #e8e4de;padding:18px 32px">
      <p style="margin:0 0 3px;color:#8a8278;font-size:11px;text-transform:uppercase;letter-spacing:0.8px">Direct Line</p>
      <p style="margin:0 0 6px;color:#1a1a1a;font-size:13px;font-weight:600">${TCD_PHONE} &nbsp;·&nbsp; <a href="mailto:${TCD_EMAIL}" style="color:#1a1a1a;text-decoration:none">${TCD_EMAIL}</a></p>
      <p style="margin:0;color:#b0a89e;font-size:11px"><a href="${TCD_WEBSITE}" style="color:#b0a89e;text-decoration:none">thecorporatedesk.com.au</a> &nbsp;·&nbsp; Premium Commercial Office Furniture &amp; Fit-Outs · Australia</p>
    </div>
  </div>
</body>
</html>`;
}

function p(text: string, style = ""): string {
  return `<p style="color:#1a1a1a;font-size:14px;line-height:1.8;margin:0 0 18px;${style}">${text}</p>`;
}

function sectionLabel(text: string): string {
  return `<p style="color:#8a8278;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:22px 0 8px;border-bottom:1px solid #f0ede8;padding-bottom:6px">${text}</p>`;
}

function detailRow(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr>
    <td style="padding:7px 12px;font-size:12px;color:#8a8278;width:145px;vertical-align:top;border-bottom:1px solid #f5f2ee">${label}</td>
    <td style="padding:7px 12px;font-size:13px;color:#1a1a1a;vertical-align:top;border-bottom:1px solid #f5f2ee;font-weight:500">${value}</td>
  </tr>`;
}

function detailTable(rows: string): string {
  if (!rows) return "";
  return `<table style="width:100%;border-collapse:collapse;border:1px solid #ede9e3;border-radius:7px;overflow:hidden;margin:4px 0 22px">${rows}</table>`;
}

function cta(label: string, href: string): string {
  return `<p style="margin:24px 0 0">
    <a href="${href}" style="display:inline-block;background:#0f0f13;color:#ffffff;font-weight:700;padding:13px 26px;border-radius:7px;text-decoration:none;font-size:13px;letter-spacing:0.3px">${label} →</a>
  </p>`;
}

function goldDivider(): string {
  return `<div style="height:2px;background:linear-gradient(90deg,#c9a84c,transparent);margin:20px 0;border-radius:2px"></div>`;
}

function credibilityBar(): string {
  return `<div style="background:#f7f5f1;border-radius:7px;padding:14px 16px;margin:18px 0;border-left:3px solid #c9a84c">
    <p style="margin:0;color:#4a453e;font-size:12px;line-height:1.7">
      The Corporate Desk delivers premium commercial fit-outs across Australia.
      We work with companies scaling from <strong>10 to 200+ staff</strong> — across CBD offices, suburban campuses, and multi-site projects.
      Our workspace consultants specialise in high-specification environments where design, procurement, and delivery are managed as a single commercial project.
    </p>
  </div>`;
}

// ─── ADMIN: New lead notification ─────────────────────────────────────────────

export async function sendLeadNotification(lead: {
  name: string;
  company: string;
  email: string;
  phone?: string | null;
  officeLocation?: string | null;
  officeSize?: string | null;
  staffCount?: string | null;
  budget?: string | null;
  timeline?: string | null;
  moveDate?: string | null;
  message?: string | null;
  type?: string | null;
  opportunityScore?: number | null;
  opportunityTier?: string | null;
  estimatedValueRange?: string | null;
  nextAction?: string | null;
  signals?: OppSignal[];
}): Promise<void> {
  const isHigh = lead.opportunityTier === "high" || lead.opportunityTier === "enterprise";
  const isEnterprise = lead.opportunityTier === "enterprise";
  const isMed = lead.opportunityTier === "medium";
  const typeLabel = lead.type ? lead.type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Website Lead";
  const scoreStr = lead.opportunityScore != null ? `${lead.opportunityScore}/100` : null;
  const tierStr = lead.opportunityTier ? lead.opportunityTier.toUpperCase() : null;

  let subject: string;
  if (isHigh) {
    subject = `HIGH OPPORTUNITY — ${lead.company || lead.name}${lead.estimatedValueRange ? ` — Est. ${lead.estimatedValueRange}` : ""}${lead.staffCount ? ` · ${lead.staffCount} Staff` : ""}${lead.officeLocation ? ` · ${lead.officeLocation}` : ""}`;
  } else if (isMed) {
    subject = `NEW ${typeLabel.toUpperCase()} — ${lead.company || lead.name}${lead.officeLocation ? ` · ${lead.officeLocation}` : ""}${lead.staffCount ? ` · ${lead.staffCount} staff` : ""}`;
  } else {
    subject = `NEW ${typeLabel.toUpperCase()} — ${lead.name}${lead.company ? ` / ${lead.company}` : ""}`;
  }

  const accentColor = isHigh ? "#e8a020" : "#c9a84c";
  const titleText = isHigh ? `HIGH OPPORTUNITY: ${typeLabel}` : `New ${typeLabel}`;

  const body =
    adminSectionHeader("Contact Details") +
    adminRow("Name", lead.name) +
    adminRow("Company", lead.company) +
    adminRow("Email", lead.email) +
    adminRow("Phone", lead.phone) +
    adminRow("Location", lead.officeLocation) +
    adminSectionHeader("Project Context") +
    adminRow("Lead Type", typeLabel) +
    adminRow("Office Size", lead.officeSize) +
    adminRow("Staff Count", lead.staffCount) +
    adminRow("Budget", lead.budget) +
    adminRow("Timeline", lead.timeline) +
    adminRow("Move Date", lead.moveDate) +
    (lead.message ? adminRow("Message", `<em style="color:#bbb">${lead.message}</em>`) : "") +
    (lead.opportunityScore != null || lead.estimatedValueRange ? adminSectionHeader("Commercial Intelligence") : "") +
    adminRow("Opportunity Score", scoreStr) +
    adminRow("Opportunity Tier", tierStr) +
    adminRow("Estimated Project Value", lead.estimatedValueRange) +
    (lead.signals?.length ? adminRow("Signals Detected", `${lead.signals.length} signals`) : "") +
    (lead.signals?.length ? adminSignalsBlock(lead.signals) : "") +
    adminSectionHeader("Next Action") +
    adminRow("Recommended Action", lead.nextAction || (isHigh ? "Call within 24h — high-intent buyer" : "Respond within 2 business days")) +
    adminRow("Received", TCD_AEST()) +
    adminCtaButton("Open Command Centre", `${TCD_WEBSITE}/admin/command-centre`);

  await sendEmail({ to: TCD_RECIPIENTS, subject, html: adminTemplate(titleText, body, accentColor) });
}

// ─── ADMIN: Planning request notification ─────────────────────────────────────

export async function sendPlanningRequestNotification(req: {
  name: string;
  company: string;
  email: string;
  phone: string;
  city?: string | null;
  projectType?: string | null;
  squareMetres?: string | null;
  staffCount?: string | null;
  budgetRange?: string | null;
  stylePreference?: string | null;
  specialRequirements?: string | null;
  fileCount: number;
  opportunityScore?: number | null;
  opportunityTier?: string | null;
  estimatedValueRange?: string | null;
  nextAction?: string | null;
  signals?: OppSignal[];
}): Promise<void> {
  const isHigh = req.opportunityTier === "high" || req.opportunityTier === "enterprise";
  const isEnterprise = req.opportunityTier === "enterprise";
  const tierStr = req.opportunityTier ? req.opportunityTier.toUpperCase() : null;
  const contextLine = [req.squareMetres ? `${req.squareMetres}sqm` : null, req.staffCount ? `${req.staffCount} staff` : null, req.city].filter(Boolean).join(" · ");

  const subject = isEnterprise
    ? `ENTERPRISE — PLANNER: ${req.company || req.name}${req.estimatedValueRange ? ` — Est. ${req.estimatedValueRange}` : ""}${contextLine ? ` · ${contextLine}` : ""}`
    : isHigh
    ? `HIGH OPPORTUNITY — PLANNER: ${req.company || req.name}${req.estimatedValueRange ? ` — Est. ${req.estimatedValueRange}` : ""}${contextLine ? ` · ${contextLine}` : ""}`
    : `NEW PLANNER SUBMISSION — ${req.company || req.name}${contextLine ? ` · ${contextLine}` : ""}`;

  const body =
    adminSectionHeader("Contact Details") +
    adminRow("Name", req.name) +
    adminRow("Company", req.company) +
    adminRow("Email", req.email) +
    adminRow("Phone", req.phone) +
    adminRow("City", req.city) +
    adminSectionHeader("Project Brief") +
    adminRow("Project Type", req.projectType) +
    adminRow("Office Size (sqm)", req.squareMetres) +
    adminRow("Staff Count", req.staffCount) +
    adminRow("Budget Range", req.budgetRange) +
    adminRow("Style Preference", req.stylePreference) +
    adminRow("Special Requirements", req.specialRequirements) +
    adminRow("Floor Plan Files", req.fileCount > 0 ? `${req.fileCount} file(s) uploaded` : "No files") +
    adminSectionHeader("Commercial Intelligence") +
    adminRow("Opportunity Score", req.opportunityScore != null ? `${req.opportunityScore}/100` : null) +
    adminRow("Opportunity Tier", tierStr) +
    adminRow("Estimated Project Value", req.estimatedValueRange) +
    (req.signals?.length ? adminRow("Signals Count", `${req.signals.length} detected`) : "") +
    (req.signals?.length ? adminSignalsBlock(req.signals) : "") +
    adminSectionHeader("Recommended Action") +
    adminRow("Next Step", req.nextAction || (isHigh ? "Priority follow-up within 24h" : "Follow up within 2 business days")) +
    adminRow("Received", TCD_AEST()) +
    adminCtaButton("Review Planning Request", `${TCD_WEBSITE}/admin/planning-requests`);

  await sendEmail({
    to: TCD_RECIPIENTS,
    subject,
    html: adminTemplate(isHigh ? "HIGH OPPORTUNITY: New Planner Submission" : "New Floor Plan & Space Planning Request", body, isHigh ? "#e8a020" : "#c9a84c"),
  });
}

// ─── ADMIN: Supplier quote notification ───────────────────────────────────────

export async function sendSupplierQuoteNotification(quote: {
  supplierName: string;
  productName: string;
  sku: string;
  quantity: number;
  colourFinish?: string | null;
  unitPrice: string;
  freightCost?: string | null;
  leadTime?: string | null;
  projectReference?: string | null;
  status: string;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  notes?: string | null;
}): Promise<void> {
  const body =
    adminSectionHeader("Supplier") +
    adminRow("Supplier", quote.supplierName) +
    adminRow("Email", quote.supplierEmail) +
    adminRow("Phone", quote.supplierPhone) +
    adminSectionHeader("Product") +
    adminRow("Product", quote.productName) +
    adminRow("SKU", quote.sku) +
    adminRow("Quantity", quote.quantity) +
    adminRow("Colour / Finish", quote.colourFinish) +
    adminRow("Unit Price", `$${quote.unitPrice} AUD`) +
    adminRow("Freight Cost", quote.freightCost ? `$${quote.freightCost} AUD` : null) +
    adminRow("Lead Time", quote.leadTime) +
    adminSectionHeader("Project") +
    adminRow("Project Reference", quote.projectReference) +
    adminRow("Status", quote.status) +
    adminRow("Notes", quote.notes) +
    adminRow("Saved", TCD_AEST());

  await sendEmail({
    to: TCD_RECIPIENTS,
    subject: `SUPPLIER QUOTE — ${quote.supplierName} · ${quote.productName} · ${quote.status}`,
    html: adminTemplate(`Supplier Quote: ${quote.supplierName}`, body),
  });
}

// ─── ADMIN + CUSTOMER: Payment confirmation ────────────────────────────────────

export async function sendPaymentConfirmationNotification(payment: {
  customerEmail: string;
  customerName?: string | null;
  sessionId: string;
  amountAud: number;
}): Promise<void> {
  const time = TCD_AEST();
  const firstName = payment.customerName ? payment.customerName.split(" ")[0] : null;
  const ref = payment.sessionId.slice(-12).toUpperCase();

  const adminBody =
    adminSectionHeader("Payment Details") +
    adminRow("Event", "AI Office Planner — Full Report Unlocked") +
    adminRow("Customer Email", payment.customerEmail) +
    adminRow("Customer Name", payment.customerName) +
    adminRow("Amount", `$${payment.amountAud.toFixed(2)} AUD`) +
    adminRow("Payment Ref", ref) +
    adminRow("Stripe Session", payment.sessionId) +
    adminSectionHeader("Action") +
    adminRow("Status", "Payment complete. Report is unlocked and accessible to customer.") +
    adminRow("Received", time) +
    adminCtaButton("Open Admin Dashboard", `${TCD_WEBSITE}/admin`);

  await sendEmail({
    to: TCD_RECIPIENTS,
    subject: `PAYMENT RECEIVED — AI Office Planner${payment.customerName ? ` — ${payment.customerName}` : ""} — $${payment.amountAud.toFixed(2)} AUD`,
    html: adminTemplate("Payment Received — AI Office Planner Report Unlocked", adminBody),
  });

  const customerBody =
    p(`${firstName ? `${firstName}, your` : "Your"} <strong>AI Office Planner report is now fully unlocked</strong>. Your payment of <strong style="color:#1a1a1a">$${payment.amountAud.toFixed(2)} AUD</strong> has been processed and confirmed.`) +
    goldDivider() +
    sectionLabel("What You Now Have Access To") +
    p(`<strong>Interactive Visual Floor Plan</strong> — your workspace zones and layout rendered in 2D, with proportional zone sizing based on your brief.<br><br>
      <strong>Furniture Specification &amp; SKUs</strong> — curated product recommendations matched to your style preference and staff count.<br><br>
      <strong>Project Cost Estimate</strong> — itemised cost breakdown including furniture, installation, and delivery.<br><br>
      <strong>Exportable Planning Report</strong> — a formatted PDF-ready workspace concept you can share with your team or fitout contractor.`) +
    detailTable(
      detailRow("Payment Confirmed", `$${payment.amountAud.toFixed(2)} AUD`) +
      detailRow("Payment Reference", ref) +
      detailRow("Your Email", payment.customerEmail) +
      detailRow("Confirmed", time)
    ) +
    sectionLabel("Your Next Step") +
    p(`Return to your planner to access the full report. If you'd like to convert this into a live quote or arrange a strategy session, contact our team directly — we can progress this from concept to delivery.`) +
    cta("Access Your Full Report", `${TCD_WEBSITE}/office-planner`) +
    `<p style="color:#8a8278;font-size:12px;margin:20px 0 0;line-height:1.6">
      To request a quote or book a consultation based on your report, call <strong style="color:#1a1a1a">${TCD_PHONE}</strong> or reply to this email. Reference: <strong>${ref}</strong>.
    </p>`;

  await sendEmail({
    to: payment.customerEmail,
    subject: `Your AI Office Planner Report is Unlocked — The Corporate Desk`,
    html: customerTemplate(`Your Workspace Report is Ready${firstName ? `, ${firstName}` : ""}`, customerBody),
  });
}

// ─── CUSTOMER: AI Planner submission (Type A) ─────────────────────────────────

export async function sendPlannerSubmissionCustomerEmail(data: {
  name: string;
  company: string;
  email: string;
  city?: string | null;
  projectType?: string | null;
  squareMetres?: string | null;
  staffCount?: string | null;
  budgetRange?: string | null;
  stylePreference?: string | null;
  specialRequirements?: string | null;
}): Promise<void> {
  const firstName = data.name.split(" ")[0];

  const contextParts = [
    data.squareMetres ? `${data.squareMetres}sqm` : null,
    data.staffCount ? `${data.staffCount} staff` : null,
    data.city || null,
    data.stylePreference || null,
  ].filter(Boolean);
  const contextStr = contextParts.length ? contextParts.join(" · ") : null;
  const budgetStr = data.budgetRange && data.budgetRange !== "Not specified" ? data.budgetRange : null;

  const detailRows =
    detailRow("Company", data.company) +
    detailRow("Location", data.city) +
    detailRow("Project Type", data.projectType) +
    detailRow("Office Size", data.squareMetres ? `${data.squareMetres} sqm` : null) +
    detailRow("Staff Capacity", data.staffCount ? `${data.staffCount} staff` : null) +
    detailRow("Budget Range", budgetStr) +
    detailRow("Style Preference", data.stylePreference) +
    detailRow("Key Requirements", data.specialRequirements);

  const projectIntro = contextStr
    ? `Based on your brief — <strong>${contextStr}</strong> — this is a project our workspace team is well positioned to develop a strong concept for.`
    : `Your workspace planning brief is with our team and we're preparing the right approach for your project.`;

  const body =
    p(`${firstName}, your workspace planning submission for <strong>${data.company}</strong> has been received and is now with our planning team.`) +
    p(projectIntro) +
    goldDivider() +
    sectionLabel("Your Project Brief") +
    (detailRows ? detailTable(detailRows) : "") +
    sectionLabel("What Happens Next") +
    p(`<strong>1. Brief Review (Today)</strong> — Our workspace consultants will review your submission and assess the scope, style, and commercial context of your project.<br><br>
       <strong>2. Concept Development (1–2 Business Days)</strong> — We'll prepare a preliminary workspace concept aligned with your brief${data.stylePreference ? `, your ${data.stylePreference} style preference,` : ""} and space requirements.<br><br>
       <strong>3. Consultation Call</strong> — One of our senior consultants will contact you to walk through the concept, discuss refinements, and outline next steps.`) +
    credibilityBar() +
    p(`If you'd like to move faster or discuss your brief directly, call our team on <strong>${TCD_PHONE}</strong>. Reference your company name and we'll connect you to the right consultant.`) +
    cta("View Our Project Portfolio", `${TCD_WEBSITE}/case-studies`);

  await sendEmail({
    to: data.email,
    subject: `Workspace Concept Initiated — ${data.company}${contextStr ? ` · ${contextStr}` : ""} — The Corporate Desk`,
    html: customerTemplate(`Your Workspace Brief is With Our Planning Team, ${firstName}`, body),
  });
}

// ─── CUSTOMER: Quote request (Type C) ─────────────────────────────────────────

export async function sendQuoteRequestCustomerEmail(data: {
  name: string;
  company: string;
  email: string;
  officeSize?: string | null;
  staffCount?: string | null;
  budget?: string | null;
  timeline?: string | null;
  message?: string | null;
  type?: string | null;
}): Promise<void> {
  const firstName = data.name.split(" ")[0];
  const isBuilder = data.type === "quote-builder";

  const contextParts = [
    data.officeSize ? `${data.officeSize}` : null,
    data.staffCount ? `${data.staffCount} staff` : null,
    data.budget || null,
  ].filter(Boolean);
  const contextStr = contextParts.length ? contextParts.join(" · ") : null;
  const budgetContext = data.budget ? `a project budget of <strong>${data.budget}</strong>` : "the scope you've described";

  const detailRows =
    detailRow("Company", data.company) +
    detailRow("Office Size", data.officeSize) +
    detailRow("Team Size", data.staffCount ? `${data.staffCount} staff` : null) +
    detailRow("Project Budget", data.budget) +
    detailRow("Target Timeline", data.timeline) +
    detailRow("Project Notes", data.message);

  const body =
    p(`${firstName}, your ${isBuilder ? "quote builder submission" : "quote request"} for <strong>${data.company}</strong> is under active review by our commercial team.`) +
    p(`For ${budgetContext}, we'll prepare a detailed, itemised proposal that covers furniture specification, procurement, delivery, and installation — matched to your space and commercial requirements.`) +
    goldDivider() +
    sectionLabel("Your Quote Request") +
    (detailRows ? detailTable(detailRows) : "") +
    sectionLabel("What Happens Next") +
    p(`<strong>Within 48 hours</strong>, you'll receive a structured proposal from our commercial team. For more complex or time-sensitive projects, we'll arrange a call to align on scope before submitting the quote.<br><br>
       ${data.timeline ? `Given your target timeline of <strong>${data.timeline}</strong>, we'll move quickly to ensure you have the information needed to make decisions on schedule.` : "If you're working to a specific timeline, call us directly and we'll prioritise your request."}`) +
    credibilityBar() +
    p(`For an immediate discussion, call our team on <strong>${TCD_PHONE}</strong>. Reference <strong>${data.company}</strong> and we'll connect you to the right consultant.`) +
    cta("Explore Our Product Range", `${TCD_WEBSITE}/products`);

  await sendEmail({
    to: data.email,
    subject: `Quote in Motion — ${data.company}${contextStr ? ` · ${contextStr}` : ""} — The Corporate Desk`,
    html: customerTemplate(`Your Quote Request is Under Active Review, ${firstName}`, body),
  });
}

// ─── CUSTOMER: Strategy call / layout plan (Type D) ───────────────────────────

export async function sendStrategyCallCustomerEmail(data: {
  name: string;
  company: string;
  email: string;
  officeSize?: string | null;
  staffCount?: string | null;
  budget?: string | null;
  timeline?: string | null;
  message?: string | null;
  type?: string | null;
}): Promise<void> {
  const firstName = data.name.split(" ")[0];
  const isLayout = data.type === "layout-plan";

  const contextParts = [
    data.officeSize ? `${data.officeSize}` : null,
    data.staffCount ? `${data.staffCount} staff` : null,
  ].filter(Boolean);
  const contextStr = contextParts.length ? contextParts.join(", ") : null;

  const detailRows =
    detailRow("Company", data.company) +
    detailRow("Office Size", data.officeSize) +
    detailRow("Team Size", data.staffCount ? `${data.staffCount} staff` : null) +
    detailRow("Project Budget", data.budget) +
    detailRow("Preferred Timeline", data.timeline) +
    detailRow("Project Context", data.message);

  const titleLine = isLayout
    ? `Your Layout Plan Request is With Our Design Team, ${firstName}`
    : `Your Strategy Consultation is Confirmed, ${firstName}`;

  const subjectLine = isLayout
    ? `Layout Plan Initiated — ${data.company}${contextStr ? ` · ${contextStr}` : ""} — The Corporate Desk`
    : `Strategy Session Confirmed — ${data.company} — The Corporate Desk`;

  const introText = isLayout
    ? `${firstName}, your layout plan request for <strong>${data.company}</strong> has been received${contextStr ? ` — our design team is now working with your brief (${contextStr})` : ""}.`
    : `${firstName}, your strategy consultation request for <strong>${data.company}</strong> has been received. One of our senior workspace consultants will contact you within one business day to confirm the session and align on your objectives.`;

  const nextSteps = isLayout
    ? `<strong>Brief Assessment (Today)</strong> — Our design team will review your space requirements and any reference materials you've provided.<br><br>
       <strong>Layout Concept (1–3 Business Days)</strong> — We'll develop a preliminary layout plan for your space${contextStr ? ` (${contextStr})` : ""}, showing zone allocation, circulation, and furniture placement.<br><br>
       <strong>Review Session</strong> — We'll walk you through the concept, discuss refinements, and outline how to proceed from concept to furnished space.`
    : `<strong>Confirmation Call (Within 1 Business Day)</strong> — A senior workspace consultant will contact you to confirm the strategy session time and send a calendar invite.<br><br>
       <strong>Pre-Session Preparation</strong> — To make the session as productive as possible, have on hand: any existing floor plans, a list of key requirements, and any budget or timeline constraints.<br><br>
       <strong>Strategy Session</strong> — We'll cover your workspace objectives, commercial constraints, design brief, and proposed next steps — including concept development, procurement, and delivery.`;

  const body =
    p(introText) +
    goldDivider() +
    sectionLabel("Your Brief") +
    (detailRows ? detailTable(detailRows) : "") +
    sectionLabel("What Happens Next") +
    p(nextSteps) +
    credibilityBar() +
    p(`For anything time-sensitive, call us directly on <strong>${TCD_PHONE}</strong>. Our consultants work across projects of all scales and can advise immediately.`) +
    cta(isLayout ? "View Our Design Portfolio" : "Explore Workplace Strategy", isLayout ? `${TCD_WEBSITE}/case-studies` : `${TCD_WEBSITE}/workplace-strategy`);

  await sendEmail({
    to: data.email,
    subject: subjectLine,
    html: customerTemplate(titleLine, body),
  });
}

// ─── CUSTOMER: General enquiry (Type E) ───────────────────────────────────────

export async function sendEnquiryCustomerEmail(data: {
  name: string;
  company?: string | null;
  email: string;
  message?: string | null;
}): Promise<void> {
  const firstName = data.name.split(" ")[0];
  const hasCompany = !!(data.company && data.company.trim());

  const body =
    p(`${firstName}, your enquiry${hasCompany ? ` from <strong>${data.company}</strong>` : ""} has been received and forwarded to the right member of our team.`) +
    p(`We respond to commercial enquiries within one business day. If your project is time-sensitive or you need an immediate answer, call us directly on <strong>${TCD_PHONE}</strong> — our team is equipped to advise without delay.`) +
    (data.message
      ? `${goldDivider()}<p style="color:#8a8278;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px">Your Message</p><div style="background:#f7f5f1;border-radius:6px;padding:14px 16px;margin:0 0 20px;border-left:3px solid #c9a84c"><p style="margin:0;color:#4a453e;font-size:13px;line-height:1.75">${data.message}</p></div>`
      : "") +
    credibilityBar() +
    p(`Whether you're planning a new office, relocating, or expanding your current space — our team can provide a structured response based on your commercial situation.`) +
    cta("Explore Our Work", `${TCD_WEBSITE}/case-studies`);

  await sendEmail({
    to: data.email,
    subject: `${hasCompany ? `${data.company} — ` : ""}Your Enquiry is with Our Team — The Corporate Desk`,
    html: customerTemplate(`Your Enquiry is with Our Team, ${firstName}`, body),
  });
}

// ─── FINANCE: Admin alert ──────────────────────────────────────────────────────

export async function sendFinanceLeadAdminEmail(data: {
  name: string;
  company: string;
  email: string;
  phone: string;
  projectValue?: string | null;
  financeType?: string | null;
  financeTerm?: string | null;
  officeSize?: string | null;
  staffCount?: string | null;
  notes?: string | null;
  sourcePage?: string | null;
  linkedId?: string | null;
  routingDestination?: string | null;
  opportunityScore?: number | null;
  estimatedValueRange?: string | null;
}): Promise<void> {
  const body =
    adminSectionHeader("Contact Details") +
    adminRow("Name", data.name) +
    adminRow("Company", data.company) +
    adminRow("Email", data.email) +
    adminRow("Phone", data.phone) +
    adminSectionHeader("Finance Request") +
    adminRow("Estimated Project Value", data.projectValue) +
    adminRow("Finance Type", data.financeType) +
    adminRow("Preferred Finance Term", data.financeTerm) +
    adminRow("Office Size", data.officeSize) +
    adminRow("Staff Count", data.staffCount) +
    adminRow("Notes", data.notes) +
    adminSectionHeader("Routing & Source") +
    adminRow("Routing Destination", data.routingDestination || "Stratton Finance") +
    adminRow("Source Page", data.sourcePage) +
    adminRow("Linked Planner / Estimate ID", data.linkedId) +
    adminRow("Opportunity Score", data.opportunityScore != null ? `${data.opportunityScore}/100` : null) +
    adminRow("Est. Value Range", data.estimatedValueRange) +
    adminRow("Received", TCD_AEST()) +
    adminCtaButton("Open Admin Dashboard", `${TCD_WEBSITE}/admin`);

  await sendEmail({
    to: TCD_RECIPIENTS,
    subject: `FINANCE LEAD — ${data.company || data.name}${data.projectValue ? ` — ${data.projectValue}` : ""}${data.financeTerm ? ` · ${data.financeTerm}` : ""}`,
    html: adminTemplate("New Finance Lead — The Corporate Desk", body, "#c9a84c"),
  });
}

// ─── FINANCE: Partner routing email ───────────────────────────────────────────

export async function sendFinanceLeadPartnerEmail(data: {
  name: string;
  company: string;
  email: string;
  phone: string;
  projectValue?: string | null;
  financeType?: string | null;
  financeTerm?: string | null;
  officeSize?: string | null;
  staffCount?: string | null;
  notes?: string | null;
  sourcePage?: string | null;
  partnerName: string;
  partnerEmails: string[];
}): Promise<void> {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f2ef;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:600px;margin:28px auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e0dcd6">
    <div style="background:#0f0f13;padding:24px 28px;border-bottom:3px solid #c9a84c">
      <div style="font-size:9px;color:#c9a84c;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;font-weight:700">The Corporate Desk — Finance Partner Referral</div>
      <div style="font-size:18px;font-weight:700;color:#ffffff">New Finance Enquiry — ${data.company}</div>
    </div>
    <div style="padding:28px">
      <p style="color:#333;font-size:14px;line-height:1.7;margin:0 0 18px">
        Hi ${data.partnerName} team,<br><br>
        A client of The Corporate Desk has expressed interest in financing their workspace project. Their details are below for your assessment.
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e8e4de;border-radius:7px;overflow:hidden;margin:0 0 20px">
        ${[
          ["Client Name", data.name],
          ["Company", data.company],
          ["Email", data.email],
          ["Phone", data.phone],
          ["Estimated Project Value", data.projectValue || "To be confirmed"],
          ["Finance Type", data.financeType || "Office Furniture / Workspace"],
          ["Preferred Term", data.financeTerm || "To be discussed"],
          ["Office Size", data.officeSize],
          ["Staff Count", data.staffCount],
          ["Notes", data.notes],
          ["Source", data.sourcePage || "The Corporate Desk — thecorporatedesk.com.au"],
        ].filter(([, v]) => v).map(([l, v]) => `
          <tr>
            <td style="padding:8px 12px;font-size:12px;color:#8a8278;width:160px;border-bottom:1px solid #f0ede8">${l}</td>
            <td style="padding:8px 12px;font-size:13px;color:#1a1a1a;font-weight:500;border-bottom:1px solid #f0ede8">${v}</td>
          </tr>`).join("")}
      </table>
      <p style="color:#555;font-size:13px;line-height:1.7;margin:0 0 18px">
        Please reach out to the client directly to progress their enquiry. If you need any additional information about the project or our quote, contact The Corporate Desk directly on <strong>1300 977 607</strong> or reply to this email.
      </p>
      <p style="color:#8a8278;font-size:11px;line-height:1.6;border-top:1px solid #f0ede8;padding-top:14px;margin-top:18px">
        The Corporate Desk · 1300 977 607 · service@thecorporatedesk.com.au · thecorporatedesk.com.au<br>
        10 Primrose St Bowen Hills QLD 4006 · Premium Commercial Office Furniture &amp; Fit-Outs · Australia
      </p>
    </div>
  </div>
</body>
</html>`;

  await sendEmail({
    to: [...data.partnerEmails, "service@thecorporatedesk.com.au"],
    subject: `New Finance Lead – The Corporate Desk — ${data.company}${data.projectValue ? ` — ${data.projectValue}` : ""}`,
    html,
  });
}

// ─── FINANCE: Customer confirmation ───────────────────────────────────────────

export async function sendFinanceLeadCustomerEmail(data: {
  name: string;
  company: string;
  email: string;
  projectValue?: string | null;
  financeTerm?: string | null;
  financeType?: string | null;
  partnerName: string;
}): Promise<void> {
  const firstName = data.name.split(" ")[0];
  const body =
    p(`${firstName}, your workspace finance enquiry for <strong>${data.company}</strong> has been received and is now under review.`) +
    p(`Your enquiry has been referred to <strong>${data.partnerName}</strong>, our preferred finance partner for this type of project. They will be in contact with you directly to discuss your options and begin the assessment process.`) +
    goldDivider() +
    sectionLabel("Your Finance Enquiry") +
    detailTable(
      detailRow("Company", data.company) +
      detailRow("Estimated Project Value", data.projectValue || "To be confirmed") +
      detailRow("Finance Type", data.financeType || "Office Furniture / Workspace") +
      detailRow("Preferred Term", data.financeTerm || "To be discussed") +
      detailRow("Submitted", TCD_AEST())
    ) +
    sectionLabel("What Happens Next") +
    p(`<strong>1. Finance Partner Review</strong> — Your enquiry has been sent to ${data.partnerName}, who will review your details and reach out directly to progress your application.<br><br>
       <strong>2. Assessment</strong> — The finance partner will assess your business, the project scope, and the best finance structure for your situation.<br><br>
       <strong>3. Formal Offer</strong> — Once assessed, you'll receive a formal finance offer for your review. All terms are subject to lender approval.`) +
    credibilityBar() +
    `<div style="background:#fffbf0;border:1px solid #e8d9a0;border-radius:7px;padding:14px 16px;margin:18px 0">
      <p style="margin:0;color:#6b5c22;font-size:12px;line-height:1.7">
        <strong>Important:</strong> This is an indicative enquiry only. Repayment estimates provided are for guidance purposes and do not constitute a finance offer or guarantee of approval. Final approval and pricing are subject to lender credit assessment.
      </p>
    </div>` +
    p(`If you have any questions in the meantime, call our team directly on <strong>${TCD_PHONE}</strong> and reference your company name.`) +
    cta("Explore Our Product Range", `${TCD_WEBSITE}/products`);

  await sendEmail({
    to: data.email,
    subject: `Workspace Finance Enquiry Received — ${data.company} — The Corporate Desk`,
    html: customerTemplate(`Your Finance Enquiry is Being Reviewed, ${firstName}`, body),
  });
}

// ─── Formal Quote Email ────────────────────────────────────────────────────────

export async function sendFormalQuoteEmail(quote: {
  id: string; quoteNumber: string; clientName: string; companyName?: string | null;
  email: string; phone?: string | null; projectSummary?: string | null;
  quoteItems?: string | null; subtotal?: number | null; freightCost?: number | null;
  installationCost?: number | null; otherCosts?: number | null; discount?: number | null;
  gst?: number | null; totalIncGst?: number | null; financeMonthlyEstimate?: number | null;
  notes?: string | null; validityDays?: number | null; preparedBy?: string | null;
}): Promise<void> {
  const fmt = (n?: number | null) => n ? `$${n.toLocaleString("en-AU")}` : "$0";
  const firstName = quote.clientName.split(" ")[0];
  const printUrl = `${TCD_WEBSITE}/admin/quotes/${quote.id}/print`;

  let lineItemsHtml = "";
  if (quote.quoteItems) {
    try {
      const items = JSON.parse(quote.quoteItems) as Array<{ productName: string; quantity: number; unitPrice: number; lineTotal: number; category?: string; variant?: string }>;
      if (items.length > 0) {
        lineItemsHtml = `
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
          <thead>
            <tr style="background:#f7f5f2">
              <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e8e4de;color:#6b6258;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.8px">Item</th>
              <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #e8e4de;color:#6b6258;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;width:60px">Qty</th>
              <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e8e4de;color:#6b6258;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;width:90px">Unit</th>
              <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e8e4de;color:#6b6258;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;width:90px">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, i) => `
            <tr style="background:${i % 2 === 0 ? "#fff" : "#fafaf9"}">
              <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;color:#1a1a1a;font-size:13px">${item.productName}${item.variant ? ` <span style="color:#888;font-size:11px">(${item.variant})</span>` : ""}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;text-align:center;color:#1a1a1a">${item.quantity}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;text-align:right;color:#1a1a1a">${fmt(item.unitPrice)}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;text-align:right;color:#1a1a1a;font-weight:600">${fmt(item.lineTotal)}</td>
            </tr>`).join("")}
          </tbody>
        </table>`;
      }
    } catch {}
  }

  const totalsHtml = `
    <table style="width:240px;margin-left:auto;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:5px 10px;color:#6b6258">Subtotal</td><td style="padding:5px 10px;text-align:right;color:#1a1a1a">${fmt(quote.subtotal)}</td></tr>
      ${(quote.freightCost ?? 0) > 0 ? `<tr><td style="padding:5px 10px;color:#6b6258">Freight & Delivery</td><td style="padding:5px 10px;text-align:right;color:#1a1a1a">${fmt(quote.freightCost)}</td></tr>` : ""}
      ${(quote.installationCost ?? 0) > 0 ? `<tr><td style="padding:5px 10px;color:#6b6258">Installation</td><td style="padding:5px 10px;text-align:right;color:#1a1a1a">${fmt(quote.installationCost)}</td></tr>` : ""}
      ${(quote.otherCosts ?? 0) > 0 ? `<tr><td style="padding:5px 10px;color:#6b6258">Other Costs</td><td style="padding:5px 10px;text-align:right;color:#1a1a1a">${fmt(quote.otherCosts)}</td></tr>` : ""}
      ${(quote.discount ?? 0) > 0 ? `<tr><td style="padding:5px 10px;color:#6b6258">Discount</td><td style="padding:5px 10px;text-align:right;color:#c05050">−${fmt(quote.discount)}</td></tr>` : ""}
      <tr><td style="padding:5px 10px;color:#6b6258">GST (10%)</td><td style="padding:5px 10px;text-align:right;color:#1a1a1a">${fmt(quote.gst)}</td></tr>
      <tr style="background:#0f0f13"><td style="padding:10px 10px;color:#c9a84c;font-weight:700;font-size:14px">Total (inc. GST)</td><td style="padding:10px 10px;text-align:right;color:#c9a84c;font-weight:700;font-size:14px">${fmt(quote.totalIncGst)}</td></tr>
    </table>`;

  const financeHtml = quote.financeMonthlyEstimate && quote.financeMonthlyEstimate > 0
    ? `<div style="background:#fffbf0;border:1px solid #e8d9a0;border-radius:8px;padding:14px 16px;margin:18px 0">
        <p style="margin:0 0 4px;color:#8a6d00;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Finance Option Available</p>
        <p style="margin:0;color:#6b5c22;font-size:13px">From approximately <strong style="font-size:15px;color:#1a1a1a">${fmt(quote.financeMonthlyEstimate)}/month</strong> — subject to lender approval.</p>
      </div>`
    : "";

  const body = sectionLabel("Your Formal Quote") +
    p(`${firstName}, please find your formal quotation from The Corporate Desk below.${quote.companyName ? ` This quote has been prepared for <strong>${quote.companyName}</strong>.` : ""}`) +
    (quote.projectSummary ? p(`<em>${quote.projectSummary}</em>`) : "") +
    lineItemsHtml + totalsHtml + financeHtml +
    (quote.notes ? sectionLabel("Notes") + p(quote.notes) : "") +
    sectionLabel("Quote Details") +
    `<table style="font-size:13px;border-collapse:collapse;width:100%;margin-bottom:18px">
      <tr><td style="padding:5px 0;color:#8a8278;width:140px">Quote Number</td><td style="padding:5px 0;color:#1a1a1a;font-weight:600">${quote.quoteNumber}</td></tr>
      <tr><td style="padding:5px 0;color:#8a8278">Valid For</td><td style="padding:5px 0;color:#1a1a1a">${quote.validityDays ?? 30} days from issue</td></tr>
      <tr><td style="padding:5px 0;color:#8a8278">Prepared By</td><td style="padding:5px 0;color:#1a1a1a">${quote.preparedBy ?? "The Corporate Desk"}</td></tr>
    </table>` +
    cta("View Full Quote as PDF", printUrl) +
    p(`To accept this quote, reply to this email or call us on <strong>${TCD_PHONE}</strong>. Prices are valid for ${quote.validityDays ?? 30} days from the date of this email.`, "font-size:13px;color:#6b6258");

  await sendEmail({
    to: quote.email,
    subject: `Formal Quote ${quote.quoteNumber} — The Corporate Desk`,
    html: customerTemplate(`Your Quote from The Corporate Desk, ${firstName}`, body),
  });

  // Also send internal notification
  await sendEmail({
    to: TCD_RECIPIENTS,
    subject: `[Quote Sent] ${quote.quoteNumber} — ${quote.clientName}${quote.companyName ? ` / ${quote.companyName}` : ""} — ${fmt(quote.totalIncGst)} inc GST`,
    html: adminTemplate("Quote Dispatched", `<table style="width:100%;border-collapse:collapse">
      ${adminRow("Quote Number", quote.quoteNumber)}
      ${adminRow("Client", quote.clientName)}
      ${adminRow("Company", quote.companyName ?? "")}
      ${adminRow("Email", quote.email)}
      ${adminRow("Phone", quote.phone ?? "")}
      ${adminRow("Total (inc GST)", fmt(quote.totalIncGst))}
      ${adminRow("Finance Est.", quote.financeMonthlyEstimate ? fmt(quote.financeMonthlyEstimate) + "/mo" : "")}
      ${adminRow("Valid For", `${quote.validityDays ?? 30} days`)}
    </table>`),
  });
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendTestEmail(): Promise<{
  success: boolean;
  messageId?: string;
  provider?: string;
  from?: string;
  to?: string;
  subject?: string;
  envStatus: {
    RESEND_API_KEY: string;
    SAFE_MODE: string;
    fromAddress: string;
    domainVerified: boolean;
    note: string;
  };
  error?: string;
  domainStatus?: string;
}> {
  const PRIMARY_TO = "service@thecorporatedesk.com.au";
  const FALLBACK_TO = "thecorporatedeskservice@gmail.com";
  const SUBJECT = "TCD Email Test";
  const HTML = `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
    <h2 style="color:#c9a84c">TCD Email Test</h2>
    <p style="color:#333">If you receive this, email is working.</p>
    <p style="color:#888;font-size:12px">Sent: ${new Date().toISOString()}</p>
  </div>`;

  const envStatus = {
    RESEND_API_KEY: process.env.RESEND_API_KEY ? `SET (length: ${process.env.RESEND_API_KEY.length})` : "NOT SET",
    SAFE_MODE: process.env.SAFE_MODE ?? "not set (defaults to live)",
    fromAddress: TCD_FROM,
    domainVerified: false,
    note: "Pending test",
  };

  console.log(`[Email:TestSend] ENV check — RESEND_API_KEY: ${envStatus.RESEND_API_KEY} | SAFE_MODE: ${envStatus.SAFE_MODE}`);

  if (!process.env.RESEND_API_KEY) {
    console.error("[Email:TestSend] ✗ RESEND_API_KEY not set — cannot send test email");
    return {
      success: false,
      error: "RESEND_API_KEY environment variable is not set. Add it to your Replit Secrets.",
      envStatus,
    };
  }

  // Try primary recipient (service@thecorporatedesk.com.au)
  console.log(`[Email:TestSend] Attempting send → ${PRIMARY_TO}`);
  try {
    const result = await sendEmail({ to: PRIMARY_TO, subject: SUBJECT, html: HTML });
    envStatus.domainVerified = true;
    envStatus.note = "Domain thecorporatedesk.com.au is verified in Resend ✓";
    console.log(`[Email:TestSend] ✓ Primary send succeeded — messageId: ${result.id}`);
    return {
      success: true,
      messageId: result.id,
      provider: result.provider ?? "resend",
      from: TCD_FROM,
      to: PRIMARY_TO,
      subject: SUBJECT,
      envStatus,
      domainStatus: "VERIFIED — domain thecorporatedesk.com.au is active in Resend",
    };
  } catch (primaryErr: any) {
    const isDomainError = primaryErr.message?.includes("verify a domain") ||
      primaryErr.message?.includes("own email address") ||
      primaryErr.message?.includes("testing emails");

    console.warn(`[Email:TestSend] Primary recipient failed — ${primaryErr.message}`);

    if (!isDomainError) {
      // Not a domain issue — real failure
      return {
        success: false,
        error: primaryErr.message,
        from: TCD_FROM,
        to: PRIMARY_TO,
        subject: SUBJECT,
        envStatus: { ...envStatus, note: "Send failed with unexpected error" },
      };
    }

    // Domain not verified — try fallback admin address (always works with Resend test keys)
    console.log(`[Email:TestSend] Domain not verified — trying fallback: ${FALLBACK_TO}`);
    try {
      const fallbackResult = await sendEmail({ to: FALLBACK_TO, subject: `[Fallback] ${SUBJECT}`, html: HTML });
      envStatus.domainVerified = false;
      envStatus.note = "Domain thecorporatedesk.com.au NOT verified in Resend. Fallback to thecorporatedeskservice@gmail.com succeeded.";
      console.log(`[Email:TestSend] ✓ Fallback send succeeded — messageId: ${fallbackResult.id}`);
      return {
        success: true,
        messageId: fallbackResult.id,
        provider: fallbackResult.provider ?? "resend",
        from: TCD_FROM,
        to: FALLBACK_TO,
        subject: `[Fallback] ${SUBJECT}`,
        envStatus,
        domainStatus: "UNVERIFIED — thecorporatedesk.com.au not yet verified at resend.com/domains. Test sent to admin fallback instead. Verify domain to send to any recipient.",
        error: `Primary send to ${PRIMARY_TO} blocked: ${primaryErr.message}`,
      };
    } catch (fallbackErr: any) {
      console.error(`[Email:TestSend] ✗ Both sends failed — ${fallbackErr.message}`);
      return {
        success: false,
        error: `Primary: ${primaryErr.message} | Fallback: ${fallbackErr.message}`,
        from: TCD_FROM,
        to: PRIMARY_TO,
        subject: SUBJECT,
        envStatus: { ...envStatus, note: "Both primary and fallback sends failed" },
        domainStatus: "UNVERIFIED — domain thecorporatedesk.com.au not verified in Resend",
      };
    }
  }
}

export async function sendOutreachEmail(opts: {
  to: string;
  subject: string;
  html: string;
  companyName: string;
  firstName?: string | null;
}): Promise<{ id?: string; provider?: string }> {
  // ── Final safety net: enforce template before every send ──────────────────
  // Import here to avoid circular dependency issues
  const { enforceTemplate } = await import("./services/outreach/templateEnforcer");
  const { OUTREACH_FROM } = await import("./services/outreach/senderProfile");

  const enforcement = enforceTemplate({
    html: opts.html,
    subject: opts.subject,
    firstName: opts.firstName ?? null,
  });

  if (!enforcement.ok) {
    const errMsg = `[OutreachEmail] BLOCKED — ${opts.companyName} | ${enforcement.reason}`;
    console.error(errMsg);
    throw new Error(enforcement.reason);
  }

  // Use outreach-specific FROM (Ben Mumford identity)
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error("RESEND_API_KEY not set — outreach email not sent");
  }

  const toList = opts.to;
  console.log(`[OutreachEmail] ▶ SEND — to: ${toList} | company: ${opts.companyName} | from: ${OUTREACH_FROM}`);

  if (process.env.SAFE_MODE === "true") {
    console.log(`[OutreachEmail] ⏸ SAFE_MODE — suppressed send to ${toList}`);
    return {};
  }

  const { Resend } = await import("resend");
  const resend = new Resend(resendKey);

  const result = await resend.emails.send({
    from: OUTREACH_FROM,
    to: [opts.to],
    subject: enforcement.subject,
    html: enforcement.html,
  });

  if (result.error) {
    console.error(`[OutreachEmail] ✗ FAIL — to: ${toList} | error: ${result.error.message}`);
    throw new Error(`Resend error: ${result.error.message}`);
  }

  console.log(`[OutreachEmail] ✓ SENT — to: ${toList} | company: ${opts.companyName} | messageId: ${result.data?.id ?? "unknown"}`);
  return { id: result.data?.id, provider: "resend" };
}
