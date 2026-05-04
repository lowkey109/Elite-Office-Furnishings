import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { getNexoraMetrics } from "../warehouse/nexoraLocalWarehouse";
import { getNexoraTimeline } from "../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("final-v1", "journal", "final-v1-journal.jsonl");
const RELEASE_LOG = nexoraLocalPath("final-v1", "release-packs", "release-pack-log.jsonl");
const CHECK_LOG = nexoraLocalPath("final-v1", "checks", "final-check-log.jsonl");

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

function safeReadJsonl(file: string) {
  try {
    return readNexoraJsonl(file);
  } catch {
    return [];
  }
}

function count(file: string, event?: string) {
  const rows = safeReadJsonl(file);
  return event ? rows.filter((row: any) => row.event === event).length : rows.length;
}

function routeInventory() {
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
        highRisk: /approve|sign|commit|purge|delete|replay|restore|migration|execute|burst|live|private|key|wallet|payment|refund/i.test(routePath),
      });
    }
  }

  return routes.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

function moduleInventory() {
  const files = walk("server/services/intelligence/nexora");

  return files.map((file) => {
    const source = fs.readFileSync(file, "utf8");
    const exports = [...source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1]);

    return {
      file,
      lines: source.split("\n").length,
      exports,
      hasNexoraBrain: source.includes("nexoraBrain"),
      hasSafety: /safety|approval|risk|human|commit|sign|approve/i.test(source),
    };
  });
}

export function runNexoraFinalLocalV1Checks() {
  const routes = routeInventory();
  const modules = moduleInventory();

  const checks = [
    {
      key: "office_agents",
      ok: routes.some((r) => r.path === "/api/nexora/office-agents/status"),
      required: "/api/nexora/office-agents/status",
    },
    {
      key: "human_boundary",
      ok: routes.some((r) => r.path === "/api/nexora/human-boundary/status"),
      required: "/api/nexora/human-boundary/status",
    },
    {
      key: "teaching",
      ok: routes.some((r) => r.path === "/api/nexora/teaching/status"),
      required: "/api/nexora/teaching/status",
    },
    {
      key: "rewards",
      ok: routes.some((r) => r.path === "/api/nexora/rewards/status"),
      required: "/api/nexora/rewards/status",
    },
    {
      key: "active_loop",
      ok: routes.some((r) => r.path === "/api/nexora/active-loop/status"),
      required: "/api/nexora/active-loop/status",
    },
    {
      key: "loop_coverage",
      ok: routes.some((r) => r.path === "/api/nexora/loop-coverage/status"),
      required: "/api/nexora/loop-coverage/status",
    },
    {
      key: "local_executor",
      ok: routes.some((r) => r.path === "/api/nexora/local-executor/status"),
      required: "/api/nexora/local-executor/status",
    },
    {
      key: "product_catalogue",
      ok: routes.some((r) => r.path === "/api/nexora/product-catalogue/status"),
      required: "/api/nexora/product-catalogue/status",
    },
    {
      key: "quote_pack",
      ok: routes.some((r) => r.path === "/api/nexora/quote-pack/status"),
      required: "/api/nexora/quote-pack/status",
    },
    {
      key: "polymarket_paper",
      ok: routes.some((r) => r.path === "/api/nexora/polymarket-paper/status"),
      required: "/api/nexora/polymarket-paper/status",
    },
    {
      key: "trading_dashboard",
      ok: routes.some((r) => r.path === "/api/nexora/trading-dashboard/status"),
      required: "/api/nexora/trading-dashboard/status",
    },
    {
      key: "local_command_center",
      ok: routes.some((r) => r.path === "/api/nexora/local-command-center/status"),
      required: "/api/nexora/local-command-center/status",
    },
  ];

  const passed = checks.filter((check) => check.ok).length;
  const score = Math.round((passed / checks.length) * 100);

  const result = {
    ok: passed === checks.length,
    nexoraBrain: true,
    service: "nexora_final_local_v1_checks",
    generatedAt: now(),
    score,
    passed,
    total: checks.length,
    checks,
    routeCount: routes.length,
    highRiskRoutes: routes.filter((route) => route.highRisk).length,
    moduleCount: modules.length,
    safety: {
      localOnly: true,
      noDeploy: true,
      noPostgres: true,
      noLiveTrading: true,
      humansOnlyApproveSignCommit: true,
    },
  };

  appendNexoraJsonl(CHECK_LOG, { event: "final_v1.checks", result, createdAt: now() });
  journal("final_v1.checks", result);

  return result;
}

export function createNexoraFinalLocalV1ReleasePack(input: any = {}) {
  const releaseId = String(input.releaseId || nexoraLocalId("local_v1_release"));
  const checks = runNexoraFinalLocalV1Checks();
  const routes = routeInventory();
  const modules = moduleInventory();

  const pack = {
    ok: checks.ok,
    nexoraBrain: true,
    service: "nexora_final_local_v1_release_pack",
    releaseId,
    createdAt: now(),
    version: String(input.version || "local-v1"),
    mode: "local_only",
    readinessScore: checks.score,
    checks,
    routes: {
      total: routes.length,
      highRisk: routes.filter((route) => route.highRisk).length,
      sample: routes.slice(0, 100),
    },
    modules: {
      total: modules.length,
      sample: modules.slice(0, 100),
    },
    operatingDoctrine: {
      nexoraOnlyBrain: true,
      humansOnly: ["approve", "sign", "commit"],
      nexoraDoesEverythingElse: true,
      noExceptions: true,
    },
    companyCapabilities: [
      "office furniture agents",
      "quote drafting",
      "supplier request drafting",
      "CRM/follow-up drafting",
      "fitout/project scoping",
      "human approval/sign/commit boundary",
      "teaching and knowledge gap system",
      "reward and reinforcement system",
      "local active loop",
      "safe loop coverage",
      "local action executor",
      "product catalogue",
      "quote packs",
      "communications and document drafts",
      "paper-only trading intelligence",
      "swarm consensus",
      "backtesting",
      "trading dashboard",
      "local command center",
    ],
    blockedUntilLater: [
      "Railway deploy",
      "Postgres replay",
      "live trading",
      "private keys",
      "autonomous email send",
      "supplier purchase orders",
      "binding customer quotes",
    ],
    metrics: getNexoraMetrics({ limit: 50 }),
    timeline: getNexoraTimeline({ limit: 50 }),
  };

  writeNexoraJson(nexoraLocalPath("final-v1", "release-packs", `${releaseId}.json`), pack);
  appendNexoraJsonl(RELEASE_LOG, { event: "final_v1.release_pack", pack, createdAt: now() });
  journal("final_v1.release_pack", pack);

  return { ok: true, nexoraBrain: true, pack };
}

export function getNexoraFinalLocalV1Status() {
  const latest = runNexoraFinalLocalV1Checks();
  const packs = safeReadJsonl(RELEASE_LOG).filter((row: any) => row.event === "final_v1.release_pack");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_final_local_v1_status",
    generatedAt: now(),
    readinessScore: latest.score,
    checksPassed: latest.passed,
    checksTotal: latest.total,
    releasePacks: packs.length,
    deployAllowed: false,
    postgresRequired: false,
    recommendation:
      latest.ok
        ? "Local v1 is ready for operator use. Do not deploy until Postgres storage is upgraded."
        : "Local v1 needs missing route/capability fixes before operator use.",
  };
}
