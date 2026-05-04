import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { evaluateNexoraPolicy } from "../policy/nexoraPolicyPack";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { getNexoraMetrics, recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("master-control", "journal", "master-control-journal.jsonl");
const RUN_LOG = nexoraLocalPath("master-control", "runs", "local-run-log.jsonl");
const ROUTE_REGISTRY_FILE = nexoraLocalPath("master-control", "route-registry", "local-route-registry.json");
const GUARD_FILE = nexoraLocalPath("master-control", "guards", "no-deploy-guard.json");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", "client", ".cache"].includes(name)) continue;

    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|js)$/.test(name)) out.push(full);
  }

  return out;
}

function safeLog(file: string) {
  try {
    return readNexoraJsonl(file);
  } catch {
    return [];
  }
}

export function createNexoraNoDeployGuard(input: any = {}) {
  const guard = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_no_deploy_guard",
    createdAt: now(),
    mode: "local_only",
    deployAllowed: false,
    postgresAllowed: false,
    railwayAllowed: false,
    reason: String(input.reason || "Postgres storage is not ready. Building local/offline Nexora only."),
    hardRules: [
      "Do not deploy to Railway until operator explicitly allows it.",
      "Do not run Postgres replay until storage is upgraded.",
      "Do not enable durable loops.",
      "Do not place live trading orders.",
      "Do not use private keys.",
      "Humans only approve, sign, and commit.",
      "Nexora does everything else locally.",
    ],
    overrideLaterRequires: [
      "Postgres storage purchased/upgraded",
      "runtime db-check healthy",
      "operator confirms deploy",
      "migration dry-run complete",
    ],
  };

  writeNexoraJson(GUARD_FILE, guard);
  journal("no_deploy_guard.created", guard);

  return {
    ok: true,
    nexoraBrain: true,
    guard,
  };
}

export function getNexoraNoDeployGuard() {
  if (!fs.existsSync(GUARD_FILE)) {
    return createNexoraNoDeployGuard({});
  }

  return {
    ok: true,
    nexoraBrain: true,
    guard: JSON.parse(fs.readFileSync(GUARD_FILE, "utf8")),
  };
}

export function createNexoraLocalRouteRegistry() {
  const files = walk("server/services/intelligence/nexora");
  const routes: any[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const re = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;

    let match;
    while ((match = re.exec(source))) {
      const method = match[1].toUpperCase();
      const routePath = match[2];

      if (!routePath.includes("/api/nexora")) continue;

      routes.push({
        method,
        path: routePath,
        file,
        highRisk: /approve|sign|commit|purge|delete|replay|restore|migration|execute|burst|live|private|key/i.test(routePath),
        localOnly: !/durable|postgres|db-mode|runtime\/db/i.test(routePath),
      });
    }
  }

  const registry = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_route_registry",
    generatedAt: now(),
    routeCount: routes.length,
    localOnlyCount: routes.filter((route) => route.localOnly).length,
    highRiskCount: routes.filter((route) => route.highRisk).length,
    routes: routes.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`)),
  };

  writeNexoraJson(ROUTE_REGISTRY_FILE, registry);
  journal("local_route_registry.created", registry);

  return {
    ok: true,
    nexoraBrain: true,
    registry,
  };
}

export function getNexoraLocalMasterStatus() {
  const guard = getNexoraNoDeployGuard().guard;
  const registry = fs.existsSync(ROUTE_REGISTRY_FILE)
    ? JSON.parse(fs.readFileSync(ROUTE_REGISTRY_FILE, "utf8"))
    : createNexoraLocalRouteRegistry().registry;

  const runRows = safeLog(RUN_LOG);
  const journalRows = safeLog(JOURNAL);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_master_control",
    generatedAt: now(),
    mode: "local_only_ai_company",
    deployAllowed: false,
    postgresRequired: false,
    guard,
    routeRegistrySummary: {
      routeCount: registry.routeCount,
      localOnlyCount: registry.localOnlyCount,
      highRiskCount: registry.highRiskCount,
    },
    counts: {
      localRuns: runRows.length,
      journalEvents: journalRows.length,
    },
    doctrine: {
      humanOnly: ["approve", "sign", "commit"],
      nexoraDoesEverythingElse: true,
      noExceptions: true,
    },
  };
}

export function createNexoraLocalCompanySimulator(input: any = {}) {
  const simulationId = String(input.simulationId || nexoraLocalId("local_company_sim"));

  const scenarios = Array.isArray(input.scenarios) && input.scenarios.length
    ? input.scenarios
    : [
        {
          name: "New office furniture lead",
          department: "sales",
          action: "lead_intake_and_qualification",
          aiDoes: ["capture", "score", "ask missing questions", "draft follow-up"],
          humanDoes: [],
          risk: "safe",
        },
        {
          name: "High-value quote",
          department: "quotes",
          action: "draft_quote_and_margin_check",
          aiDoes: ["draft", "calculate margin", "write assumptions"],
          humanDoes: ["commit"],
          risk: "high",
        },
        {
          name: "Supplier request",
          department: "procurement",
          action: "draft_non_binding_supplier_request",
          aiDoes: ["draft", "compare", "track lead time"],
          humanDoes: ["commit if purchase order"],
          risk: "medium",
        },
        {
          name: "Fitout install scope",
          department: "fitouts",
          action: "capture_install_constraints",
          aiDoes: ["checklist", "risk flag", "missing info questions"],
          humanDoes: ["commit delivery/install date"],
          risk: "medium",
        },
        {
          name: "Unknown task",
          department: "learning",
          action: "create_gap_lesson_playbook_training",
          aiDoes: ["gap", "lesson", "playbook", "training"],
          humanDoes: ["teach example if needed"],
          risk: "safe",
        },
      ];

  const results = scenarios.map((scenario: any, index: number) => {
    const policy = evaluateNexoraPolicy(scenario);
    const humanOnly = scenario.humanDoes || [];

    return {
      index,
      scenario,
      policy,
      aiCanProceed: !policy.approvalRequired,
      humanBoundary: humanOnly,
      status: policy.approvalRequired || humanOnly.length ? "human_boundary_present" : "ai_can_run",
    };
  });

  const simulation = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_company_simulator",
    simulationId,
    createdAt: now(),
    results,
    summary: {
      scenarios: results.length,
      aiCanRun: results.filter((row: any) => row.status === "ai_can_run").length,
      humanBoundary: results.filter((row: any) => row.status === "human_boundary_present").length,
    },
    safety: {
      localOnly: true,
      noDeploy: true,
      noExternalCommitment: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("master-control", "runs", `${simulationId}.simulation.json`), simulation);
  journal("local_company_simulation.created", simulation);

  return {
    ok: true,
    nexoraBrain: true,
    simulation,
  };
}

export function runNexoraLocalMasterRun(input: any = {}) {
  const runId = String(input.runId || nexoraLocalId("local_master_run"));

  const guard = createNexoraNoDeployGuard({
    reason: "Local master run keeps operating while deploy/Postgres are intentionally paused.",
  });
  const registry = createNexoraLocalRouteRegistry();
  const simulator = createNexoraLocalCompanySimulator({
    simulationId: `${runId}_simulation`,
  });

  const run = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_master_run",
    runId,
    createdAt: now(),
    guard,
    registry,
    simulator,
    ownerActions: [
      "Approve only.",
      "Sign only.",
      "Commit only.",
      "Let Nexora do the rest.",
      "Do not deploy until Postgres storage is upgraded.",
    ],
    nextBuildRecommendations: [
      "Local UI cockpit",
      "Admin auth middleware enforcement",
      "Product catalogue",
      "Quote PDF generation",
      "Email sending after human approval",
    ],
  };

  writeNexoraJson(nexoraLocalPath("master-control", "runs", `${runId}.json`), run);

  appendNexoraJsonl(RUN_LOG, {
    event: "local_master_run.created",
    run,
    createdAt: now(),
  });

  journal("local_master_run.created", run);

  recordNexoraTimelineEvent({
    type: "local_master_run",
    title: "Nexora local master run completed",
    severity: "info",
    payload: {
      runId,
      routeCount: registry.registry.routeCount,
    },
  });

  recordNexoraMetric({
    name: "nexora_local_master_run",
    value: 1,
    unit: "run",
    dimensions: {
      deployAllowed: false,
    },
  });

  return run;
}

export function createNexoraLocalOwnerBriefing(input: any = {}) {
  const briefingId = String(input.briefingId || nexoraLocalId("local_owner_briefing"));
  const status = getNexoraLocalMasterStatus();
  const simulation = createNexoraLocalCompanySimulator({
    simulationId: `${briefingId}_simulation`,
  }).simulation;

  const briefing = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_owner_briefing",
    briefingId,
    createdAt: now(),
    status,
    simulation,
    briefing: {
      whatNexoraDoes: [
        "runs daily local company operations",
        "creates drafts",
        "scores risk",
        "routes work",
        "prepares quote/supplier/project/customer records",
        "teaches herself when she does not know",
        "rewards successful work",
        "keeps local records while Postgres is paused",
      ],
      whatHumanDoes: [
        "approve",
        "sign",
        "commit",
      ],
      blockedNow: [
        "Railway deploy",
        "Postgres replay",
        "live trading",
        "private keys",
      ],
    },
    nextHumanAction: "Continue building local/offline Nexora. Buy Postgres storage later before deploy/replay.",
  };

  writeNexoraJson(nexoraLocalPath("master-control", "briefings", `${briefingId}.json`), briefing);
  journal("local_owner_briefing.created", briefing);

  return {
    ok: true,
    nexoraBrain: true,
    briefing,
  };
}
