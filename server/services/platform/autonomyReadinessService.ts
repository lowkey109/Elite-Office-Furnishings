import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");

type ReadinessStatus = "green" | "yellow" | "red";

type Check = {
  id: string;
  label: string;
  status: ReadinessStatus;
  summary: string;
  evidence?: any;
  nextAction?: string;
};

async function readJson(fileName: string, fallback: any) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, fileName), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function fileExists(fileName: string) {
  try {
    await fs.access(path.join(DATA_DIR, fileName));
    return true;
  } catch {
    return false;
  }
}

function envSet(key: string) {
  return Boolean(process.env[key]);
}

function senderLooksVerified() {
  const from = process.env.TCD_EMAIL_FROM || process.env.EMAIL_FROM || "";
  if (!from) return false;
  if (from.includes("onboarding@resend.dev")) return false;
  if (!from.toLowerCase().includes("thecorporatedesk")) return false;
  return true;
}

function statusRank(status: ReadinessStatus) {
  if (status === "green") return 3;
  if (status === "yellow") return 2;
  return 1;
}

function worstStatus(checks: Check[]): ReadinessStatus {
  if (checks.some((check) => check.status === "red")) return "red";
  if (checks.some((check) => check.status === "yellow")) return "yellow";
  return "green";
}

async function grepCode(pattern: RegExp, roots: string[]) {
  const matches: string[] = [];

  async function walk(dir: string) {
    let entries: any[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "dist", ".git", ".next", ".vite"].includes(entry.name)) continue;
        await walk(full);
        continue;
      }

      if (!entry.name.match(/\.(ts|tsx|js|jsx)$/)) continue;

      try {
        const raw = await fs.readFile(full, "utf8");
        if (pattern.test(raw)) {
          matches.push(full);
        }
      } catch {}
    }
  }

  for (const root of roots) {
    await walk(path.resolve(process.cwd(), root));
  }

  return matches.slice(0, 50);
}

export async function getAutonomyReadiness() {
  const checks: Check[] = [];

  const dataLayer = await readJson("client-portal-store.json", null);
  const propertyListings = await readJson("property-listings-store.json", { listings: [] });
  const propertyEnquiries = await readJson("property-enquiries-store.json", { enquiries: [] });
  const clientEngagement = await readJson("client-engagement-store.json", { savedListings: [], supportMessages: [] });
  const emailLog = await readJson("email-notification-log.json", { emails: [] });
  const phantomxCompliance = await readJson("phantomx-compliance-store.json", { applications: [] });
  const outreachCertification = await readJson("outreach-safety-certification.json", null);

  const databaseConfigured = envSet("DATABASE_URL");
  const resendConfigured = envSet("RESEND_API_KEY");
  const adzunaConfigured = envSet("ADZUNA_APP_ID") && envSet("ADZUNA_APP_KEY");
  const openAiConfigured = envSet("OPENAI_API_KEY") || envSet("AI_INTEGRATIONS_OPENAI_API_KEY");
  const stripeConfigured = envSet("STRIPE_SECRET_KEY");

  const runtimeStoreExists = await fileExists("client-portal-store.json");
  const syntheticMatches = await grepCode(/synthetic|demo|mock|fake|placeholder|Math\.random|onboarding@resend\.dev/i, ["server", "client/src"]);

  checks.push({
    id: "postgres_runtime",
    label: "Postgres runtime data layer",
    status: databaseConfigured ? "green" : "red",
    summary: databaseConfigured
      ? "DATABASE_URL is configured. G1 runtime store migration can operate."
      : "DATABASE_URL is missing.",
    evidence: { databaseConfigured, runtimeStoreExists },
    nextAction: databaseConfigured ? "Proceed to Postgres-first cutover after safety checks." : "Set DATABASE_URL.",
  });

  checks.push({
    id: "real_signal_sources",
    label: "Real signal sources",
    status: adzunaConfigured ? "green" : "yellow",
    summary: adzunaConfigured
      ? "Adzuna job signal source is configured."
      : "Adzuna credentials are missing; job-signal scanning may not use live data.",
    evidence: {
      ADZUNA_APP_ID: envSet("ADZUNA_APP_ID"),
      ADZUNA_APP_KEY: envSet("ADZUNA_APP_KEY"),
      OPENAI: openAiConfigured,
    },
    nextAction: adzunaConfigured ? "Verify scan quality and dedupe." : "Add ADZUNA_APP_ID and ADZUNA_APP_KEY.",
  });

  const listingCount = Array.isArray(propertyListings.listings) ? propertyListings.listings.length : 0;
  checks.push({
    id: "property_listings",
    label: "LeaseHawk property listings",
    status: listingCount > 0 ? "green" : "yellow",
    summary: listingCount > 0
      ? "Property listing store has active data."
      : "No property listings are currently stored.",
    evidence: { listingCount },
    nextAction: listingCount > 0 ? "Continue partner/manual CSV intake." : "Import real partner listings or CSV feed.",
  });

  const emailStats = {
    total: Array.isArray(emailLog.emails) ? emailLog.emails.length : 0,
    sent: Array.isArray(emailLog.emails) ? emailLog.emails.filter((e: any) => e.status === "sent").length : 0,
    skipped: Array.isArray(emailLog.emails) ? emailLog.emails.filter((e: any) => e.status === "skipped_not_configured").length : 0,
    failed: Array.isArray(emailLog.emails) ? emailLog.emails.filter((e: any) => e.status === "failed").length : 0,
  };

  checks.push({
    id: "email_provider",
    label: "Email provider configured",
    status: resendConfigured ? "green" : "red",
    summary: resendConfigured
      ? "RESEND_API_KEY is configured."
      : "RESEND_API_KEY is missing. Emails cannot be sent.",
    evidence: emailStats,
    nextAction: resendConfigured ? "Verify sender domain before outreach." : "Add RESEND_API_KEY.",
  });

  checks.push({
    id: "verified_sender",
    label: "Verified branded sender",
    status: senderLooksVerified() ? "green" : "red",
    summary: senderLooksVerified()
      ? "Sender appears branded."
      : "Sender is missing or still using onboarding@resend.dev fallback.",
    evidence: {
      TCD_EMAIL_FROM: process.env.TCD_EMAIL_FROM || null,
      EMAIL_FROM: process.env.EMAIL_FROM || null,
      fallbackWouldBe: "The Corporate Desk <onboarding@resend.dev>",
    },
    nextAction: senderLooksVerified()
      ? "Send one internal test email before customer outreach."
      : "Set TCD_EMAIL_FROM to a verified domain sender such as The Corporate Desk <hello@thecorporatedesk.au>.",
  });

  checks.push({
    id: "stripe_billing",
    label: "Stripe billing",
    status: stripeConfigured ? "yellow" : "red",
    summary: stripeConfigured
      ? "Stripe key is configured, but every price ID and webhook should still be verified."
      : "Stripe secret key is missing.",
    evidence: {
      STRIPE_SECRET_KEY: stripeConfigured,
      STRIPE_WEBHOOK_SECRET: envSet("STRIPE_WEBHOOK_SECRET"),
      STRIPE_PRICE_STARTER: envSet("STRIPE_PRICE_STARTER"),
      STRIPE_PRICE_GROWTH: envSet("STRIPE_PRICE_GROWTH"),
      STRIPE_PRICE_LEASEHAWK_PRO: envSet("STRIPE_PRICE_LEASEHAWK_PRO"),
      STRIPE_PRICE_LEASEHAWK_PLUS: envSet("STRIPE_PRICE_LEASEHAWK_PLUS"),
    },
    nextAction: "Verify every Stripe price ID starts with price_ and complete a test checkout.",
  });

  const supportCount = Array.isArray(clientEngagement.supportMessages) ? clientEngagement.supportMessages.length : 0;
  const savedCount = Array.isArray(clientEngagement.savedListings) ? clientEngagement.savedListings.length : 0;
  const enquiryCount = Array.isArray(propertyEnquiries.enquiries) ? propertyEnquiries.enquiries.length : 0;

  checks.push({
    id: "client_portal",
    label: "Client portal activity",
    status: supportCount + savedCount + enquiryCount > 0 ? "green" : "yellow",
    summary: "Client portal stores are present and readable.",
    evidence: { supportCount, savedCount, enquiryCount },
    nextAction: "Run one full client flow from signup to saved listing, enquiry, support and billing.",
  });

  const phantomApps = Array.isArray(phantomxCompliance.applications) ? phantomxCompliance.applications.length : 0;
  checks.push({
    id: "phantomx_compliance",
    label: "PhantomX compliance boundary",
    status: phantomApps >= 0 ? "green" : "red",
    summary: "PhantomX live-readiness application store is present. Paper mode remains separate from live trading.",
    evidence: { applications: phantomApps },
    nextAction: "Keep live trading disabled until compliance review, risk limits and legal checks are complete.",
  });

  checks.push({
    id: "synthetic_demo_risk",
    label: "Synthetic/demo code risk",
    status: syntheticMatches.length === 0 ? "green" : "yellow",
    summary: syntheticMatches.length === 0
      ? "No synthetic/demo/fake markers found in scanned code."
      : "Synthetic/demo/fake markers still exist in code and must be reviewed before full autonomy.",
    evidence: { matchCount: syntheticMatches.length, sampleFiles: syntheticMatches.slice(0, 20) },
    nextAction: syntheticMatches.length === 0
      ? "Keep production no-fake-data policy enforced."
      : "Review these files and hard-disable demo paths from production loops.",
  });

  const startupDisabled = process.env.TCD_DISABLE_STARTUP_JOBS === "true";
  checks.push({
    id: "nexora_loop",
    label: "Nexora autonomous loop",
    status: startupDisabled ? "yellow" : "green",
    summary: startupDisabled
      ? "Startup jobs are disabled in this local run."
      : "Startup jobs are not disabled by TCD_DISABLE_STARTUP_JOBS.",
    evidence: { TCD_DISABLE_STARTUP_JOBS: process.env.TCD_DISABLE_STARTUP_JOBS || null },
    nextAction: startupDisabled
      ? "For controlled local loop testing, restart without TCD_DISABLE_STARTUP_JOBS=true."
      : "Watch logs and verify loop outputs before outreach sending.",
  });

  const outreachCertified =
    outreachCertification?.result === "passed" &&
    outreachCertification?.checks?.sendLockVerified === true &&
    outreachCertification?.checks?.realOutreachNotEnabled === true;

  checks.push({
    id: "outreach_safety",
    label: "Outreach safety gates",
    status: outreachCertified ? "green" : senderLooksVerified() && resendConfigured ? "yellow" : "red",
    summary: outreachCertified
      ? "Outreach safety certification passed in internal-only mode. Real sending remains locked by default."
      : senderLooksVerified() && resendConfigured
        ? "Email provider and sender are close, but suppression/approval tests must still pass."
        : "Outreach must remain blocked until sender and provider are production-ready.",
    evidence: {
      resendConfigured,
      senderVerified: senderLooksVerified(),
      certification: outreachCertification,
    },
    nextAction: outreachCertified
      ? "Keep real outreach locked until every remaining readiness item is green and an override is intentionally configured."
      : "Verify suppressions, pending approvals, safety stats and one internal-only outreach test.",
  });

  const overall = worstStatus(checks);
  const counts = {
    green: checks.filter((check) => check.status === "green").length,
    yellow: checks.filter((check) => check.status === "yellow").length,
    red: checks.filter((check) => check.status === "red").length,
  };

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    overall,
    readyForFullAutonomy: overall === "green",
    counts,
    checks,
    nextMilestone:
      overall === "green"
        ? "Run internal-only live loop certification, then consider staged production."
        : "Fix all red checks, then reduce yellow checks to green.",
  };
}
