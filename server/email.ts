import nodemailer from "nodemailer";
import type { OppSignal } from "./services/opportunityScoring";

const TCD_RECIPIENTS = [
  "service@thecorporatedesk.com.au",
  "thecorporatedeskservice@gmail.com",
];

const TCD_PHONE = "1300 977 607";
const TCD_EMAIL = "service@thecorporatedesk.com.au";
const TCD_WEBSITE = "https://thecorporatedesk.com.au";

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

// ─── Shared template helpers ──────────────────────────────────────────────────

function row(label: string, value: string | number | null | undefined): string {
  if (!value && value !== 0) return "";
  return `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#999;font-size:13px;width:160px;vertical-align:top">${label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#f0f0f0;font-size:13px;vertical-align:top">${value}</td>
    </tr>`;
}

function adminTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#16161e;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a">
    <div style="background:linear-gradient(135deg,#1a1a24,#0f0f13);padding:28px 32px;border-bottom:2px solid #c9a84c">
      <div style="font-size:11px;color:#c9a84c;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px">The Corporate Desk — Admin</div>
      <div style="font-size:22px;font-weight:700;color:#ffffff">${title}</div>
    </div>
    <div style="padding:28px 32px">
      <table style="width:100%;border-collapse:collapse;background:#1c1c26;border-radius:8px;overflow:hidden">
        ${body}
      </table>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a;text-align:center">
      <a href="${TCD_WEBSITE}/admin/command-centre" style="color:#c9a84c;font-size:12px;text-decoration:none">Admin Command Centre</a>
      <span style="color:#555;font-size:12px;margin:0 8px">·</span>
      <a href="${TCD_WEBSITE}" style="color:#c9a84c;font-size:12px;text-decoration:none">thecorporatedesk.com.au</a>
    </div>
  </div>
</body>
</html>`;
}

// Customer-facing template — lighter, premium branded
function customerTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f4f2;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:#0f0f13;padding:28px 32px">
      <div style="font-size:10px;color:#c9a84c;letter-spacing:4px;text-transform:uppercase;margin-bottom:6px">The Corporate Desk</div>
      <div style="font-size:20px;font-weight:700;color:#ffffff;line-height:1.3">${title}</div>
    </div>
    <div style="padding:32px">
      ${body}
    </div>
    <div style="background:#f9f8f6;border-top:1px solid #e8e5e0;padding:20px 32px">
      <p style="margin:0 0 4px;color:#6b6560;font-size:12px">Questions? Contact our team:</p>
      <p style="margin:0;color:#0f0f13;font-size:13px;font-weight:600">${TCD_PHONE} &nbsp;·&nbsp; <a href="mailto:${TCD_EMAIL}" style="color:#0f0f13;text-decoration:none">${TCD_EMAIL}</a></p>
      <p style="margin:8px 0 0;color:#9e9890;font-size:11px"><a href="${TCD_WEBSITE}" style="color:#9e9890;text-decoration:none">thecorporatedesk.com.au</a> &nbsp;·&nbsp; Premium Commercial Furniture &amp; Office Fit-Outs, Australia</p>
    </div>
  </div>
</body>
</html>`;
}

function customerPara(text: string): string {
  return `<p style="color:#1a1a1a;font-size:14px;line-height:1.75;margin:0 0 16px">${text}</p>`;
}

function customerDetailRow(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr>
    <td style="padding:8px 12px;font-size:13px;color:#6b6560;width:140px;vertical-align:top;border-bottom:1px solid #f0ece6">${label}</td>
    <td style="padding:8px 12px;font-size:13px;color:#1a1a1a;vertical-align:top;border-bottom:1px solid #f0ece6">${value}</td>
  </tr>`;
}

function customerDetailsTable(rows: string): string {
  return `<table style="width:100%;border-collapse:collapse;border:1px solid #f0ece6;border-radius:8px;overflow:hidden;margin:16px 0 24px">${rows}</table>`;
}

function customerCta(label: string, href: string): string {
  return `<p style="margin:24px 0 0"><a href="${href}" style="display:inline-block;background:#0f0f13;color:#ffffff;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:14px;letter-spacing:0.3px">${label} →</a></p>`;
}

function signalsSummary(signals: OppSignal[]): string {
  if (!signals.length) return "";
  const items = signals.map(s => `<li style="color:#f0f0f0;font-size:12px;margin-bottom:4px">
    <span style="color:#c9a84c;font-weight:600">${s.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
    <span style="color:#888"> — ${s.reason}</span>
  </li>`).join("");
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#999;font-size:13px;width:160px;vertical-align:top">Signals Detected</td>
    <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;font-size:12px;vertical-align:top">
      <ul style="margin:0;padding-left:16px">${items}</ul>
    </td>
  </tr>`;
}

// ─── ADMIN EMAILS ─────────────────────────────────────────────────────────────

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
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP not configured — skipping lead notification");
    return;
  }

  const formLabel = lead.type
    ? lead.type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Website Lead";

  const isHigh = lead.opportunityTier === "high";
  const tierLabel = lead.opportunityTier
    ? lead.opportunityTier.charAt(0).toUpperCase() + lead.opportunityTier.slice(1)
    : null;

  const body =
    row("Form", formLabel) +
    row("Name", lead.name) +
    row("Company", lead.company) +
    row("Email", lead.email) +
    row("Phone", lead.phone) +
    row("Location", lead.officeLocation) +
    row("Office Size", lead.officeSize) +
    row("Staff Count", lead.staffCount) +
    row("Budget", lead.budget) +
    row("Timeline", lead.timeline) +
    row("Move Date", lead.moveDate) +
    row("Message", lead.message) +
    (lead.opportunityScore != null ? row("Opportunity Score", `${lead.opportunityScore}/100`) : "") +
    (tierLabel ? row("Opportunity Tier", tierLabel) : "") +
    (lead.estimatedValueRange ? row("Est. Project Value", lead.estimatedValueRange) : "") +
    (lead.nextAction ? row("Next Action", lead.nextAction) : "") +
    (lead.signals?.length ? signalsSummary(lead.signals) : "") +
    row("Admin Link", `${TCD_WEBSITE}/admin/command-centre`) +
    row("Received", new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }) + " AEST");

  const subjectPrefix = isHigh
    ? `HIGH OPPORTUNITY — ${lead.name} / ${lead.company}${lead.estimatedValueRange ? ` — Est. ${lead.estimatedValueRange}` : ""}`
    : `New ${formLabel}: ${lead.name} — ${lead.company}`;

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: TCD_RECIPIENTS,
    subject: subjectPrefix,
    html: adminTemplate(isHigh ? `HIGH OPPORTUNITY: New ${formLabel}` : `New ${formLabel}`, body),
  });
}

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
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP not configured — skipping supplier quote notification");
    return;
  }

  const body =
    row("Supplier", quote.supplierName) +
    row("Supplier Email", quote.supplierEmail) +
    row("Supplier Phone", quote.supplierPhone) +
    row("Product", quote.productName) +
    row("SKU", quote.sku) +
    row("Quantity", quote.quantity) +
    row("Colour / Finish", quote.colourFinish) +
    row("Unit Price", `$${quote.unitPrice}`) +
    row("Freight Cost", quote.freightCost ? `$${quote.freightCost}` : null) +
    row("Lead Time", quote.leadTime) +
    row("Project Reference", quote.projectReference) +
    row("Status", quote.status) +
    row("Notes", quote.notes) +
    row("Saved", new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }) + " AEST");

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: TCD_RECIPIENTS,
    subject: `Supplier Quote: ${quote.supplierName} — ${quote.productName} (${quote.status})`,
    html: adminTemplate("Supplier Quote Notification", body),
  });
}

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
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP not configured — skipping planning request notification");
    return;
  }

  const isHigh = req.opportunityTier === "high";
  const tierLabel = req.opportunityTier
    ? req.opportunityTier.charAt(0).toUpperCase() + req.opportunityTier.slice(1)
    : null;

  const body =
    row("Name", req.name) +
    row("Company", req.company) +
    row("Email", req.email) +
    row("Phone", req.phone) +
    row("City", req.city) +
    row("Project Type", req.projectType) +
    row("Office Size (sqm)", req.squareMetres) +
    row("Staff Count", req.staffCount) +
    row("Budget Range", req.budgetRange) +
    row("Style Preference", req.stylePreference) +
    row("Special Requirements", req.specialRequirements) +
    row("Files Uploaded", req.fileCount > 0 ? `${req.fileCount} file(s)` : "None") +
    (req.opportunityScore != null ? row("Opportunity Score", `${req.opportunityScore}/100`) : "") +
    (tierLabel ? row("Opportunity Tier", tierLabel) : "") +
    (req.estimatedValueRange ? row("Est. Project Value", req.estimatedValueRange) : "") +
    (req.nextAction ? row("Next Action", req.nextAction) : "") +
    (req.signals?.length ? signalsSummary(req.signals) : "") +
    row("Admin Link", `${TCD_WEBSITE}/admin/planning-requests`) +
    row("Received", new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }) + " AEST");

  const subject = isHigh
    ? `HIGH OPPORTUNITY — Floor Plan: ${req.name} / ${req.company}${req.estimatedValueRange ? ` — Est. ${req.estimatedValueRange}` : ""}`
    : `Floor Plan Request: ${req.name} — ${req.company || req.city || "New Enquiry"}`;

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: TCD_RECIPIENTS,
    subject,
    html: adminTemplate(isHigh ? "HIGH OPPORTUNITY: New Floor Plan / Space Planning Request" : "New Floor Plan / Space Planning Request", body),
  });
}

export async function sendPaymentConfirmationNotification(payment: {
  customerEmail: string;
  customerName?: string | null;
  sessionId: string;
  amountAud: number;
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP not configured — skipping payment confirmation");
    return;
  }

  const time = new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }) + " AEST";

  const adminBody =
    row("Type", "AI Office Planner — Payment Received") +
    row("Customer Email", payment.customerEmail) +
    row("Customer Name", payment.customerName) +
    row("Amount", `$${payment.amountAud.toFixed(2)} AUD`) +
    row("Stripe Session", payment.sessionId) +
    row("Admin Link", `${TCD_WEBSITE}/admin`) +
    row("Received", time);

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: TCD_RECIPIENTS,
    subject: `Payment Received — AI Office Planner — ${payment.customerEmail}`,
    html: adminTemplate("Payment Received — AI Office Planner", adminBody),
  });

  // Customer confirmation email
  const customerBodyHtml =
    customerPara(`Thank you for unlocking your personalised <strong>AI Office Planner report</strong>, ${payment.customerName ? payment.customerName.split(" ")[0] : ""}.`) +
    customerPara(`Your payment of <strong>$${payment.amountAud.toFixed(2)} AUD</strong> has been received and your full report is now available. Return to the planner to access your interactive floor plan, furniture specifications, cost estimate, and export options.`) +
    customerDetailsTable(
      customerDetailRow("Your Email", payment.customerEmail) +
      customerDetailRow("Amount Paid", `$${payment.amountAud.toFixed(2)} AUD`) +
      customerDetailRow("Payment Ref", payment.sessionId.slice(-12).toUpperCase()) +
      customerDetailRow("Date", time)
    ) +
    customerCta("View Your Report", `${TCD_WEBSITE}/office-planner`);

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: payment.customerEmail,
    subject: "Your AI Office Planner Report is Ready — The Corporate Desk",
    html: customerTemplate("Your AI Office Planner Report is Ready", customerBodyHtml),
  });
}

// ─── CUSTOMER EMAILS ──────────────────────────────────────────────────────────

/**
 * Type A — AI Planner submission received (customer confirmation)
 */
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
  const transporter = createTransporter();
  if (!transporter) return;

  const firstName = data.name.split(" ")[0];

  const detailRows =
    customerDetailRow("Company", data.company) +
    customerDetailRow("City", data.city) +
    customerDetailRow("Project Type", data.projectType) +
    customerDetailRow("Office Size", data.squareMetres ? `${data.squareMetres} sqm` : null) +
    customerDetailRow("Staff Count", data.staffCount ? `${data.staffCount} staff` : null) +
    customerDetailRow("Budget Range", data.budgetRange) +
    customerDetailRow("Style Preference", data.stylePreference) +
    customerDetailRow("Key Requirements", data.specialRequirements);

  const bodyHtml =
    customerPara(`Thank you, <strong>${firstName}</strong>. We've received your workspace planning submission for <strong>${data.company}</strong>.`) +
    customerPara("Our team is reviewing your brief and preparing a tailored concept for your space. You'll hear from us shortly with next steps — typically within one business day.") +
    (detailRows ? `<p style="color:#6b6560;font-size:13px;font-weight:600;margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.5px">Your Submission Summary</p>${customerDetailsTable(detailRows)}` : "") +
    customerPara("In the meantime, if you'd like to discuss your project sooner, call us on <strong>${TCD_PHONE}</strong> — we're happy to talk through your brief.".replace("${TCD_PHONE}", TCD_PHONE)) +
    customerCta("Explore Our Fit-Out Portfolio", `${TCD_WEBSITE}/case-studies`);

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: data.email,
    subject: `Your Workspace Planning Brief is Received — The Corporate Desk`,
    html: customerTemplate(`Your Workspace Brief is Confirmed, ${firstName}`, bodyHtml),
  });
}

/**
 * Type C — Quote request received (customer confirmation)
 */
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
  const transporter = createTransporter();
  if (!transporter) return;

  const firstName = data.name.split(" ")[0];
  const label = data.type === "quote-builder" ? "Quote Builder" : "Quote Request";

  const detailRows =
    customerDetailRow("Company", data.company) +
    customerDetailRow("Office Size", data.officeSize) +
    customerDetailRow("Team Size", data.staffCount ? `${data.staffCount} staff` : null) +
    customerDetailRow("Budget", data.budget) +
    customerDetailRow("Timeline", data.timeline) +
    customerDetailRow("Project Notes", data.message);

  const bodyHtml =
    customerPara(`Thank you, <strong>${firstName}</strong>. We've received your ${label.toLowerCase()} for <strong>${data.company}</strong>.`) +
    customerPara("Our team will prepare a detailed, itemised proposal tailored to your requirements. You can expect a response within one to two business days.") +
    (detailRows ? `<p style="color:#6b6560;font-size:13px;font-weight:600;margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.5px">Your Request Summary</p>${customerDetailsTable(detailRows)}` : "") +
    customerPara(`If you need an urgent turnaround, call us directly on <strong>${TCD_PHONE}</strong> and reference your company name.`) +
    customerCta("View Our Product Range", `${TCD_WEBSITE}/products`);

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: data.email,
    subject: `Your Quote Request is Confirmed — The Corporate Desk`,
    html: customerTemplate(`Quote Request Confirmed, ${firstName}`, bodyHtml),
  });
}

/**
 * Type D — Strategy call / layout plan request (customer confirmation)
 */
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
  const transporter = createTransporter();
  if (!transporter) return;

  const firstName = data.name.split(" ")[0];
  const isLayout = data.type === "layout-plan";
  const requestLabel = isLayout ? "layout plan request" : "strategy consultation request";
  const title = isLayout ? `Your Layout Plan Request is Confirmed, ${firstName}` : `Strategy Consultation Confirmed, ${firstName}`;

  const detailRows =
    customerDetailRow("Company", data.company) +
    customerDetailRow("Office Size", data.officeSize) +
    customerDetailRow("Team Size", data.staffCount ? `${data.staffCount} staff` : null) +
    customerDetailRow("Budget", data.budget) +
    customerDetailRow("Preferred Timeline", data.timeline) +
    customerDetailRow("Project Context", data.message);

  const bodyHtml =
    customerPara(`Thank you, <strong>${firstName}</strong>. We've received your ${requestLabel} for <strong>${data.company}</strong>.`) +
    (isLayout
      ? customerPara("Our workspace design team will review your brief and prepare a preliminary layout concept. We'll be in touch to walk you through the plan and discuss any refinements.")
      : customerPara("One of our senior workspace consultants will reach out within one business day to schedule your strategy session and confirm a time that suits you.")) +
    (detailRows ? `<p style="color:#6b6560;font-size:13px;font-weight:600;margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.5px">Your Brief</p>${customerDetailsTable(detailRows)}` : "") +
    customerPara(`We look forward to helping you create a workspace that works — beautifully and commercially. For anything urgent, call us on <strong>${TCD_PHONE}</strong>.`) +
    customerCta("Explore Workplace Strategy", `${TCD_WEBSITE}/workplace-strategy`);

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: data.email,
    subject: `${isLayout ? "Layout Plan" : "Strategy Consultation"} Request Confirmed — The Corporate Desk`,
    html: customerTemplate(title, bodyHtml),
  });
}

/**
 * Type E — General enquiry / contact form (customer confirmation)
 */
export async function sendEnquiryCustomerEmail(data: {
  name: string;
  company?: string | null;
  email: string;
  message?: string | null;
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) return;

  const firstName = data.name.split(" ")[0];

  const bodyHtml =
    customerPara(`Thank you for getting in touch, <strong>${firstName}</strong>.${data.company ? ` We've received your enquiry from <strong>${data.company}</strong>.` : ""}`) +
    customerPara("Our team will review your message and respond within one business day. If your matter is time-sensitive, please call us directly.") +
    (data.message ? `<div style="background:#f9f8f6;border-left:3px solid #c9a84c;border-radius:4px;padding:14px 16px;margin:16px 0"><p style="margin:0;color:#4a4540;font-size:13px;line-height:1.7;font-style:italic">${data.message}</p></div>` : "") +
    customerCta("Visit Our Showroom", `${TCD_WEBSITE}/contact`);

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: data.email,
    subject: `Enquiry Received — The Corporate Desk`,
    html: customerTemplate(`We've Received Your Enquiry, ${firstName}`, bodyHtml),
  });
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
