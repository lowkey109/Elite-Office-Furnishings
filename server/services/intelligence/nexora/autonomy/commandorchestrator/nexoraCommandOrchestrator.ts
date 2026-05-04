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

function now() {
  return new Date().toISOString();
}

const COMMAND_LOG = nexoraLocalPath("command-orchestrator", "commands", "command-log.jsonl");
const PLAN_LOG = nexoraLocalPath("command-orchestrator", "plans", "plan-log.jsonl");
const RUNBOOK_LOG = nexoraLocalPath("command-orchestrator", "runbooks", "runbook-log.jsonl");
const QUEUE_LOG = nexoraLocalPath("command-orchestrator", "queue", "queue-log.jsonl");
const RESULT_LOG = nexoraLocalPath("command-orchestrator", "results", "result-log.jsonl");
const JOURNAL = nexoraLocalPath("command-orchestrator", "journal", "orchestrator-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function classifyRisk(input: any = {}) {
  const text = JSON.stringify(input).toLowerCase();
  const policy = evaluateNexoraPolicy(input);

  const humanOnly =
    policy.approvalRequired ||
    input.approvalRequired === true ||
    text.includes("approve") ||
    text.includes("sign") ||
    text.includes("commit") ||
    text.includes("purchase order") ||
    text.includes("binding") ||
    text.includes("payment") ||
    text.includes("refund") ||
    text.includes("legal") ||
    text.includes("contract") ||
    text.includes("live trading") ||
    text.includes("private key");

  const blocked =
    text.includes("private key") ||
    text.includes("seed phrase") ||
    text.includes("wallet secret") ||
    text.includes("live clob order") ||
    text.includes("real order");

  return {
    policy,
    humanOnly,
    blocked,
    risk: blocked ? "critical" : humanOnly ? "high" : input.risk || "safe",
    status: blocked ? "blocked" : humanOnly ? "human_boundary_required" : "safe_to_prepare",
  };
}

function defaultCommandTemplates() {
  return [
    {
      commandKey: "run_company_day",
      title: "Run Company Day",
      department: "operations",
      purpose: "Create owner briefing, office work, approvals board, local loop tick.",
      routes: [
        { method: "GET", path: "/api/nexora/local-command-center/status" },
        { method: "POST", path: "/api/nexora/office-agents/tick" },
        { method: "GET", path: "/api/nexora/human-boundary/status" },
        { method: "GET", path: "/api/nexora/company-completion/owner-cockpit" },
      ],
      risk: "safe",
    },
    {
      commandKey: "process_new_office_lead",
      title: "Process New Office Lead",
      department: "office",
      purpose: "Intake lead, draft follow-up, prepare quote pathway.",
      routes: [
        { method: "POST", path: "/api/nexora/office-agents/lead/intake" },
        { method: "POST", path: "/api/nexora/office-agents/followup/draft" },
        { method: "POST", path: "/api/nexora/office-agents/quote/draft" },
      ],
      risk: "safe",
    },
    {
      commandKey: "prepare_quote_pack",
      title: "Prepare Quote Pack",
      department: "quotes",
      purpose: "Seed products, create quote pack, create customer draft, create approval packet if needed.",
      routes: [
        { method: "POST", path: "/api/nexora/product-catalogue/seed" },
        { method: "POST", path: "/api/nexora/quote-pack/create" },
        { method: "POST", path: "/api/nexora/comms-docs/customer-quote-draft" },
      ],
      risk: "medium",
    },
    {
      commandKey: "supplier_confidence_check",
      title: "Supplier Confidence Check",
      department: "procurement",
      purpose: "Prepare non-binding supplier request and supplier pack.",
      routes: [
        { method: "POST", path: "/api/nexora/office-agents/supplier/request" },
        { method: "POST", path: "/api/nexora/comms-docs/supplier-pack" },
      ],
      risk: "medium",
    },
    {
      commandKey: "run_paper_trading_lab",
      title: "Run Paper Trading Lab",
      department: "trading",
      purpose: "Run paper market data cycle, risk check, backtest, and dashboard snapshot.",
      routes: [
        { method: "POST", path: "/api/nexora/market-data/cycle" },
        { method: "POST", path: "/api/nexora/backtesting/run" },
        { method: "GET", path: "/api/nexora/trading-dashboard/status" },
        { method: "POST", path: "/api/nexora/trading-readiness/gate" },
      ],
      risk: "medium",
      safety: {
        paperOnly: true,
        noLiveTrading: true,
      },
    },
    {
      commandKey: "teach_nexora_unknown_task",
      title: "Teach Nexora Unknown Task",
      department: "learning",
      purpose: "Assess capability, create gap, lesson, example, playbook, training record.",
      routes: [
        { method: "POST", path: "/api/nexora/teaching/capability/assess" },
        { method: "POST", path: "/api/nexora/teaching/gap/create" },
        { method: "POST", path: "/api/nexora/teaching/lesson/create" },
        { method: "POST", path: "/api/nexora/teaching/playbook/from-lesson" },
      ],
      risk: "safe",
    },
  ];
}

export function seedNexoraCommandTemplates() {
  const templates = defaultCommandTemplates();

  for (const command of templates) {
    writeNexoraJson(nexoraLocalPath("command-orchestrator", "commands", `${command.commandKey}.json`), {
      ok: true,
      nexoraBrain: true,
      ...command,
      createdAt: now(),
    });

    appendNexoraJsonl(COMMAND_LOG, {
      event: "command.seeded",
      command,
      createdAt: now(),
    });
  }

  journal("commands.seeded", { count: templates.length });

  return {
    ok: true,
    nexoraBrain: true,
    count: templates.length,
    commands: templates,
  };
}

export function registerNexoraCommand(input: any = {}) {
  const commandKey = String(input.commandKey || nexoraLocalId("command"));
  const command = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_command_template",
    commandKey,
    title: String(input.title || commandKey),
    department: String(input.department || "operations"),
    purpose: String(input.purpose || "Nexora command"),
    routes: Array.isArray(input.routes) ? input.routes : [],
    risk: String(input.risk || "safe"),
    safety: input.safety || {},
    createdAt: now(),
  };

  writeNexoraJson(nexoraLocalPath("command-orchestrator", "commands", `${commandKey}.json`), command);
  appendNexoraJsonl(COMMAND_LOG, { event: "command.registered", command, createdAt: now() });
  journal("command.registered", command);

  return { ok: true, nexoraBrain: true, command };
}

export function listNexoraCommands(input: any = {}) {
  const department = input.department ? String(input.department) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(COMMAND_LOG)
    .filter((row: any) => row.event === "command.seeded" || row.event === "command.registered")
    .map((row: any) => row.command)
    .filter((command: any) => !department || command.department === department)
    .slice(-limit)
    .reverse();

  const byKey = new Map<string, any>();
  for (const row of rows) {
    const key = row.commandKey;
    if (!byKey.has(key)) byKey.set(key, row);
  }

  return {
    ok: true,
    nexoraBrain: true,
    count: byKey.size,
    rows: [...byKey.values()],
  };
}

export function createNexoraExecutionPlan(input: any = {}) {
  const planId = String(input.planId || nexoraLocalId("execution_plan"));
  const commandKey = String(input.commandKey || "run_company_day");

  const command =
    input.command ||
    readNexoraJson(nexoraLocalPath("command-orchestrator", "commands", `${commandKey}.json`), null) ||
    defaultCommandTemplates().find((cmd) => cmd.commandKey === commandKey);

  if (!command) {
    return { ok: false, nexoraBrain: true, error: "Command not found.", commandKey };
  }

  const risk = classifyRisk({
    ...command,
    payload: input.payload || {},
  });

  const steps = (command.routes || []).map((route: any, index: number) => {
    const stepRisk = classifyRisk(route);

    return {
      stepId: `${planId}_step_${index + 1}`,
      index,
      method: route.method || "GET",
      path: route.path,
      payload: route.payload || input.payload || {},
      status: risk.blocked || stepRisk.blocked
        ? "blocked"
        : risk.humanOnly || stepRisk.humanOnly
          ? "human_boundary_required"
          : "planned",
      risk: stepRisk.risk,
      humanBoundary: stepRisk.humanOnly,
      blocked: stepRisk.blocked,
    };
  });

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_execution_plan",
    planId,
    commandKey,
    title: command.title,
    department: command.department,
    createdAt: now(),
    risk,
    steps,
    status: risk.blocked
      ? "blocked"
      : risk.humanOnly
        ? "human_boundary_required"
        : "planned",
    safety: {
      noNetworkCall: true,
      dryRunPlan: true,
      humansOnlyApproveSignCommit: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("command-orchestrator", "plans", `${planId}.json`), plan);
  appendNexoraJsonl(PLAN_LOG, { event: "plan.created", plan, createdAt: now() });
  journal("plan.created", plan);

  return { ok: true, nexoraBrain: true, plan };
}

export function createNexoraRunbook(input: any = {}) {
  const runbookId = String(input.runbookId || nexoraLocalId("runbook"));
  const plan = input.plan || createNexoraExecutionPlan(input).plan;

  if (!plan) {
    return { ok: false, nexoraBrain: true, error: "Could not create plan." };
  }

  const runbook = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_command_runbook",
    runbookId,
    planId: plan.planId,
    commandKey: plan.commandKey,
    createdAt: now(),
    title: `Runbook: ${plan.title}`,
    steps: plan.steps.map((step: any) => ({
      ...step,
      instruction:
        step.status === "human_boundary_required"
          ? "Hold for human approve/sign/commit."
          : step.status === "blocked"
            ? "Blocked. Do not execute."
            : "Safe local dry-run step. Use existing route manually or via local runner only.",
    })),
    safety: {
      dryRunOnly: true,
      noExternalCommitment: true,
      noPostgres: true,
      noDeploy: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("command-orchestrator", "runbooks", `${runbookId}.json`), runbook);
  appendNexoraJsonl(RUNBOOK_LOG, { event: "runbook.created", runbook, createdAt: now() });
  journal("runbook.created", runbook);

  return { ok: true, nexoraBrain: true, runbook };
}

export function queueNexoraCommand(input: any = {}) {
  const queueId = String(input.queueId || nexoraLocalId("command_queue"));
  const plan = input.plan || createNexoraExecutionPlan(input).plan;

  if (!plan) {
    return { ok: false, nexoraBrain: true, error: "Could not create plan." };
  }

  const item = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_command_queue_item",
    queueId,
    planId: plan.planId,
    commandKey: plan.commandKey,
    status: plan.status === "planned" ? "queued" : plan.status,
    createdAt: now(),
    plan,
    safety: {
      noNetworkCall: true,
      localOnly: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("command-orchestrator", "queue", `${queueId}.json`), item);
  appendNexoraJsonl(QUEUE_LOG, { event: "command.queued", item, createdAt: now() });
  journal("command.queued", item);

  return { ok: true, nexoraBrain: true, item };
}

export function runNexoraCommandDryRun(input: any = {}) {
  const runId = String(input.runId || nexoraLocalId("command_dry_run"));
  const item = input.item || queueNexoraCommand(input).item;

  if (!item) {
    return { ok: false, nexoraBrain: true, error: "Could not queue command." };
  }

  const results = (item.plan.steps || []).map((step: any) => ({
    stepId: step.stepId,
    method: step.method,
    path: step.path,
    status: step.status === "planned" ? "would_run" : step.status,
    dryRun: true,
    executed: false,
    reason:
      step.status === "planned"
        ? "Dry-run only. No HTTP request made."
        : step.status,
  }));

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_command_dry_run",
    runId,
    queueId: item.queueId,
    planId: item.planId,
    commandKey: item.commandKey,
    createdAt: now(),
    results,
    summary: {
      total: results.length,
      wouldRun: results.filter((r: any) => r.status === "would_run").length,
      held: results.filter((r: any) => r.status === "human_boundary_required").length,
      blocked: results.filter((r: any) => r.status === "blocked").length,
    },
  };

  writeNexoraJson(nexoraLocalPath("command-orchestrator", "results", `${runId}.json`), result);
  appendNexoraJsonl(RESULT_LOG, { event: "command.dry_run", result, createdAt: now() });
  journal("command.dry_run", result);

  recordNexoraTimelineEvent({
    type: "command_dry_run",
    title: `Command dry-run: ${item.commandKey}`,
    severity: result.summary.blocked ? "warning" : "info",
    payload: result.summary,
  });

  recordNexoraMetric({
    name: "nexora_command_dry_run",
    value: 1,
    unit: "run",
    dimensions: { commandKey: item.commandKey },
  });

  return { ok: true, nexoraBrain: true, result };
}

export function getNexoraCommandDashboard(input: any = {}) {
  const commands = listNexoraCommands({ limit: 1000 });
  const plans = readNexoraJsonl(PLAN_LOG).filter((row: any) => row.event === "plan.created");
  const runbooks = readNexoraJsonl(RUNBOOK_LOG).filter((row: any) => row.event === "runbook.created");
  const queue = readNexoraJsonl(QUEUE_LOG).filter((row: any) => row.event === "command.queued");
  const results = readNexoraJsonl(RESULT_LOG).filter((row: any) => row.event === "command.dry_run");

  const dashboard = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_command_orchestrator_dashboard",
    generatedAt: now(),
    counts: {
      commands: commands.count,
      plans: plans.length,
      runbooks: runbooks.length,
      queue: queue.length,
      dryRuns: results.length,
    },
    recent: {
      commands: commands.rows.slice(0, 20),
      plans: plans.slice(-20).reverse(),
      queue: queue.slice(-20).reverse(),
      results: results.slice(-20).reverse(),
    },
    safety: {
      noNetworkCalls: true,
      dryRunOnly: true,
      humansOnlyApproveSignCommit: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("command-orchestrator", "dashboard", "latest.json"), dashboard);
  journal("dashboard.created", dashboard);

  return { ok: true, nexoraBrain: true, dashboard };
}

export function getNexoraCommandOrchestratorStatus() {
  const dashboard = getNexoraCommandDashboard({}).dashboard;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_command_orchestrator",
    generatedAt: now(),
    counts: dashboard.counts,
    mode: "local_dry_run_only",
  };
}
