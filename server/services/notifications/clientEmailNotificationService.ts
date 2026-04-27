import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const EMAIL_LOG_FILE = path.join(DATA_DIR, "email-notification-log.json");
const CLIENT_STORE_FILE = path.join(DATA_DIR, "client-portal-store.json");

type EmailLogStore = {
  emails: any[];
};

function now() {
  return new Date().toISOString();
}

async function readJson(file: string, fallback: any) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function loadEmailLog(): Promise<EmailLogStore> {
  const parsed = await readJson(EMAIL_LOG_FILE, {});
  return {
    emails: Array.isArray(parsed.emails) ? parsed.emails : [],
  };
}

async function saveEmailLog(store: EmailLogStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(EMAIL_LOG_FILE, JSON.stringify(store, null, 2), "utf8");
}

function sender() {
  return process.env.TCD_EMAIL_FROM || process.env.EMAIL_FROM || "The Corporate Desk <onboarding@resend.dev>";
}

function adminEmail() {
  return process.env.TCD_ADMIN_EMAIL || process.env.INTERNAL_NOTIFY_EMAIL || "thecorporatedeskservice@gmail.com";
}

async function logEmail(entry: any) {
  const store = await loadEmailLog();
  store.emails.unshift({
    id: "email-log-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    createdAt: now(),
    ...entry,
  });
  store.emails = store.emails.slice(0, 500);
  await saveEmailLog(store);
}

export async function sendNotificationEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category: string;
  metadata?: any;
}) {
  const configured = Boolean(process.env.RESEND_API_KEY);

  if (!configured) {
    await logEmail({
      status: "skipped_not_configured",
      provider: "resend",
      to: input.to,
      subject: input.subject,
      category: input.category,
      metadata: input.metadata || {},
    });

    return {
      ok: false,
      configured: false,
      skipped: true,
      message: "RESEND_API_KEY is not configured. Email was logged but not sent.",
    };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: sender(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text || input.html.replace(/<[^>]+>/g, " "),
    });

    await logEmail({
      status: "sent",
      provider: "resend",
      to: input.to,
      subject: input.subject,
      category: input.category,
      providerResult: result,
      metadata: input.metadata || {},
    });

    return {
      ok: true,
      configured: true,
      result,
    };
  } catch (error: any) {
    await logEmail({
      status: "failed",
      provider: "resend",
      to: input.to,
      subject: input.subject,
      category: input.category,
      error: error?.message || String(error),
      metadata: input.metadata || {},
    });

    return {
      ok: false,
      configured: true,
      error: error?.message || String(error),
    };
  }
}

function shell(title: string, body: string) {
  return `
  <div style="font-family:Arial,sans-serif;background:#080A12;color:#ffffff;padding:32px;">
    <div style="max-width:680px;margin:auto;background:#111827;border:1px solid #2a3142;border-radius:18px;padding:28px;">
      <p style="color:#f5b942;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">The Corporate Desk</p>
      <h1 style="margin:0 0 18px;font-size:28px;line-height:1.1;">${title}</h1>
      <div style="color:#d1d5db;font-size:15px;line-height:1.6;">${body}</div>
      <hr style="border:none;border-top:1px solid #2a3142;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:12px;margin:0;">This message relates to your The Corporate Desk client account or platform activity.</p>
    </div>
  </div>`;
}

export async function sendWelcomeEmail(user: any) {
  if (!user?.email) return { ok: false, error: "Missing user email" };

  return sendNotificationEmail({
    to: user.email,
    subject: "Welcome to The Corporate Desk",
    category: "welcome",
    metadata: { clientUserId: user.id, tenantId: user.tenantId, plan: user.plan },
    html: shell(
      "Welcome to The Corporate Desk",
      `
      <p>Hi ${user.fullName || "there"},</p>
      <p>Your client account has been created for <strong>${user.companyName || "your company"}</strong>.</p>
      <p>You can now use your dashboard to manage workspace projects, LeaseHawk listings, support messages, billing and PhantomX Paper Trader.</p>
      <p><strong>Current plan:</strong> ${user.plan || "free"}</p>
      <p><a href="${process.env.PUBLIC_APP_URL || "http://localhost:5000"}/client-dashboard" style="color:#f5b942;">Open your dashboard</a></p>
      `,
    ),
  });
}

export async function sendPropertyEnquiryReceivedEmail(enquiry: any) {
  const clientSend = enquiry?.clientEmail
    ? await sendNotificationEmail({
        to: enquiry.clientEmail,
        subject: "We received your property enquiry",
        category: "property_enquiry_client",
        metadata: { enquiryId: enquiry.id, tenantId: enquiry.tenantId, listingId: enquiry.listingId },
        html: shell(
          "Property enquiry received",
          `
          <p>We received your enquiry for <strong>${enquiry.listingTitle || "this listing"}</strong>.</p>
          <p><strong>Request type:</strong> ${enquiry.enquiryType || "enquiry"}</p>
          <p>Our team will review it and follow up with the next step.</p>
          `,
        ),
      })
    : { ok: false, skipped: true, error: "No client email" };

  const adminSend = await sendNotificationEmail({
    to: adminEmail(),
    subject: "New LeaseHawk property enquiry",
    category: "property_enquiry_admin",
    metadata: { enquiryId: enquiry.id, tenantId: enquiry.tenantId, listingId: enquiry.listingId },
    html: shell(
      "New LeaseHawk property enquiry",
      `
      <p><strong>Client:</strong> ${enquiry.clientCompanyName || enquiry.clientEmail || "Unknown"}</p>
      <p><strong>Listing:</strong> ${enquiry.listingTitle || enquiry.listingId}</p>
      <p><strong>Type:</strong> ${enquiry.enquiryType}</p>
      <p><strong>Message:</strong> ${enquiry.message || "No message"}</p>
      `,
    ),
  });

  return { ok: true, clientSend, adminSend };
}

export async function sendSupportMessageReceivedEmail(message: any) {
  const clientSend = message?.clientEmail
    ? await sendNotificationEmail({
        to: message.clientEmail,
        subject: "We received your support message",
        category: "support_client",
        metadata: { supportMessageId: message.id, tenantId: message.tenantId },
        html: shell(
          "Support message received",
          `
          <p>We received your support request: <strong>${message.subject}</strong>.</p>
          <p>Category: ${message.category}</p>
          <p>Our team will review it and respond as soon as possible.</p>
          `,
        ),
      })
    : { ok: false, skipped: true, error: "No client email" };

  const adminSend = await sendNotificationEmail({
    to: adminEmail(),
    subject: "New customer support message",
    category: "support_admin",
    metadata: { supportMessageId: message.id, tenantId: message.tenantId },
    html: shell(
      "New customer support message",
      `
      <p><strong>Client:</strong> ${message.clientCompanyName || message.clientEmail || "Unknown"}</p>
      <p><strong>Subject:</strong> ${message.subject}</p>
      <p><strong>Category:</strong> ${message.category}</p>
      <p><strong>Message:</strong> ${message.message}</p>
      `,
    ),
  });

  return { ok: true, clientSend, adminSend };
}

export async function sendPhantomXApplicationSubmittedEmail(application: any) {
  const clientSend = application?.clientEmail
    ? await sendNotificationEmail({
        to: application.clientEmail,
        subject: "PhantomX live-readiness application received",
        category: "phantomx_application_client",
        metadata: { applicationId: application.id, tenantId: application.tenantId },
        html: shell(
          "PhantomX application received",
          `
          <p>Your PhantomX live-readiness application has been received.</p>
          <p>This does <strong>not</strong> enable live trading. Real-money trading remains disabled unless a separate review and approval process is completed.</p>
          <p><strong>Status:</strong> ${application.status}</p>
          `,
        ),
      })
    : { ok: false, skipped: true, error: "No client email" };

  const adminSend = await sendNotificationEmail({
    to: adminEmail(),
    subject: "New PhantomX live-readiness application",
    category: "phantomx_application_admin",
    metadata: { applicationId: application.id, tenantId: application.tenantId },
    html: shell(
      "New PhantomX live-readiness application",
      `
      <p><strong>Client:</strong> ${application.clientCompanyName || application.clientEmail || "Unknown"}</p>
      <p><strong>Requested mode:</strong> ${application.requestedMode}</p>
      <p><strong>Preferred exchange:</strong> ${application.preferredExchange || "Not provided"}</p>
      <p><strong>Daily loss limit:</strong> ${application.maxDailyLossLimit || "Not provided"}</p>
      <p><strong>Monthly loss limit:</strong> ${application.maxMonthlyLossLimit || "Not provided"}</p>
      `,
    ),
  });

  return { ok: true, clientSend, adminSend };
}

export async function sendTrialEndingReminders(daysAhead = 3) {
  const clientStore = await readJson(CLIENT_STORE_FILE, { users: [] });
  const users = Array.isArray(clientStore.users) ? clientStore.users : [];
  const nowMs = Date.now();
  const maxMs = nowMs + daysAhead * 24 * 60 * 60 * 1000;

  const candidates = users.filter((user: any) => {
    if (user.subscriptionStatus !== "trialing") return false;
    if (!user.trialEndsAt || !user.email) return false;
    const t = new Date(user.trialEndsAt).getTime();
    return Number.isFinite(t) && t >= nowMs && t <= maxMs;
  });

  const results = [];

  for (const user of candidates) {
    results.push(await sendNotificationEmail({
      to: user.email,
      subject: "Your The Corporate Desk trial is ending soon",
      category: "trial_ending",
      metadata: { clientUserId: user.id, tenantId: user.tenantId, plan: user.plan, trialEndsAt: user.trialEndsAt },
      html: shell(
        "Your trial is ending soon",
        `
        <p>Your trial for <strong>${user.plan}</strong> is ending on ${String(user.trialEndsAt).slice(0, 10)}.</p>
        <p>Open billing to keep access active or review your plan.</p>
        <p><a href="${process.env.PUBLIC_APP_URL || "http://localhost:5000"}/client/billing" style="color:#f5b942;">Open billing</a></p>
        `,
      ),
    }));
  }

  return {
    ok: true,
    daysAhead,
    candidates: candidates.length,
    results,
  };
}

export async function listEmailNotificationLog() {
  const store = await loadEmailLog();

  return {
    ok: true,
    configured: Boolean(process.env.RESEND_API_KEY),
    from: sender(),
    adminEmail: adminEmail(),
    count: store.emails.length,
    emails: store.emails.slice(0, 100),
    stats: {
      sent: store.emails.filter((email) => email.status === "sent").length,
      skipped: store.emails.filter((email) => email.status === "skipped_not_configured").length,
      failed: store.emails.filter((email) => email.status === "failed").length,
    },
  };
}
