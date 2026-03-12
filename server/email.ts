import nodemailer from "nodemailer";

const TCD_RECIPIENTS = [
  "service@thecorporatedesk.com.au",
  "thecorporatedeskservice@gmail.com",
];

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

function row(label: string, value: string | number | null | undefined): string {
  if (!value && value !== 0) return "";
  return `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#999;font-size:13px;width:160px;vertical-align:top">${label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#f0f0f0;font-size:13px;vertical-align:top">${value}</td>
    </tr>`;
}

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#16161e;border-radius:12px;overflow:hidden;border:1px solid #2a2a2a">
    <div style="background:linear-gradient(135deg,#1a1a24,#0f0f13);padding:28px 32px;border-bottom:2px solid #c9a84c">
      <div style="font-size:11px;color:#c9a84c;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px">The Corporate Desk</div>
      <div style="font-size:22px;font-weight:700;color:#ffffff">${title}</div>
    </div>
    <div style="padding:28px 32px">
      <table style="width:100%;border-collapse:collapse;background:#1c1c26;border-radius:8px;overflow:hidden">
        ${body}
      </table>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a;text-align:center">
      <a href="https://thecorporatedesk.com.au" style="color:#c9a84c;font-size:12px;text-decoration:none">thecorporatedesk.com.au</a>
      <span style="color:#555;font-size:12px;margin:0 8px">·</span>
      <span style="color:#555;font-size:12px">1300 977 607</span>
    </div>
  </div>
</body>
</html>`;
}

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
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP not configured — skipping lead notification");
    return;
  }

  const formLabel = lead.type
    ? lead.type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Website Lead";

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
    row("Received", new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }) + " AEST");

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: TCD_RECIPIENTS,
    subject: `New ${formLabel}: ${lead.name} — ${lead.company}`,
    html: baseTemplate(`New ${formLabel}`, body),
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
    html: baseTemplate("Supplier Quote Notification", body),
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
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[email] SMTP not configured — skipping planning request notification");
    return;
  }

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
    row("Admin Link", "thecorporatedesk.com.au/admin/planning-requests") +
    row("Received", new Date().toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }) + " AEST");

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: TCD_RECIPIENTS,
    subject: `Floor Plan Request: ${req.name} — ${req.company || req.city || "New Enquiry"}`,
    html: baseTemplate("New Floor Plan / Space Planning Request", body),
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
    row("Admin Link", "thecorporatedesk.com.au/admin") +
    row("Received", time);

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: TCD_RECIPIENTS,
    subject: `Payment Received — AI Office Planner — ${payment.customerEmail}`,
    html: baseTemplate("Payment Received — AI Office Planner", adminBody),
  });

  const customerBody = `
    <tr>
      <td colspan="2" style="padding:20px 12px 8px;color:#f0f0f0;font-size:15px;line-height:1.7">
        Thank you for unlocking your personalised AI Office Planner report.<br><br>
        Your payment of <strong style="color:#c9a84c">$${payment.amountAud.toFixed(2)} AUD</strong> has been received and your full report is now available on your device.<br><br>
        If you have any questions or need assistance, our team is here to help.
      </td>
    </tr>
    ${row("Your Email", payment.customerEmail)}
    ${row("Amount Paid", `$${payment.amountAud.toFixed(2)} AUD`)}
    ${row("Payment Ref", payment.sessionId.slice(-12).toUpperCase())}
    ${row("Date", time)}
    <tr>
      <td colspan="2" style="padding:20px 12px 8px">
        <a href="https://thecorporatedesk.com.au/office-planner" style="display:inline-block;background:#c9a84c;color:#0f0f13;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px">
          Return to Your Report →
        </a>
      </td>
    </tr>`;

  await transporter.sendMail({
    from: `"The Corporate Desk" <${process.env.SMTP_USER}>`,
    to: payment.customerEmail,
    subject: "Your AI Office Planner Report is Ready — The Corporate Desk",
    html: baseTemplate("Your AI Office Planner Report is Ready", customerBody),
  });
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
