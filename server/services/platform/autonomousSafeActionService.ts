import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");

type LeadLike = Record<string, any>;

function isRealEmail(email: string) {
  const value = String(email || "").trim().toLowerCase();
  if (!value) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  if (value.includes("example.com")) return false;
  if (value.includes("test.com")) return false;
  if (value.includes("fake")) return false;
  if (value.includes("unknown")) return false;
  return true;
}

function looksLikeRealCompany(name: string) {
  const value = String(name || "").trim().toLowerCase();
  if (!value) return false;
  if (["unknown", "n/a", "na", "test", "sample", "demo"].includes(value)) return false;
  if (value.includes("internal test")) return false;
  if (value.length < 3) return false;
  return true;
}

function hasRealSourceUrl(url: string) {
  const value = String(url || "").trim().toLowerCase();
  if (!value) return false;
  if (value.startsWith("local://")) return false;
  if (value.includes("example.com")) return false;
  return value.startsWith("http://") || value.startsWith("https://");
}

async function readJson(fileName: string, fallback: any) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, fileName), "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(fileName: string, data: any) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, fileName), JSON.stringify(data, null, 2), "utf8");
}

async function appendAudit(event: any) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(
    path.join(DATA_DIR, "autonomous-action-audit.jsonl"),
    JSON.stringify({ ...event, createdAt: new Date().toISOString() }) + "\n",
    "utf8",
  );
}

export function validateLeadForAutonomy(lead: LeadLike) {
  const companyName = String(lead.companyName || lead.company || lead.businessName || "").trim();
  const contactEmail = String(lead.contactEmail || lead.email || lead.recipientEmail || "").trim();
  const sourceUrl = String(lead.sourceUrl || lead.url || lead.link || "").trim();
  const confidence = Number(lead.confidence ?? lead.score ?? 0);

  const failures: string[] = [];

  if (!looksLikeRealCompany(companyName)) failures.push("company_name_not_verified");
  if (!hasRealSourceUrl(sourceUrl)) failures.push("missing_real_source_url");
  if (!Number.isFinite(confidence) || confidence < 80) failures.push("confidence_below_80");

  const hasEmail = Boolean(contactEmail);
  if (hasEmail && !isRealEmail(contactEmail)) failures.push("invalid_or_test_email");

  const status = failures.length === 0 ? "qualified" : "review_required";

  return {
    status,
    qualified: status === "qualified",
    failures,
    normalized: {
      companyName,
      contactEmail,
      sourceUrl,
      confidence,
    },
  };
}

export async function getAutonomousActionStatus() {
  const certification = await readJson("internal-lead-loop-certification.json", null);
  const suppressions = await readJson("outreach-suppressions.json", { suppressions: [] });
  const auditRaw = await fs.readFile(path.join(DATA_DIR, "autonomous-action-audit.jsonl"), "utf8").catch(() => "");

  const auditLines = auditRaw.split(/\r?\n/).filter(Boolean);
  const fullGreen = process.env.TCD_AUTONOMY_FULL_GREEN === "true";
  const pipelineAllowed = process.env.TCD_ALLOW_PIPELINE_MUTATION === "true";
  const outreachAllowed = process.env.TCD_ALLOW_REAL_OUTREACH === "true";

  return {
    ok: true,
    mode: fullGreen ? "autonomous_action_possible" : "certification_locked",
    fullGreen,
    pipelineAllowed,
    outreachAllowed,
    overrideConfigured: Boolean(process.env.TCD_AUTONOMY_OVERRIDE_TOKEN),
    internalLeadLoopCertified: certification?.result === "passed",
    suppressionsCount: Array.isArray(suppressions.suppressions) ? suppressions.suppressions.length : 0,
    auditEvents: auditLines.length,
    rules: {
      minConfidence: 80,
      requiresRealCompanyName: true,
      requiresRealSourceUrl: true,
      blocksUnknownCompanies: true,
      blocksTestEmails: true,
      blocksExampleEmails: true,
      logsEveryAction: true,
    },
  };
}

export async function certifyAutonomousSafeActionLayer() {
  const status = await getAutonomousActionStatus();

  const certification = {
    ok: true,
    result: status.internalLeadLoopCertified ? "passed" : "failed",
    certifiedAt: new Date().toISOString(),
    checks: {
      autonomyBoardCanBeGreen: true,
      internalLeadLoopCertified: status.internalLeadLoopCertified,
      validatorInstalled: true,
      badLeadBlockingInstalled: true,
      auditLoggingInstalled: true,
      realOutreachRequiresExplicitEnv: true,
      pipelineMutationRequiresExplicitEnv: true,
    },
    nextUnlocks: {
      pipeline: "Set TCD_AUTONOMY_FULL_GREEN=true and TCD_ALLOW_PIPELINE_MUTATION=true only after validating real leads.",
      outreach: "Set TCD_AUTONOMY_FULL_GREEN=true and TCD_ALLOW_REAL_OUTREACH=true only after suppression and sender tests pass.",
    },
  };

  await writeJson("autonomous-safe-action-certification.json", certification);
  await appendAudit({ type: "autonomous_safe_action_certified", result: certification.result });

  return certification;
}

export async function simulateAutonomousLeadDecision(lead: LeadLike) {
  const validation = validateLeadForAutonomy(lead);

  const decision = {
    ok: true,
    decisionId: "decision-" + Date.now(),
    createdAt: new Date().toISOString(),
    validation,
    action:
      validation.qualified
        ? "eligible_for_auto_pipeline_or_outreach_when_unlock_enabled"
        : "blocked_to_review_queue",
    realPipelineMutationPerformed: false,
    realOutreachPerformed: false,
    reason:
      validation.qualified
        ? "Lead passed quality rules. Real mutation still depends on explicit unlock env."
        : "Lead failed autonomy quality rules and must be reviewed.",
  };

  await appendAudit({ type: "lead_decision_simulated", decision });

  return decision;
}


export async function autoPipelineQualifiedLead(lead: LeadLike, opts: { overrideToken?: string } = {}) {
  const validation = validateLeadForAutonomy(lead);

  const fullGreen = process.env.TCD_AUTONOMY_FULL_GREEN === "true";
  const pipelineAllowed = process.env.TCD_ALLOW_PIPELINE_MUTATION === "true";
  const overrideConfigured = Boolean(process.env.TCD_AUTONOMY_OVERRIDE_TOKEN);
  const overrideMatches =
    overrideConfigured &&
    String(opts.overrideToken || "") === String(process.env.TCD_AUTONOMY_OVERRIDE_TOKEN || "");

  if (!validation.qualified) {
    const blocked = {
      ok: true,
      action: "blocked_to_review_queue",
      pipelineMutationPerformed: false,
      validation,
      reason: "Lead failed autonomy quality rules.",
    };

    await appendAudit({ type: "auto_pipeline_blocked", blocked });
    return blocked;
  }

  if (!fullGreen || !pipelineAllowed || !overrideMatches) {
    const simulated = {
      ok: true,
      action: "qualified_but_pipeline_locked",
      pipelineMutationPerformed: false,
      validation,
      required: {
        TCD_AUTONOMY_FULL_GREEN: "true",
        TCD_ALLOW_PIPELINE_MUTATION: "true",
        "x-tcd-autonomy-override": "must match TCD_AUTONOMY_OVERRIDE_TOKEN",
      },
      reason: "Lead is qualified, but pipeline mutation remains locked.",
    };

    await appendAudit({ type: "auto_pipeline_qualified_locked", simulated });
    return simulated;
  }

  const store = await readJson("autonomous-pipeline-store.json", { opportunities: [] });
  const opportunities = Array.isArray(store.opportunities) ? store.opportunities : [];

  const idempotencyKey = [
    validation.normalized.companyName.toLowerCase(),
    validation.normalized.sourceUrl.toLowerCase(),
  ].join("::");

  const existing = opportunities.find((item: any) => item.idempotencyKey === idempotencyKey);

  if (existing) {
    const duplicate = {
      ok: true,
      action: "duplicate_skipped",
      pipelineMutationPerformed: false,
      existingId: existing.id,
      validation,
      reason: "Qualified lead already exists in autonomous pipeline store.",
    };

    await appendAudit({ type: "auto_pipeline_duplicate_skipped", duplicate });
    return duplicate;
  }

  const opportunity = {
    id: "auto-pipeline-" + Date.now(),
    idempotencyKey,
    createdAt: new Date().toISOString(),
    status: "new_qualified",
    source: "autonomous_safe_action_layer",
    companyName: validation.normalized.companyName,
    contactEmail: validation.normalized.contactEmail,
    sourceUrl: validation.normalized.sourceUrl,
    confidence: validation.normalized.confidence,
    nextAction: "prepare_outreach_draft_after_suppression_check",
    realOutreachSent: false,
  };

  store.opportunities = [opportunity, ...opportunities].slice(0, 1000);
  await writeJson("autonomous-pipeline-store.json", store);

  const result = {
    ok: true,
    action: "pushed_to_autonomous_pipeline",
    pipelineMutationPerformed: true,
    opportunity,
    validation,
  };

  await appendAudit({ type: "auto_pipeline_pushed", result });
  return result;
}

export async function listAutonomousPipelineStore() {
  const store = await readJson("autonomous-pipeline-store.json", { opportunities: [] });
  const opportunities = Array.isArray(store.opportunities) ? store.opportunities : [];

  return {
    ok: true,
    count: opportunities.length,
    opportunities,
  };
}
