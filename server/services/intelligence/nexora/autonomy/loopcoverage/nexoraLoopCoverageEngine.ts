import fs from "fs";
import path from "path";
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

const JOURNAL = nexoraLocalPath("loop-coverage", "journal", "loop-coverage-journal.jsonl");
const AUDIT_FILE = nexoraLocalPath("loop-coverage", "audit", "latest-loop-coverage-audit.json");
const REGISTRY_FILE = nexoraLocalPath("loop-coverage", "registry", "loop-coverage-registry.json");
const EXPANSION_LOG = nexoraLocalPath("loop-coverage", "expansion", "loop-expansion-log.jsonl");

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

function routeGroup(routePath: string) {
  const parts = routePath.split("/").filter(Boolean);
  return "/" + parts.slice(0, 3).join("/");
}

function classifyRoute(method: string, routePath: string) {
  const text = `${method} ${routePath}`.toLowerCase();

  const dangerous =
    text.includes("delete") ||
    text.includes("purge") ||
    text.includes("restore") ||
    text.includes("replay") ||
    text.includes("deploy") ||
    text.includes("private") ||
    text.includes("key") ||
    text.includes("live-trading") ||
    text.includes("live_trading") ||
    text.includes("wallet") ||
    text.includes("payment") ||
    text.includes("refund");

  const humanOnly =
    text.includes("approve") ||
    text.includes("approval") ||
    text.includes("sign") ||
    text.includes("commit") ||
    text.includes("decide") ||
    text.includes("purchase-order") ||
    text.includes("purchase_order");

  const loopableKeywords = [
    "status",
    "summary",
    "briefing",
    "daily",
    "tick",
    "report",
    "dashboard",
    "cockpit",
    "board",
    "queue",
    "stale",
    "risk",
    "score",
    "health",
    "monitor",
    "watch",
    "journal",
    "timeline",
    "learning",
    "teaching",
    "rewards",
    "office-agents",
    "company-run",
    "company-v2",
    "company-completion",
    "human-ops",
    "human-company",
    "human-boundary",
    "resilience",
    "local-master",
    "active-loop",
    "local-loops",
    "storage",
    "maintenance",
    "polymarket-paper",
  ];

  const loopable = !dangerous && !humanOnly && loopableKeywords.some((keyword) => text.includes(keyword));

  let classification: "loopable" | "manual" | "human_only" | "dangerous_blocked" = "manual";

  if (dangerous) classification = "dangerous_blocked";
  else if (humanOnly) classification = "human_only";
  else if (loopable) classification = "loopable";

  const cadence =
    routePath.includes("daily") || routePath.includes("briefing") || routePath.includes("cockpit")
      ? "daily"
      : routePath.includes("weekly")
        ? "weekly"
        : routePath.includes("status") || routePath.includes("health") || routePath.includes("monitor")
          ? "hourly"
          : "manual";

  return {
    classification,
    loopable,
    dangerous,
    humanOnly,
    cadence,
    risk: dangerous || humanOnly ? "high" : loopable ? "safe" : "medium",
  };
}

function discoverNexoraRoutes() {
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

      const classification = classifyRoute(method, routePath);

      routes.push({
        method,
        path: routePath,
        group: routeGroup(routePath),
        file,
        ...classification,
      });
    }
  }

  return routes.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

export function auditNexoraLoopCoverage() {
  const routes = discoverNexoraRoutes();

  const loopable = routes.filter((route) => route.classification === "loopable");
  const humanOnly = routes.filter((route) => route.classification === "human_only");
  const dangerous = routes.filter((route) => route.classification === "dangerous_blocked");
  const manual = routes.filter((route) => route.classification === "manual");

  const currentRegistry = readNexoraJson(REGISTRY_FILE, {
    loops: [],
  });

  const currentLoopKeys = new Set((currentRegistry.loops || []).map((loop: any) => `${loop.method} ${loop.route}`));

  const missingLoopCoverage = loopable.filter((route) => !currentLoopKeys.has(`${route.method} ${route.path}`));

  const audit = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_loop_coverage_audit",
    generatedAt: now(),
    counts: {
      routes: routes.length,
      loopable: loopable.length,
      humanOnly: humanOnly.length,
      dangerous: dangerous.length,
      manual: manual.length,
      existingLoops: currentRegistry.loops?.length || 0,
      missingLoopCoverage: missingLoopCoverage.length,
    },
    routes,
    loopable,
    humanOnly,
    dangerous,
    manual,
    missingLoopCoverage,
    safety: {
      dangerousNeverLooped: true,
      humanOnlyNeverAutoExecuted: true,
      noPostgres: true,
      noDeploy: true,
    },
  };

  writeNexoraJson(AUDIT_FILE, audit);
  journal("loop_coverage.audit", audit);

  return audit;
}

export function expandNexoraSafeLoopCoverage(input: any = {}) {
  const audit = auditNexoraLoopCoverage();
  const limit = Number(input.limit || 200);

  const currentRegistry = readNexoraJson(REGISTRY_FILE, {
    ok: true,
    nexoraBrain: true,
    service: "nexora_loop_coverage_registry",
    createdAt: now(),
    loops: [],
  });

  const existingKeys = new Set((currentRegistry.loops || []).map((loop: any) => `${loop.method} ${loop.route}`));

  const additions = audit.missingLoopCoverage.slice(0, limit).map((route: any) => ({
    loopId: `loop_${route.method.toLowerCase()}_${route.path.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
    name: `${route.method} ${route.path}`,
    route: route.path,
    method: route.method,
    group: route.group,
    cadence: route.cadence,
    enabled: true,
    risk: route.risk,
    ownerAgent: inferOwnerAgent(route.path),
    dryRunOnly: true,
    noNetworkCall: true,
    noPostgres: true,
    noDeploy: true,
    createdAt: now(),
  }));

  const registry = {
    ...currentRegistry,
    ok: true,
    nexoraBrain: true,
    service: "nexora_loop_coverage_registry",
    updatedAt: now(),
    loops: [
      ...(currentRegistry.loops || []),
      ...additions.filter((loop: any) => !existingKeys.has(`${loop.method} ${loop.route}`)),
    ],
    safety: {
      noDangerousLoops: true,
      noHumanOnlyLoops: true,
      dryRunOnly: true,
      noPostgres: true,
      noDeploy: true,
    },
  };

  writeNexoraJson(REGISTRY_FILE, registry);

  appendNexoraJsonl(EXPANSION_LOG, {
    event: "loop_coverage.expanded",
    additions,
    createdAt: now(),
  });

  journal("loop_coverage.expanded", {
    added: additions.length,
  });

  recordNexoraTimelineEvent({
    type: "loop_coverage",
    title: "Nexora safe loop coverage expanded",
    severity: "info",
    payload: {
      added: additions.length,
      totalLoops: registry.loops.length,
    },
  });

  recordNexoraMetric({
    name: "nexora_safe_loop_coverage_added",
    value: additions.length,
    unit: "loops",
    dimensions: {},
  });

  return {
    ok: true,
    nexoraBrain: true,
    added: additions.length,
    additions,
    registry,
  };
}

function inferOwnerAgent(routePath: string) {
  if (routePath.includes("office")) return "office_receptionist_agent";
  if (routePath.includes("quote")) return "quote_builder_agent";
  if (routePath.includes("supplier")) return "supplier_scout_agent";
  if (routePath.includes("crm")) return "crm_followup_agent";
  if (routePath.includes("project") || routePath.includes("fitout")) return "project_handover_agent";
  if (routePath.includes("teaching") || routePath.includes("learning")) return "learning_worker";
  if (routePath.includes("reward")) return "learning_worker";
  if (routePath.includes("human")) return "nexora_execution_gate";
  if (routePath.includes("polymarket") || routePath.includes("trading")) return "phantom_x_paper_agent";
  if (routePath.includes("maintenance") || routePath.includes("resilience") || routePath.includes("storage")) return "nexora_operations_agent";
  if (routePath.includes("company")) return "nexora_command_centre";
  return "nexora_operations_agent";
}

export function getNexoraLoopCoverageRegistry() {
  const registry = readNexoraJson(REGISTRY_FILE, {
    ok: true,
    nexoraBrain: true,
    service: "nexora_loop_coverage_registry",
    loops: [],
  });

  return {
    ok: true,
    nexoraBrain: true,
    registry,
  };
}

export function getNexoraLoopCoverageStatus() {
  const audit = auditNexoraLoopCoverage();
  const registry = getNexoraLoopCoverageRegistry().registry;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_loop_coverage_status",
    generatedAt: now(),
    routeCount: audit.counts.routes,
    loopable: audit.counts.loopable,
    humanOnly: audit.counts.humanOnly,
    dangerous: audit.counts.dangerous,
    registryLoops: registry.loops?.length || 0,
    missingLoopCoverage: audit.counts.missingLoopCoverage,
    safety: {
      humanOnlyNotLooped: true,
      dangerousNotLooped: true,
    },
  };
}

export function createNexoraLoopCoverageReport() {
  const audit = auditNexoraLoopCoverage();
  const registry = getNexoraLoopCoverageRegistry().registry;

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_loop_coverage_report",
    generatedAt: now(),
    summary: getNexoraLoopCoverageStatus(),
    audit,
    registry,
    recommendedActions: [
      audit.counts.missingLoopCoverage > 0
        ? "Run expand-safe to add dry-run loop coverage for safe recurring routes."
        : "Safe loop coverage appears complete.",
      "Never loop approval/sign/commit routes.",
      "Never loop deploy/replay/delete/purge/live trading routes.",
      "Keep active local loop dry-run/local-only while Postgres is paused.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("loop-coverage", "audit", "loop-coverage-report.json"), report);
  journal("loop_coverage.report", report);

  return report;
}
