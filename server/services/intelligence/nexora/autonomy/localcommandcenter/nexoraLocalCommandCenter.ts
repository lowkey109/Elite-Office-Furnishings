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
import { getNexoraMetrics } from "../warehouse/nexoraLocalWarehouse";
import { getNexoraTimeline } from "../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("local-command-center", "journal", "command-center-journal.jsonl");
const SNAPSHOT_DIR = nexoraLocalPath("local-command-center", "snapshots");
const REPORT_DIR = nexoraLocalPath("local-command-center", "reports");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function safeReadJsonl(file: string) {
  try {
    return readNexoraJsonl(file);
  } catch {
    return [];
  }
}

function countEvents(file: string, event?: string) {
  const rows = safeReadJsonl(file);
  return event ? rows.filter((row: any) => row.event === event).length : rows.length;
}

function latest(file: string, limit = 10) {
  return safeReadJsonl(file).slice(-limit).reverse();
}

function routeInventory() {
  const routeFiles = walk("server/services/intelligence/nexora/autonomy/routes");
  const routes: any[] = [];

  for (const file of routeFiles) {
    const source = fs.readFileSync(file, "utf8");
    const re = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;

    let match;
    while ((match = re.exec(source))) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file,
        highRisk: /approve|sign|commit|purge|delete|replay|restore|migration|execute|burst|live|private|key/i.test(match[2]),
      });
    }
  }

  return routes.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
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

export function getNexoraLocalCommandCenterSnapshot(input: any = {}) {
  const snapshotId = String(input.snapshotId || nexoraLocalId("command_snapshot"));
  const routes = routeInventory();

  const snapshot = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_command_center_snapshot",
    snapshotId,
    generatedAt: now(),
    mode: "local_only_no_postgres_no_deploy",
    routeSummary: {
      total: routes.length,
      highRisk: routes.filter((route) => route.highRisk).length,
      safe: routes.filter((route) => !route.highRisk).length,
    },
    company: {
      officeAgents: {
        journalEvents: countEvents(nexoraLocalPath("office-agents", "journal", "office-agent-journal.jsonl")),
      },
      humanBoundary: {
        approvals: countEvents(nexoraLocalPath("human-boundary", "approvals", "approval-log.jsonl")),
        signatures: countEvents(nexoraLocalPath("human-boundary", "signatures", "signature-log.jsonl")),
        commitments: countEvents(nexoraLocalPath("human-boundary", "commitments", "commitment-log.jsonl")),
      },
      teaching: {
        skills: countEvents(nexoraLocalPath("teaching", "skills", "skill-log.jsonl"), "skill.created"),
        gaps: countEvents(nexoraLocalPath("teaching", "gaps", "gap-log.jsonl"), "gap.created"),
        lessons: countEvents(nexoraLocalPath("teaching", "lessons", "lesson-log.jsonl"), "lesson.created"),
      },
      rewards: {
        rewards: countEvents(nexoraLocalPath("rewards", "ledger", "reward-ledger.jsonl"), "reward.created"),
        praise: countEvents(nexoraLocalPath("rewards", "praise", "praise-log.jsonl"), "praise.created"),
        patterns: countEvents(nexoraLocalPath("rewards", "patterns", "success-pattern-log.jsonl"), "success_pattern.created"),
      },
      products: {
        products: countEvents(nexoraLocalPath("product-catalogue", "products", "product-log.jsonl"), "product.upserted"),
        supplierCosts: countEvents(nexoraLocalPath("product-catalogue", "suppliers", "supplier-cost-log.jsonl"), "supplier_cost.upserted"),
        bundles: countEvents(nexoraLocalPath("product-catalogue", "bundles", "bundle-log.jsonl"), "bundle.created"),
      },
      quotePacks: {
        quotePacks: countEvents(nexoraLocalPath("quote-packs", "packs", "quote-pack-log.jsonl"), "quote_pack.created"),
        customerDrafts: countEvents(nexoraLocalPath("quote-packs", "customer-drafts", "customer-draft-log.jsonl"), "customer_draft.created"),
        approvals: countEvents(nexoraLocalPath("quote-packs", "approvals", "quote-approval-log.jsonl")),
      },
      trading: {
        marketDataSignals: countEvents(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), "paper_signal.created"),
        backtestRuns: countEvents(nexoraLocalPath("backtesting", "runs", "run-log.jsonl"), "backtest.run"),
        tradingMegaExecutions: countEvents(nexoraLocalPath("trading-mega", "paper-execution", "paper-execution-log.jsonl")),
        tradingLabSignals: countEvents(nexoraLocalPath("trading-lab", "signals", "signal-log.jsonl")),
      },
      loops: {
        activeLoopTicks: countEvents(nexoraLocalPath("active-loop", "runs", "runs.jsonl"), "active_loop.tick"),
        loopCoverageEvents: countEvents(nexoraLocalPath("loop-coverage", "journal", "loop-coverage-journal.jsonl")),
      },
      runtime: {
        agentTasks: countEvents(nexoraLocalPath("unified-agent-runtime", "tasks", "task-log.jsonl"), "task.created"),
        agentEvents: countEvents(nexoraLocalPath("unified-agent-runtime", "events", "runtime-events.jsonl")),
        swarmConsensus: countEvents(nexoraLocalPath("swarm-runtime", "consensus", "swarm-consensus.jsonl"), "swarm.consensus.created"),
      },
    },
    recent: {
      timeline: getNexoraTimeline({ limit: 20 }),
      metrics: getNexoraMetrics({ limit: 20 }),
      rewards: latest(nexoraLocalPath("rewards", "ledger", "reward-ledger.jsonl"), 10),
      approvals: latest(nexoraLocalPath("human-boundary", "approvals", "approval-log.jsonl"), 10),
      quotePacks: latest(nexoraLocalPath("quote-packs", "packs", "quote-pack-log.jsonl"), 10),
      tradingSignals: latest(nexoraLocalPath("market-data", "signals", "paper-signal-log.jsonl"), 10),
    },
    ownerDoctrine: {
      humanOnly: ["approve", "sign", "commit"],
      nexoraDoesEverythingElse: true,
      noExceptions: true,
    },
    safety: {
      noDeploy: true,
      noPostgres: true,
      noLiveTrading: true,
      noPrivateKeys: true,
      noSupplierPurchaseOrderWithoutHumanCommit: true,
      noBindingQuoteWithoutHumanCommit: true,
    },
  };

  writeNexoraJson(path.join(SNAPSHOT_DIR, `${snapshotId}.json`), snapshot);
  journal("command_center.snapshot", snapshot);

  return {
    ok: true,
    nexoraBrain: true,
    snapshot,
  };
}

export function getNexoraLocalCommandCenterStatus() {
  const snapshot = getNexoraLocalCommandCenterSnapshot({ snapshotId: "latest" }).snapshot;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_command_center",
    generatedAt: now(),
    summary: {
      routes: snapshot.routeSummary,
      company: snapshot.company,
    },
    nextActions: [
      "Use /api/nexora/office-agents/lead/intake to create a test lead.",
      "Use /api/nexora/product-catalogue/seed to seed products.",
      "Use /api/nexora/quote-pack/create to create a quote pack.",
      "Use /api/nexora/active-loop/status to confirm local loop is running.",
      "Keep Postgres/Railway deploy paused until storage is upgraded.",
    ],
  };
}

export function createNexoraLocalCommandCenterReport(input: any = {}) {
  const reportId = String(input.reportId || nexoraLocalId("command_report"));
  const snapshot = getNexoraLocalCommandCenterSnapshot({ snapshotId: `${reportId}_snapshot` }).snapshot;

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_command_center_report",
    reportId,
    createdAt: now(),
    title: "Nexora Local AI Company Command Center Report",
    sections: [
      {
        title: "Owner Rule",
        body: "Humans only approve, sign, and commit. Nexora and her workers do everything else.",
      },
      {
        title: "Operating Mode",
        body: "Local-only. No Postgres. No Railway deploy. No live trading.",
      },
      {
        title: "Route Summary",
        body: `Total Nexora routes: ${snapshot.routeSummary.total}. High-risk routes: ${snapshot.routeSummary.highRisk}.`,
      },
      {
        title: "Company Summary",
        body: JSON.stringify(snapshot.company, null, 2),
      },
      {
        title: "Next Actions",
        body: [
          "Seed products.",
          "Create quote pack.",
          "Create human approval packet.",
          "Run active loop tick.",
          "Run final local audit before deployment.",
        ].join("\n"),
      },
    ],
    snapshot,
  };

  writeNexoraJson(path.join(REPORT_DIR, `${reportId}.json`), report);
  journal("command_center.report", report);

  return {
    ok: true,
    nexoraBrain: true,
    report,
  };
}
