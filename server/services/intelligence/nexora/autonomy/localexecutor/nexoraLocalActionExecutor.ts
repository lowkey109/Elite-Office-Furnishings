import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";
import {
  runCrmFollowupAgent,
  runFitoutScopeAgent,
  runOfficeReceptionistAgent,
  runProjectHandoverAgent,
  runQuoteBuilderAgent,
  runSupplierScoutAgent,
} from "../officeagents/nexoraOfficeFurnitureAgents";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("local-executor", "journal", "local-executor-journal.jsonl");
const RUN_LOG = nexoraLocalPath("local-executor", "runs", "executor-runs.jsonl");
const RESULT_LOG = nexoraLocalPath("local-executor", "results", "executor-results.jsonl");
const HELD_LOG = nexoraLocalPath("local-executor", "held", "held-actions.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function safeRead(file: string) {
  try {
    return readNexoraJsonl(file);
  } catch {
    return [];
  }
}

function actionText(action: any) {
  return JSON.stringify(action || {}).toLowerCase();
}

function requiresHumanBoundary(action: any = {}) {
  const text = actionText(action);
  const policy = evaluateNexoraPolicy(action);

  const humanBoundary =
    policy.approvalRequired ||
    action.approvalRequired === true ||
    action.risk === "high" ||
    action.risk === "critical" ||
    text.includes("approve") ||
    text.includes("sign") ||
    text.includes("commit") ||
    text.includes("binding") ||
    text.includes("purchase order") ||
    text.includes("payment") ||
    text.includes("refund") ||
    text.includes("legal") ||
    text.includes("contract") ||
    text.includes("live trading") ||
    text.includes("private key");

  return {
    humanBoundary,
    policy,
    reason: humanBoundary
      ? "Action touches approve/sign/commit or high-risk boundary."
      : "Safe local AI preparation action.",
  };
}

function normaliseAction(row: any) {
  const source = row?.action || row?.workOrder || row?.item || row?.payload || row;

  return {
    source,
    actionId:
      source.actionId ||
      source.workOrderId ||
      source.inboxId ||
      source.decisionId ||
      source.id ||
      nexoraLocalId("action"),
    department: source.department || source.division || source.area || "operations",
    assignedAgent: source.assignedAgent || source.ownerAgent || source.worker || "nexora_operations_agent",
    action: source.action || source.title || source.name || "local_action",
    title: source.title || source.action || "Local action",
    risk: source.risk || "safe",
    priority: Number(source.priority || 50),
    payload: source.payload || source,
    status: source.status || "queued",
  };
}

function getInputActionsOnly(input: any = {}) {
  const actions =
    Array.isArray(input.actions) ? input.actions :
    Array.isArray(input.payload?.actions) ? input.payload.actions :
    Array.isArray(input.body?.actions) ? input.body.actions :
    [];

  return actions.map((action: any) => ({
    sourceFile: "input.actions",
    action: normaliseAction(action),
    raw: action,
  }));
}

function readCandidateActions(limit: number) {
  const logs = [
    nexoraLocalPath("company-run", "work-orders", "work-order-log.jsonl"),
    nexoraLocalPath("company-v2", "inbox", "company-inbox.jsonl"),
    nexoraLocalPath("nerve-center", "actions", "action-log.jsonl"),
    nexoraLocalPath("human-ops", "owner-queue", "owner-queue-log.jsonl"),
    nexoraLocalPath("human-company", "inbox", "inbox-log.jsonl"),
    nexoraLocalPath("office-agents", "journal", "office-agent-journal.jsonl"),
  ];

  const rows = logs.flatMap((file) =>
    safeRead(file).map((row: any) => ({
      sourceFile: file,
      row,
    })),
  );

  const candidates = rows
    .map((entry: any) => ({
      sourceFile: entry.sourceFile,
      action: normaliseAction(entry.row),
      raw: entry.row,
    }))
    .filter((entry: any) => {
      const status = String(entry.action.status || "").toLowerCase();
      return !["done", "completed", "processed", "rejected", "approved"].includes(status);
    })
    .slice(-limit)
    .reverse();

  return candidates;
}

function executeByAgent(action: any) {
  const text = actionText(action);
  const payload = action.payload || {};

  if (
    action.assignedAgent.includes("office_receptionist") ||
    action.department === "sales" ||
    text.includes("lead")
  ) {
    return runOfficeReceptionistAgent(payload);
  }

  if (
    action.assignedAgent.includes("quote") ||
    action.department === "quotes" ||
    text.includes("quote")
  ) {
    return runQuoteBuilderAgent(payload);
  }

  if (
    action.assignedAgent.includes("supplier") ||
    action.department === "procurement" ||
    text.includes("supplier")
  ) {
    return runSupplierScoutAgent(payload);
  }

  if (
    action.assignedAgent.includes("crm") ||
    action.department === "crm" ||
    text.includes("follow")
  ) {
    return runCrmFollowupAgent(payload);
  }

  if (
    action.assignedAgent.includes("fitout") ||
    action.department === "fitouts" ||
    text.includes("scope") ||
    text.includes("install")
  ) {
    return runFitoutScopeAgent(payload);
  }

  if (
    action.assignedAgent.includes("project") ||
    action.department === "projects" ||
    text.includes("handover")
  ) {
    return runProjectHandoverAgent(payload);
  }

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_generic_local_action_executor",
    action,
    result: "recorded_generic_safe_action",
    createdAt: now(),
  };
}

export function runNexoraLocalActionExecutor(input: any = {}) {
  const runId = String(input.runId || nexoraLocalId("executor_run"));
  const limit = Number(input.limit || 25);
  const dryRun = input.dryRun === true;

  const inputCandidates = getInputActionsOnly(input);

  const candidates = inputCandidates.length > 0
    ? inputCandidates
    : readCandidateActions(limit);

  const results: any[] = [];

  for (const candidate of candidates) {
    const boundary = requiresHumanBoundary(candidate.action);

    if (boundary.humanBoundary) {
      const held = {
        ok: true,
        nexoraBrain: true,
        runId,
        actionId: candidate.action.actionId,
        status: "held_for_human_boundary",
        reason: boundary.reason,
        boundary,
        candidate,
        createdAt: now(),
      };

      appendNexoraJsonl(HELD_LOG, {
        event: "action.held",
        held,
        createdAt: now(),
      });

      results.push(held);
      continue;
    }

    if (dryRun) {
      results.push({
        ok: true,
        nexoraBrain: true,
        runId,
        actionId: candidate.action.actionId,
        status: "would_execute",
        dryRun: true,
        candidate,
      });
      continue;
    }

    try {
      const execution = executeByAgent(candidate.action);

      const result = {
        ok: true,
        nexoraBrain: true,
        runId,
        actionId: candidate.action.actionId,
        status: "executed_local",
        candidate,
        execution,
        createdAt: now(),
      };

      appendNexoraJsonl(RESULT_LOG, {
        event: "action.executed",
        result,
        createdAt: now(),
      });

      results.push(result);
    } catch (error) {
      const failed = {
        ok: false,
        nexoraBrain: true,
        runId,
        actionId: candidate.action.actionId,
        status: "failed",
        candidate,
        error: error instanceof Error ? error.message : String(error),
        createdAt: now(),
      };

      appendNexoraJsonl(RESULT_LOG, {
        event: "action.failed",
        failed,
        createdAt: now(),
      });

      results.push(failed);
    }
  }

  const summary = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_action_executor",
    runId,
    createdAt: now(),
    dryRun,
    candidateSource: inputCandidates.length > 0 ? "input.actions" : "local.queue",
    candidateCount: candidates.length,
    executed: results.filter((row: any) => row.status === "executed_local").length,
    held: results.filter((row: any) => row.status === "held_for_human_boundary").length,
    failed: results.filter((row: any) => row.status === "failed").length,
    results,
    safety: {
      humansOnlyApproveSignCommit: true,
      noExternalCalls: true,
      noPostgres: true,
      noDeploy: true,
    },
  };

  appendNexoraJsonl(RUN_LOG, {
    event: "executor.run",
    summary,
    createdAt: now(),
  });

  journal("executor.run", summary);

  recordNexoraTimelineEvent({
    type: "local_action_executor",
    title: "Nexora local action executor run",
    severity: summary.failed > 0 ? "warning" : "info",
    payload: {
      runId,
      executed: summary.executed,
      held: summary.held,
      failed: summary.failed,
    },
  });

  recordNexoraMetric({
    name: "nexora_local_actions_executed",
    value: summary.executed,
    unit: "actions",
    dimensions: {
      held: summary.held,
      failed: summary.failed,
    },
  });

  return summary;
}

export function getNexoraLocalActionExecutorStatus() {
  const runs = safeRead(RUN_LOG)
    .filter((row: any) => row.event === "executor.run")
    .map((row: any) => row.summary);

  const held = safeRead(HELD_LOG)
    .filter((row: any) => row.event === "action.held")
    .map((row: any) => row.held);

  const results = safeRead(RESULT_LOG);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_action_executor_status",
    generatedAt: now(),
    runs: runs.length,
    held: held.length,
    resultEvents: results.length,
    latestRun: runs[runs.length - 1] || null,
    recentHeld: held.slice(-20).reverse(),
    safety: {
      humanBoundary: ["approve", "sign", "commit"],
      aiExecutesEverythingElse: true,
      noExternalCalls: true,
    },
  };
}

export function getNexoraLocalActionExecutorReport(input: any = {}) {
  const limit = Number(input.limit || 50);

  const runs = safeRead(RUN_LOG)
    .filter((row: any) => row.event === "executor.run")
    .map((row: any) => row.summary)
    .slice(-limit)
    .reverse();

  const held = safeRead(HELD_LOG)
    .filter((row: any) => row.event === "action.held")
    .map((row: any) => row.held)
    .slice(-limit)
    .reverse();

  const executed = safeRead(RESULT_LOG)
    .filter((row: any) => row.event === "action.executed")
    .map((row: any) => row.result)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_action_executor_report",
    generatedAt: now(),
    runs,
    held,
    executed,
  };
}
