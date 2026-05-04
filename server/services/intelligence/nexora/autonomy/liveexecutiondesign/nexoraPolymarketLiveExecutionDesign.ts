import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";
import {
  evaluateNexoraLiveMoneyReadiness,
  getNexoraLiveExecutionPolicy,
  getNexoraWalletPolicy,
} from "../livemoney/nexoraLiveMoneyReadiness";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("live-execution-design", "journal", "live-execution-design-journal.jsonl");
const ARCH_LOG = nexoraLocalPath("live-execution-design", "architecture", "architecture-log.jsonl");
const INTENT_LOG = nexoraLocalPath("live-execution-design", "order-intents", "order-intent-log.jsonl");
const SIGNER_LOG = nexoraLocalPath("live-execution-design", "external-signer", "external-signer-log.jsonl");
const CHECKLIST_LOG = nexoraLocalPath("live-execution-design", "checklists", "checklist-log.jsonl");
const APPROVAL_LOG = nexoraLocalPath("live-execution-design", "approvals", "approval-log.jsonl");
const REPORT_LOG = nexoraLocalPath("live-execution-design", "reports", "report-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function money(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : fallback;
}

export function createNexoraLiveExecutionArchitecture(input: any = {}) {
  const architectureId = String(input.architectureId || nexoraLocalId("live_exec_arch"));

  const architecture = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_polymarket_live_execution_architecture",
    architectureId,
    createdAt: now(),
    status: "design_only",
    liveTradingEnabled: false,
    components: [
      {
        component: "Nexora Brain",
        responsibility: "Prepare order intents, risk checks, readiness checks, and human approval packets.",
        holdsSecrets: false,
      },
      {
        component: "External Signer",
        responsibility: "Future isolated signing process/service. Not implemented in this build.",
        holdsSecrets: true,
        requiredControls: [
          "separate process",
          "separate environment",
          "no repo-stored private keys",
          "no chat-pasted private keys",
          "hardware wallet or managed signer preferred",
        ],
      },
      {
        component: "Execution Gateway",
        responsibility: "Future service that converts approved intents into signed CLOB orders.",
        holdsSecrets: false,
        status: "not built",
      },
      {
        component: "Reconciliation",
        responsibility: "Compare order intents, fills, positions, balances, and outcomes.",
        holdsSecrets: false,
      },
      {
        component: "Kill Switch",
        responsibility: "Stop all live execution on loss, latency, fill mismatch, API failure, or human stop.",
        holdsSecrets: false,
      },
    ],
    requiredBeforeImplementation: [
      "Postgres storage upgraded",
      "durableKernel.ok true",
      "paper evidence requirements satisfied",
      "external signer design approved",
      "owner commit recorded",
      "live execution code review",
      "funding cap set",
      "withdrawal path blocked",
    ],
    hardBlocks: [
      "No live orders in this build",
      "No private keys in this build",
      "No wallet signing in this build",
      "No CLOB order placement in this build",
      "No production execution without separate build",
    ],
    safety: {
      designOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
      noWalletSigning: true,
      ownerCommitRequired: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("live-execution-design", "architecture", `${architectureId}.json`), architecture);
  appendNexoraJsonl(ARCH_LOG, { event: "architecture.created", architecture, createdAt: now() });
  journal("architecture.created", architecture);

  return { ok: true, nexoraBrain: true, architecture };
}

export function createNexoraLiveOrderIntentSchema(input: any = {}) {
  const intentSchemaId = String(input.intentSchemaId || nexoraLocalId("live_intent_schema"));

  const schema = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_live_order_intent_schema",
    intentSchemaId,
    createdAt: now(),
    status: "schema_only",
    fields: {
      intentId: "string",
      marketId: "string",
      asset: "BTC | ETH | other",
      side: "BUY_YES | BUY_NO | SELL_YES | SELL_NO",
      price: "number 0.01-0.99",
      sizeUsd: "number",
      maxSlippageBps: "number",
      expiresAt: "ISO timestamp",
      reason: "string",
      evidencePackId: "string",
      riskDecisionId: "string",
      humanCommitId: "string",
    },
    validationRules: [
      "must have humanCommitId",
      "must have evidencePackId",
      "must have riskDecisionId",
      "sizeUsd <= live execution policy maxSingleTradeUsd",
      "price between 0.01 and 0.99",
      "expiresAt must be in the future",
      "side must be explicit",
    ],
    safety: {
      schemaOnly: true,
      cannotPlaceOrders: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("live-execution-design", "order-intents", `${intentSchemaId}.schema.json`), schema);
  appendNexoraJsonl(INTENT_LOG, { event: "intent_schema.created", schema, createdAt: now() });
  journal("intent_schema.created", schema);

  return { ok: true, nexoraBrain: true, schema };
}

export function createNexoraLiveOrderIntentDraft(input: any = {}) {
  const intentId = String(input.intentId || nexoraLocalId("live_intent_draft"));
  const readiness = evaluateNexoraLiveMoneyReadiness(input).readiness;
  const executionPolicy = getNexoraLiveExecutionPolicy().policy;

  const sizeUsd = money(input.sizeUsd, 0);
  const price = Number(input.price || 0);

  const violations = [
    readiness.decision !== "ready_for_separate_live_execution_design_review" ? "live_money_readiness_not_satisfied" : null,
    !input.humanCommitId ? "missing_human_commit_id" : null,
    !input.evidencePackId ? "missing_evidence_pack_id" : null,
    !input.riskDecisionId ? "missing_risk_decision_id" : null,
    sizeUsd <= 0 ? "invalid_size" : null,
    sizeUsd > Number(executionPolicy.maxSingleTradeUsd || 5) ? "size_exceeds_policy" : null,
    price <= 0 || price >= 1 ? "invalid_price" : null,
  ].filter(Boolean);

  const policy = evaluateNexoraPolicy({
    ...input,
    liveTrading: true,
    bindingCommitment: true,
    approvalRequired: true,
  });

  const intent = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_live_order_intent_draft",
    intentId,
    createdAt: now(),
    status: "blocked_design_only",
    marketId: input.marketId || null,
    asset: input.asset || null,
    side: input.side || null,
    price,
    sizeUsd,
    maxSlippageBps: Number(input.maxSlippageBps || 50),
    expiresAt: input.expiresAt || null,
    reason: String(input.reason || "Future live intent draft. Not executable."),
    evidencePackId: input.evidencePackId || null,
    riskDecisionId: input.riskDecisionId || null,
    humanCommitId: input.humanCommitId || null,
    violations,
    policy,
    readiness,
    executionPolicy,
    executable: false,
    safety: {
      draftOnly: true,
      noLiveOrder: true,
      noSigning: true,
      noPrivateKeys: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("live-execution-design", "order-intents", `${intentId}.json`), intent);
  appendNexoraJsonl(INTENT_LOG, { event: "intent_draft.created", intent, createdAt: now() });
  journal("intent_draft.created", intent);

  return { ok: true, nexoraBrain: true, intent };
}

export function createNexoraExternalSignerSpec(input: any = {}) {
  const signerSpecId = String(input.signerSpecId || nexoraLocalId("external_signer_spec"));

  const spec = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_external_signer_spec",
    signerSpecId,
    createdAt: now(),
    status: "design_only",
    allowedPatterns: [
      "hardware wallet approval",
      "separate isolated signer service",
      "managed custody/signer with scoped permissions",
      "manual signing for early tests",
    ],
    forbiddenPatterns: [
      "private key in source code",
      "private key in Replit env until security review",
      "private key in JSON files",
      "private key in chat logs",
      "seed phrase anywhere in Nexora",
      "hot wallet with large balance",
    ],
    requiredCapabilities: [
      "sign approved order intent only",
      "reject expired intent",
      "reject missing humanCommitId",
      "reject size above cap",
      "reject market not allowlisted",
      "write signed-order audit log",
      "support emergency kill switch",
    ],
    interfaceDraft: {
      input: {
        intentId: "string",
        payloadHash: "string",
        humanCommitId: "string",
        expiresAt: "ISO timestamp",
      },
      output: {
        signedPayload: "string",
        signerId: "string",
        signedAt: "ISO timestamp",
      },
    },
    safety: {
      noImplementation: true,
      noSecrets: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("live-execution-design", "external-signer", `${signerSpecId}.json`), spec);
  appendNexoraJsonl(SIGNER_LOG, { event: "external_signer_spec.created", spec, createdAt: now() });
  journal("external_signer_spec.created", spec);

  return { ok: true, nexoraBrain: true, spec };
}

export function createNexoraLiveExecutionChecklist(input: any = {}) {
  const checklistId = String(input.checklistId || nexoraLocalId("live_exec_checklist"));

  const checklist = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_live_execution_checklist",
    checklistId,
    createdAt: now(),
    status: "not_ready",
    checklist: [
      { item: "Postgres storage upgraded", done: Boolean(input.postgresReady) },
      { item: "durableKernel.ok true", done: Boolean(input.durableKernelOk) },
      { item: "100+ paper settlements", done: Boolean(input.paperSettlementsOk) },
      { item: "positive paper PnL", done: Boolean(input.paperPnlOk) },
      { item: "risk governor history exists", done: Boolean(input.riskGovernorOk) },
      { item: "swarm consensus history exists", done: Boolean(input.swarmOk) },
      { item: "kill switch tested", done: Boolean(input.killSwitchOk) },
      { item: "external signer spec approved", done: Boolean(input.signerApproved) },
      { item: "owner commit recorded", done: Boolean(input.ownerCommit) },
      { item: "live execution code review complete", done: Boolean(input.codeReview) },
    ],
    hardBlocks: [
      "No build may enable live orders until every item is true.",
      "No private keys may be stored in Nexora.",
      "No automated withdrawals.",
      "No live execution without human commit.",
    ],
  };

  const done = checklist.checklist.filter((x) => x.done).length;
  const total = checklist.checklist.length;

  const result = {
    ...checklist,
    done,
    total,
    ready: done === total,
  };

  writeNexoraJson(nexoraLocalPath("live-execution-design", "checklists", `${checklistId}.json`), result);
  appendNexoraJsonl(CHECKLIST_LOG, { event: "live_execution_checklist.created", checklist: result, createdAt: now() });
  journal("live_execution_checklist.created", result);

  return { ok: true, nexoraBrain: true, checklist: result };
}

export function createNexoraLiveExecutionDesignReport(input: any = {}) {
  const reportId = String(input.reportId || nexoraLocalId("live_exec_report"));
  const architecture = createNexoraLiveExecutionArchitecture({ architectureId: `${reportId}_architecture` }).architecture;
  const schema = createNexoraLiveOrderIntentSchema({ intentSchemaId: `${reportId}_intent_schema` }).schema;
  const signer = createNexoraExternalSignerSpec({ signerSpecId: `${reportId}_signer` }).spec;
  const checklist = createNexoraLiveExecutionChecklist(input).checklist;

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_live_execution_design_report",
    reportId,
    createdAt: now(),
    architecture,
    schema,
    signer,
    checklist,
    decision: checklist.ready ? "design_ready_for_review_but_not_enabled" : "not_ready",
    liveTradingEnabled: false,
    privateKeysAllowed: false,
    nextStep: checklist.ready
      ? "Human review of separate live execution implementation."
      : "Continue paper evidence and satisfy checklist.",
  };

  writeNexoraJson(nexoraLocalPath("live-execution-design", "reports", `${reportId}.json`), report);
  appendNexoraJsonl(REPORT_LOG, { event: "live_execution_design_report.created", report, createdAt: now() });
  journal("live_execution_design_report.created", report);

  recordNexoraTimelineEvent({
    type: "live_execution_design",
    title: "Nexora live execution design report created",
    severity: "critical",
    payload: { reportId, decision: report.decision },
  });

  recordNexoraMetric({
    name: "live_execution_checklist_done",
    value: checklist.done,
    unit: "items",
    dimensions: { total: checklist.total },
  });

  return { ok: true, nexoraBrain: true, report };
}

export function getNexoraLiveExecutionDesignStatus() {
  const reports = readNexoraJsonl(REPORT_LOG).filter((row: any) => row.event === "live_execution_design_report.created");
  const intents = readNexoraJsonl(INTENT_LOG);
  const signers = readNexoraJsonl(SIGNER_LOG);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_live_execution_design_status",
    generatedAt: now(),
    reports: reports.length,
    intents: intents.length,
    signerSpecs: signers.length,
    liveTradingEnabled: false,
    privateKeysAllowed: false,
    message: "This is design scaffolding only. It does not enable live trading.",
  };
}
