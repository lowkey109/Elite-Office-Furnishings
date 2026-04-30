# Sender Infrastructure Runbook

Nexora decides whether an outbound action is allowed. Sender infrastructure decides whether delivery is safe, branded, traceable, and production-ready.

## Emergency outbound stop

Set:

SAFE_MODE=true
TCD_ALLOW_REAL_OUTREACH=false

Then restart app/workers.

## Email production checks

RESEND_API_KEY, TCD_EMAIL_FROM_PLAIN, verified domain, SPF, DKIM, DMARC, bounce handling, suppression, and delivery telemetry.

## WhatsApp production checks

Provider configured, WhatsApp guards enabled, and ops recipient configured.
