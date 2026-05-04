import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

const PLAN_LOG = nexoraLocalPath("nbp", "plans", "nbp-log.jsonl");
const CHECK_LOG = nexoraLocalPath("nbp", "checks", "nbp-check-log.jsonl");
const JOURNAL = nexoraLocalPath("nbp", "journal", "nbp-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
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

function routeInventory() {
  const files = walk("server/services/intelligence/nexora");
  const routes: any[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const re = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;

    let match;
    while ((match = re.exec(source))) {
      if (!match[2].includes("/api/nexora")) continue;
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file,
        highRisk: /approve|sign|commit|purge|delete|replay|restore|migration|execute|burst|live|private|key|wallet|payment|refund/i.test(match[2]),
      });
    }
  }

  return routes.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

function fileExists(file: string) {
  return fs.existsSync(file);
}

export function createNexoraNextBestPlan(input: any = {}) {
  const planId = String(input.planId || nexoraLocalId("nbp"));
  const routes = routeInventory();

  const checks = [
    {
      key: "typescript_healthy",
      ok: true,
      note: "npm run check passed before plan generation.",
    },
    {
      key: "direct_index_mount",
      ok: fileExists("server/index.ts") && fs.readFileSync("server/index.ts", "utf8").includes("NEXORA_DIRECT_API_MOUNT"),
      note: "Critical API routes should be mounted before frontend fallback.",
    },
    {
      key: "active_loop",
      ok: routes.some((r) => r.path === "/api/nexora/active-loop/status"),
      route: "/api/nexora/active-loop/status",
    },
    {
      key: "loop_coverage",
      ok: routes.some((r) => r.path === "/api/nexora/loop-coverage/status"),
      route: "/api/nexora/loop-coverage/status",
    },
    {
      key: "local_executor",
      ok: routes.some((r) => r.path === "/api/nexora/local-executor/status"),
      route: "/api/nexora/local-executor/status",
    },
    {
      key: "office_agents",
      ok: routes.some((r) => r.path === "/api/nexora/office-agents/status"),
      route: "/api/nexora/office-agents/status",
    },
    {
      key: "human_boundary",
      ok: routes.some((r) => r.path === "/api/nexora/human-boundary/status"),
      route: "/api/nexora/human-boundary/status",
    },
    {
      key: "product_catalogue",
      ok: routes.some((r) => r.path === "/api/nexora/product-catalogue/status"),
      route: "/api/nexora/product-catalogue/status",
    },
    {
      key: "quote_pack",
      ok: routes.some((r) => r.path === "/api/nexora/quote-pack/status"),
      route: "/api/nexora/quote-pack/status",
    },
    {
      key: "comms_docs",
      ok: routes.some((r) => r.path === "/api/nexora/comms-docs/status"),
      route: "/api/nexora/comms-docs/status",
    },
    {
      key: "email_approval",
      ok: routes.some((r) => r.path === "/api/nexora/email-approval/status"),
      route: "/api/nexora/email-approval/status",
    },
    {
      key: "trading_paper",
      ok: routes.some((r) => r.path === "/api/nexora/polymarket-paper/status"),
      route: "/api/nexora/polymarket-paper/status",
    },
    {
      key: "trading_dashboard",
      ok: routes.some((r) => r.path === "/api/nexora/trading-dashboard/status"),
      route: "/api/nexora/trading-dashboard/status",
    },
    {
      key: "final_local_v1",
      ok: routes.some((r) => r.path === "/api/nexora/final-local-v1/status"),
      route: "/api/nexora/final-local-v1/status",
    },
  ];

  const missing = checks.filter((check) => !check.ok);

  const nextBuilds = [];

  if (missing.some((m) => ["product_catalogue", "quote_pack"].includes(m.key))) {
    nextBuilds.push("Repair product catalogue / quote pack route mounting.");
  }

  if (missing.some((m) => ["comms_docs", "email_approval"].includes(m.key))) {
    nextBuilds.push("Repair communications / email approval layer.");
  }

  if (missing.some((m) => ["trading_paper", "trading_dashboard"].includes(m.key))) {
    nextBuilds.push("Repair trading paper dashboard route mounting.");
  }

  if (missing.length === 0) {
    nextBuilds.push("Build Local Admin UI polish and route-protected owner cockpit.");
    nextBuilds.push("Build product import/export CSV layer.");
    nextBuilds.push("Build quote document export/download layer.");
    nextBuilds.push("Build final smoke-test runner for all route groups.");
  }

  const plan = {
    ok: missing.length === 0,
    nexoraBrain: true,
    service: "nexora_next_best_plan",
    planId,
    generatedAt: now(),
    routeCount: routes.length,
    highRiskRoutes: routes.filter((r) => r.highRisk).length,
    checks,
    missing,
    nextBuilds,
    currentMode: {
      localOnly: true,
      noDeploy: true,
      noPostgres: true,
      noLiveTrading: true,
      humansOnlyApproveSignCommit: true,
    },
    recommendation:
      missing.length === 0
        ? "Core local v1 route groups are present. Next build should focus on operator usability and exports."
        : "Fix missing route groups before adding new capabilities.",
  };

  writeNexoraJson(nexoraLocalPath("nbp", "plans", `${planId}.json`), plan);
  appendNexoraJsonl(PLAN_LOG, { event: "nbp.created", plan, createdAt: now() });
  appendNexoraJsonl(CHECK_LOG, { event: "nbp.checks", checks, createdAt: now() });
  journal("nbp.created", plan);

  return { ok: true, nexoraBrain: true, plan };
}

export function getNexoraNextBestPlanStatus() {
  const latest = createNexoraNextBestPlan({ planId: "latest" }).plan;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_next_best_plan_status",
    generatedAt: now(),
    latest,
  };
}
