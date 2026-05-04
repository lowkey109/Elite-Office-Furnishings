import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
  readNexoraJsonl,
} from "../localcore/nexoraLocalCore";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("research-bridge", "journal", "research-bridge-journal.jsonl");
const AUDIT_LOG = nexoraLocalPath("research-bridge", "audits", "research-audit-log.jsonl");
const TODO_LOG = nexoraLocalPath("research-bridge", "todos", "research-todo-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if ([".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"].includes(name)) continue;

    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walk(full, out);
    else if (/\.(py|ts|js|md|json|yaml|yml)$/.test(name)) out.push(full);
  }

  return out;
}

function extractPythonSymbols(source: string) {
  return {
    classes: [...source.matchAll(/^class\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]),
    functions: [...source.matchAll(/^def\s+([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]),
    asyncFunctions: [...source.matchAll(/^async\s+def\s+([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]),
  };
}

function classifyFile(file: string, source: string) {
  const text = `${file}\n${source}`.toLowerCase();

  return {
    polymarket: text.includes("polymarket"),
    websocket: text.includes("websocket") || text.includes("ws"),
    swarm: text.includes("swarm") || text.includes("consensus") || text.includes("multi-agent") || text.includes("multi_agent"),
    risk: text.includes("risk") || text.includes("drawdown") || text.includes("exposure") || text.includes("kelly"),
    strategy: text.includes("strategy") || text.includes("signal") || text.includes("edge"),
    copy: text.includes("copy") || text.includes("whale"),
    execution: text.includes("execute") || text.includes("order") || text.includes("trade") || text.includes("position"),
    privateKeyDanger: text.includes("private_key") || text.includes("private key") || text.includes("seed phrase"),
    liveTradingDanger: text.includes("live trading") || text.includes("place_order") || text.includes("submit_order"),
  };
}

export function auditNexoraResearchRepo(input: any = {}) {
  const root = String(input.root || "research/moondev");
  const auditId = String(input.auditId || nexoraLocalId("research_audit"));

  const importantNames = [
    "swarm_agent.py",
    "polymarket_agent.py",
    "polymarket_websearch_agent.py",
    "trading_agent.py",
    "strategy_agent.py",
    "risk_agent.py",
    "copybot_agent.py",
    "volume_agent.py",
    "base_agent.py",
  ];

  const files = walk(root);

  const rows = files.map((file) => {
    const source = fs.readFileSync(file, "utf8");
    const basename = path.basename(file);

    return {
      file,
      relative: path.relative(root, file),
      basename,
      important: importantNames.includes(basename),
      size: fs.statSync(file).size,
      lines: source.split("\n").length,
      symbols: file.endsWith(".py") ? extractPythonSymbols(source) : null,
      classification: classifyFile(file, source),
    };
  });

  const dangerous = rows.filter((row) => row.classification.privateKeyDanger || row.classification.liveTradingDanger);
  const important = rows.filter((row) => row.important);

  const audit = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_safe_research_bridge",
    auditId,
    root,
    createdAt: now(),
    fileCount: rows.length,
    importantFiles: important,
    dangerousFiles: dangerous,
    rows,
    extractionRules: {
      directImport: false,
      directExecution: false,
      copyPrivateKeyLogic: false,
      liveTradingBlocked: true,
      useAsArchitectureReferenceOnly: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("research-bridge", "audits", `${auditId}.json`), audit);
  appendNexoraJsonl(AUDIT_LOG, { event: "research.audit", audit, createdAt: now() });
  journal("research.audit", { auditId, fileCount: rows.length, important: important.length, dangerous: dangerous.length });

  recordNexoraTimelineEvent({
    type: "research_bridge",
    title: "Nexora research repo audited safely",
    severity: dangerous.length ? "warning" : "info",
    payload: { auditId, fileCount: rows.length, dangerous: dangerous.length },
  });

  recordNexoraMetric({
    name: "research_repo_files_audited",
    value: rows.length,
    unit: "files",
    dimensions: { root },
  });

  return { ok: true, nexoraBrain: true, audit };
}

export function createNexoraResearchTodoPlan(input: any = {}) {
  const audit = input.audit || auditNexoraResearchRepo(input).audit;
  const todoId = String(input.todoId || nexoraLocalId("research_todo"));

  const todo = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_research_todo_plan",
    todoId,
    createdAt: now(),
    sourceAuditId: audit.auditId,
    tasks: [
      {
        task: "Study swarm consensus architecture",
        sourceFiles: audit.importantFiles.filter((f: any) => f.basename.includes("swarm")).map((f: any) => f.relative),
        nexoraTarget: "swarmruntime",
      },
      {
        task: "Study Polymarket market parsing",
        sourceFiles: audit.importantFiles.filter((f: any) => f.basename.includes("polymarket")).map((f: any) => f.relative),
        nexoraTarget: "polymarket paper engine",
      },
      {
        task: "Study risk governor patterns",
        sourceFiles: audit.rows.filter((f: any) => f.classification.risk).slice(0, 20).map((f: any) => f.relative),
        nexoraTarget: "risk governor",
      },
      {
        task: "Study strategy agent patterns",
        sourceFiles: audit.rows.filter((f: any) => f.classification.strategy).slice(0, 20).map((f: any) => f.relative),
        nexoraTarget: "strategy runtime",
      },
      {
        task: "Quarantine dangerous live/private-key logic",
        sourceFiles: audit.dangerousFiles.map((f: any) => f.relative),
        nexoraTarget: "blocked from direct import",
      },
    ],
    rules: [
      "Do not run cloned repo live.",
      "Do not import wallet/private key logic.",
      "Do not copy live execution code blindly.",
      "Translate architecture into Nexora-native TypeScript modules only.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("research-bridge", "todos", `${todoId}.json`), todo);
  appendNexoraJsonl(TODO_LOG, { event: "research.todo", todo, createdAt: now() });
  journal("research.todo", todo);

  return { ok: true, nexoraBrain: true, todo };
}

export function getNexoraResearchBridgeStatus() {
  const audits = readNexoraJsonl(AUDIT_LOG).filter((row: any) => row.event === "research.audit");
  const todos = readNexoraJsonl(TODO_LOG).filter((row: any) => row.event === "research.todo");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_research_bridge_status",
    audits: audits.length,
    todos: todos.length,
    directExecutionBlocked: true,
    liveTradingBlocked: true,
    privateKeysBlocked: true,
  };
}
