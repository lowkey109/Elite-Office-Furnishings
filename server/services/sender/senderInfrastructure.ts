export type SenderChannel = "email" | "whatsapp" | "sms" | "internal";

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

  checks.push(check(
    "safe_mode",
    !liveMode || boolEnv("TCD_ALLOW_REAL_OUTREACH"),
    liveMode ? "critical" : "info",
    liveMode
      ? "SAFE_MODE=false requires TCD_ALLOW_REAL_OUTREACH=true"
      : "SAFE_MODE is not false; live outbound is suppressed"
  ));

  if (channel === "email") {
    checks.push(check("resend_api_key", !!env("RESEND_API_KEY"), "critical", "RESEND_API_KEY must be configured"));
    checks.push(check("sender_from", !!env("TCD_EMAIL_FROM_PLAIN") || !!env("TCD_EMAIL_FROM"), "critical", "A branded sender address must be configured"));
    checks.push(check("public_url", !!env("PUBLIC_URL") || !!env("REPLIT_DOMAINS"), "warning", "PUBLIC_URL should be configured for unsubscribe links"));
    checks.push(check("spf_documented", boolEnv("TCD_SPF_VERIFIED"), "warning", "Set TCD_SPF_VERIFIED=true after SPF is verified"));
    checks.push(check("dkim_documented", boolEnv("TCD_DKIM_VERIFIED"), "warning", "Set TCD_DKIM_VERIFIED=true after DKIM is verified"));
    checks.push(check("dmarc_documented", boolEnv("TCD_DMARC_VERIFIED"), "warning", "Set TCD_DMARC_VERIFIED=true after DMARC is verified"));
    checks.push(check("bounce_handling", boolEnv("TCD_BOUNCE_HANDLING_ENABLED"), "warning", "Bounce handling should be enabled before scaled outbound"));
    checks.push(check("suppression_enforced", true, "info", "Suppression guards exist in outreach send paths"));
  }

  if (channel === "whatsapp") {
    const twilioReady = !!env("TWILIO_ACCOUNT_SID") && !!env("TWILIO_AUTH_TOKEN") && !!env("TWILIO_WHATSAPP_FROM");
    const gatewayReady = !!env("WHATSAPP_GATEWAY_URL");
    checks.push(check("whatsapp_provider", twilioReady || gatewayReady, "critical", "Twilio WhatsApp or WHATSAPP_GATEWAY_URL must be configured"));
    checks.push(check("whatsapp_ops_visibility", !!env("WHATSAPP_OPS_E164") || !!env("WHATSAPP_OPS_E164_LIST"), "warning", "Ops WhatsApp recipient should be configured"));
  }

  const missingCritical = checks.filter(c => !c.ok && c.severity === "critical").map(c => c.key);
  const warnings = checks.filter(c => !c.ok && c.severity === "warning").map(c => c.key);

  return {
    ok: missingCritical.length === 0,
    channel,
    liveMode,
    checks,
    missingCritical,
    warnings,
  };
}

export function assertSenderReady(channel: SenderChannel = "email"): SenderReadinessResult {
  const result = getSenderReadiness(channel);
  if (!result.ok) {
    console.warn("[SenderInfrastructure] Sender not production-ready", {
      channel,
      missingCritical: result.missingCritical,
      warnings: result.warnings,
    });
  }
  return result;
}
