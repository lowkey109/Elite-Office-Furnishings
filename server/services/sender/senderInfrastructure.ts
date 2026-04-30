export type SenderChannel = "email" | "whatsapp" | "internal";

export type SenderReadinessCheck = {
  key: string;
  ok: boolean;
  severity: "info" | "warning" | "critical";
  detail: string;
};

export type SenderReadinessResult = {
  ok: boolean;
  channel: SenderChannel;
  liveMode: boolean;
  checks: SenderReadinessCheck[];
  missingCritical: string[];
  warnings: string[];
};

function env(name: string): string {
  return String(process.env[name] || "").trim();
}

function boolEnv(name: string): boolean {
  return env(name) === "true";
}

function check(
  key: string,
  ok: boolean,
  severity: SenderReadinessCheck["severity"],
  detail: string
): SenderReadinessCheck {
  return { key, ok, severity, detail };
}

export function getSenderReadiness(channel: SenderChannel = "email"): SenderReadinessResult {
  const liveMode = process.env.SAFE_MODE === "false";
  const checks: SenderReadinessCheck[] = [];

  if (channel === "email") {
    checks.push(
      check("RESEND_API_KEY", !!env("RESEND_API_KEY"), "critical", "Resend API key required."),
      check("TCD_EMAIL_FROM_PLAIN", !!env("TCD_EMAIL_FROM_PLAIN"), "critical", "Branded sender required."),
      check("TCD_ALLOW_REAL_OUTREACH", boolEnv("TCD_ALLOW_REAL_OUTREACH"), "critical", "Real outreach must be explicitly enabled."),
      check("EMAIL_DOMAIN_VERIFIED", boolEnv("EMAIL_DOMAIN_VERIFIED"), "critical", "Sending domain must be verified."),
      check("EMAIL_SPF_VERIFIED", boolEnv("EMAIL_SPF_VERIFIED"), "critical", "SPF must be verified."),
      check("EMAIL_DKIM_VERIFIED", boolEnv("EMAIL_DKIM_VERIFIED"), "critical", "DKIM must be verified."),
      check("EMAIL_DMARC_VERIFIED", boolEnv("EMAIL_DMARC_VERIFIED"), "warning", "DMARC should be configured."),
      check("EMAIL_BOUNCE_WEBHOOK_ENABLED", boolEnv("EMAIL_BOUNCE_WEBHOOK_ENABLED"), "warning", "Bounce webhook should be enabled."),
      check("EMAIL_DELIVERABILITY_TELEMETRY", boolEnv("EMAIL_DELIVERABILITY_TELEMETRY"), "warning", "Deliverability telemetry should be enabled.")
    );
  }

  if (channel === "whatsapp") {
    checks.push(
      check("WHATSAPP_PROVIDER", !!env("TWILIO_ACCOUNT_SID") || !!env("WHATSAPP_GATEWAY_URL"), "critical", "WhatsApp provider required."),
      check("WHATSAPP_GUARDS_ENABLED", true, "info", "WhatsApp guards are present."),
      check("WHATSAPP_OPS_RECIPIENTS", !!env("WHATSAPP_OPS_E164") || !!env("WHATSAPP_OPS_E164_LIST"), "warning", "Ops WhatsApp recipient recommended.")
    );
  }

  if (channel === "internal") {
    checks.push(check("INTERNAL_NOTIFICATIONS", true, "info", "Internal notifications allowed."));
  }

  const missingCritical = checks.filter(c => !c.ok && c.severity === "critical").map(c => c.key);
  const warnings = checks.filter(c => !c.ok && c.severity === "warning").map(c => c.key);

  return { ok: missingCritical.length === 0, channel, liveMode, checks, missingCritical, warnings };
}

export function assertSenderReady(channel: SenderChannel = "email"): SenderReadinessResult {
  const readiness = getSenderReadiness(channel);
  if (readiness.liveMode && !readiness.ok) {
    throw new Error(`Sender not production-ready for ${channel}: ${readiness.missingCritical.join(", ")}`);
  }
  return readiness;
}

export function getAllSenderReadiness(): Record<SenderChannel, SenderReadinessResult> {
  return {
    email: getSenderReadiness("email"),
    whatsapp: getSenderReadiness("whatsapp"),
    internal: getSenderReadiness("internal"),
  };
}
