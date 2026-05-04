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
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("moondev-systems", "journal", "moondev-systems-journal.jsonl");
const REPORT_LOG = nexoraLocalPath("moondev-systems", "reports", "reports-log.jsonl");
const STRATEGY_LOG = nexoraLocalPath("moondev-systems", "strategy-library", "strategy-library-log.jsonl");
const BACKTEST_LOG = nexoraLocalPath("moondev-systems", "backtest-intel", "backtest-intel-log.jsonl");
const FEATURE_LOG = nexoraLocalPath("moondev-systems", "feature-map", "feature-map-log.jsonl");
const ROADMAP_LOG = nexoraLocalPath("moondev-systems", "adapter-roadmap", "adapter-roadmap-log.jsonl");
const GAP_LOG = nexoraLocalPath("moondev-systems", "gap-analysis", "gap-analysis-log.jsonl");
const SCORE_LOG = nexoraLocalPath("moondev-systems", "system-score", "system-score-log.jsonl");
const OPERATOR_LOG = nexoraLocalPath("moondev-systems", "operator-packs", "operator-pack-log.jsonl");
const PHASE_LOG = nexoraLocalPath("moondev-systems", "phase-plan", "phase-plan-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, {
    event,
    payload,
    createdAt: now(),
  });
}

function safeRead(file: string) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function safeJson(file: string) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if ([
      ".git",
      "node_modules",
      "__pycache__",
      ".pytest_cache",
      ".mypy_cache",
      ".venv",
      "venv",
      "dist",
      "build",
      ".cache"
    ].includes(name)) continue;

    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }

  return out;
}

function rootFromInput(input: any = {}) {
  const requested = String(input.root || "");
  if (requested && fs.existsSync(requested)) return requested;
  if (fs.existsSync("research/moondev-selected")) return "research/moondev-selected";
  if (fs.existsSync("research/moondev")) return "research/moondev";
  return "research/moondev-selected";
}

function classifySource(file: string, source: string) {
  const text = `${file}\n${source}`.toLowerCase();

  return {
    agent: /agent|class\s+[a-z0-9_]*agent/i.test(text),
    baseAgent: /baseagent|base_agent|abstract|execute|heartbeat|task/i.test(text),
    swarm: /swarm|consensus|vote|parallel|ensemble|aggregate|multi.?agent/i.test(text),
    polymarket: /polymarket|clob|gamma|prediction market|binary/i.test(text),
    binance: /binance|btcusdt|ethusdt|ticker|websocket|wss/i.test(text),
    risk: /risk|drawdown|exposure|kelly|stop.?loss|limit|throttle|position.?size/i.test(text),
    strategy: /strategy|signal|edge|alpha|momentum|arbitrage|market.?making|mutation/i.test(text),
    volume: /volume|volumetric|liquidity|order.?book|depth/i.test(text),
    copy: /copy|copybot|whale|wallet|smart.?money|leader/i.test(text),
    backtest: /backtest|btfinal|simulation|historical|replay|pnl|performance|sharpe/i.test(text),
    model: /openai|claude|openrouter|anthropic|model|llm|gpt|gemini/i.test(text),
    memory: /memory|vector|chroma|journal|cache|store/i.test(text),
    execution: /execute|order|trade|position|fill|submit|cancel|place_order|sign_order/i.test(text),
    danger: /private[_\s-]?key|seed phrase|mnemonic|wallet_secret|api_secret|secret_key|place_order|submit_order|sign_order|wallet\.sign|live trading|real order/i.test(text),
  };
}

function extractSymbols(source: string) {
  return {
    classes: [...source.matchAll(/^class\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]),
    functions: [...source.matchAll(/^def\s+([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]),
    asyncFunctions: [...source.matchAll(/^async\s+def\s+([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]),
    imports: [...source.matchAll(/^(?:from\s+([A-Za-z0-9_./]+)\s+import|import\s+([A-Za-z0-9_./]+))/gm)]
      .map((m) => m[1] || m[2])
      .filter(Boolean),
  };
}

function extractMetricsFromText(source: string) {
  const pctValues = [...source.matchAll(/(-?\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  const explicit = [
    ...source.matchAll(/(?:pnl|profit|return|total_return|totalReturn|score|sharpe|drawdown|win.?rate)[^0-9-]*(-?\d+(?:\.\d+)?)/gi),
  ].map((m) => Number(m[1]));

  return {
    percentValues: pctValues.slice(0, 50),
    explicitValues: explicit.slice(0, 50),
    bestPercent: pctValues.length ? Math.max(...pctValues) : null,
    worstPercent: pctValues.length ? Math.min(...pctValues) : null,
    bestExplicit: explicit.length ? Math.max(...explicit) : null,
    worstExplicit: explicit.length ? Math.min(...explicit) : null,
  };
}

function extractMetricsFromJson(json: any) {
  if (!json || typeof json !== "object") return null;

  const text = JSON.stringify(json);
  const textMetrics = extractMetricsFromText(text);
  const values: number[] = [];

  function scan(value: any) {
    if (typeof value === "number" && Number.isFinite(value)) values.push(value);
    if (value && typeof value === "object") {
      for (const v of Object.values(value)) scan(v);
    }
  }

  scan(json);

  return {
    ...textMetrics,
    numericValues: values.slice(0, 200),
    bestNumeric: values.length ? Math.max(...values) : null,
    worstNumeric: values.length ? Math.min(...values) : null,
  };
}

function scoreRow(file: string, classification: any, metrics: any, source: string) {
  let score = 0;

  const base = path.basename(file).toLowerCase();

  if (base === "base_agent.py") score += 120;
  if (base === "swarm_agent.py") score += 130;
  if (base === "polymarket_agent.py") score += 130;
  if (base === "polymarket_websearch_agent.py") score += 90;
  if (base === "risk_agent.py") score += 120;
  if (base === "strategy_agent.py") score += 110;
  if (base === "trading_agent.py") score += 100;
  if (base === "copybot_agent.py") score += 90;
  if (base === "volume_agent.py") score += 80;
  if (base === "backtest_runner.py") score += 80;

  if (classification.swarm) score += 35;
  if (classification.polymarket) score += 35;
  if (classification.risk) score += 35;
  if (classification.strategy) score += 30;
  if (classification.backtest) score += 25;
  if (classification.volume) score += 20;
  if (classification.copy) score += 20;
  if (classification.model) score += 15;
  if (classification.memory) score += 15;
  if (classification.execution) score += 10;

  const best = metrics?.bestPercent ?? metrics?.bestExplicit ?? metrics?.bestNumeric ?? null;
  if (typeof best === "number") {
    if (best >= 100) score += 35;
    else if (best >= 10) score += 25;
    else if (best >= 1) score += 15;
    else if (best > 0) score += 8;
  }

  if (classification.danger) score -= 40;
  if (source.length > 50000) score -= 10;

  return Math.max(0, Math.round(score));
}

function targetFor(classification: any) {
  const targets: string[] = [];

  if (classification.baseAgent || classification.agent) targets.push("unifiedAgentRuntime");
  if (classification.swarm) targets.push("moondev-swarm / swarmruntime");
  if (classification.polymarket) targets.push("polymarket-superstack");
  if (classification.risk) targets.push("risk-governor / trading-execution");
  if (classification.strategy) targets.push("strategy-runtime / trading-lab");
  if (classification.backtest) targets.push("backtesting / strategy-import");
  if (classification.volume) targets.push("market-data features");
  if (classification.copy) targets.push("copy-whale paper signals");
  if (classification.model) targets.push("model routing");
  if (classification.memory) targets.push("memory layer");

  return [...new Set(targets)];
}

export function createMoonDevSystemInventory(input: any = {}) {
  const root = rootFromInput(input);
  const inventoryId = String(input.inventoryId || nexoraLocalId("moondev_system_inventory"));
  const limit = Number(input.limit || 12000);

  const files = walk(root)
    .filter((file) => /\.(py|md|txt|json|csv)$/i.test(file))
    .slice(0, limit);

  const rows = files.map((file) => {
    const source = safeRead(file);
    const json = file.endsWith(".json") ? safeJson(file) : null;
    const classification = classifySource(file, source);
    const metrics = json ? extractMetricsFromJson(json) : extractMetricsFromText(source);
    const score = scoreRow(file, classification, metrics, source);

    return {
      file,
      relative: path.relative(root, file),
      basename: path.basename(file),
      extension: path.extname(file),
      lines: source ? source.split("\n").length : 0,
      bytes: source.length,
      symbols: file.endsWith(".py") ? extractSymbols(source) : null,
      classification,
      metrics,
      score,
      targets: targetFor(classification),
      action:
        classification.danger ? "quarantine_review" :
        score >= 120 ? "adapt_now" :
        score >= 70 ? "adapt_later" :
        score >= 30 ? "reference" :
        "ignore",
      directImport: false,
      directExecution: false,
    };
  }).sort((a, b) => b.score - a.score);

  const inventory = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_system_inventory",
    inventoryId,
    root,
    generatedAt: now(),
    counts: {
      files: rows.length,
      adaptNow: rows.filter((r) => r.action === "adapt_now").length,
      adaptLater: rows.filter((r) => r.action === "adapt_later").length,
      reference: rows.filter((r) => r.action === "reference").length,
      quarantine: rows.filter((r) => r.action === "quarantine_review").length,
    },
    rows,
    top: rows.slice(0, 100),
    safety: {
      noDirectImport: true,
      noDirectExecution: true,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-systems", "reports", `${inventoryId}.json`), inventory);
  appendNexoraJsonl(REPORT_LOG, { event: "systems.inventory", inventory, createdAt: now() });
  journal("systems.inventory", { inventoryId, counts: inventory.counts });

  return { ok: true, nexoraBrain: true, inventory };
}

export function createMoonDevSystemGapAnalysis(input: any = {}) {
  const inventory = input.inventory || createMoonDevSystemInventory(input).inventory;
  const gapId = String(input.gapId || nexoraLocalId("moondev_gap_analysis"));

  const requiredTargets = [
    "unifiedAgentRuntime",
    "moondev-swarm / swarmruntime",
    "polymarket-superstack",
    "risk-governor / trading-execution",
    "strategy-runtime / trading-lab",
    "backtesting / strategy-import",
    "market-data features",
    "copy-whale paper signals",
    "model routing",
    "memory layer",
  ];

  const presentTargets = new Set<string>();
  for (const row of inventory.rows || []) {
    for (const target of row.targets || []) presentTargets.add(target);
  }

  const gaps = requiredTargets.map((target) => {
    const relevant = (inventory.rows || []).filter((row: any) => (row.targets || []).includes(target));
    const top = relevant.slice(0, 10);
    return {
      target,
      sourceAvailable: relevant.length > 0,
      sourceCount: relevant.length,
      top,
      nexoraStatus:
        target.includes("swarm") ? "partially_built" :
        target.includes("polymarket") ? "partially_built" :
        target.includes("risk") ? "partially_built" :
        target.includes("strategy") ? "partially_built" :
        target.includes("backtesting") ? "partially_built" :
        "needs_review",
      nextAction:
        relevant.length
          ? "adapt_best_patterns_into_existing_nexora_module"
          : "no_moondev_source_found",
    };
  });

  const analysis = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_system_gap_analysis",
    gapId,
    generatedAt: now(),
    sourceInventoryId: inventory.inventoryId,
    gaps,
    priorityOrder: gaps
      .filter((gap: any) => gap.sourceAvailable)
      .sort((a: any, b: any) => b.sourceCount - a.sourceCount)
      .slice(0, 10),
    rule: "Keep Nexora. Upgrade only where MoonDev source is stronger. No direct execution.",
  };

  writeNexoraJson(nexoraLocalPath("moondev-systems", "gap-analysis", `${gapId}.json`), analysis);
  appendNexoraJsonl(GAP_LOG, { event: "systems.gap_analysis", analysis, createdAt: now() });
  journal("systems.gap_analysis", { gapId });

  return { ok: true, nexoraBrain: true, analysis };
}

export function createMoonDevSystemScore(input: any = {}) {
  const inventory = input.inventory || createMoonDevSystemInventory(input).inventory;
  const scoreId = String(input.scoreId || nexoraLocalId("moondev_system_score"));

  const rows = inventory.rows || [];
  const top = rows.slice(0, 50);

  const score = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_system_score",
    scoreId,
    generatedAt: now(),
    overall: Math.min(100, Math.round(
      (inventory.counts.adaptNow * 4) +
      (inventory.counts.adaptLater * 1.5) +
      (inventory.counts.reference * 0.25)
    )),
    counts: inventory.counts,
    bestFiles: top,
    recommendation:
      inventory.counts.adaptNow > 0
        ? "Start adapting top adapt_now files into Nexora-native TypeScript modules."
        : "Use MoonDev mostly as reference.",
  };

  writeNexoraJson(nexoraLocalPath("moondev-systems", "system-score", `${scoreId}.json`), score);
  appendNexoraJsonl(SCORE_LOG, { event: "systems.score", score, createdAt: now() });
  journal("systems.score", { scoreId, overall: score.overall });

  recordNexoraMetric({
    name: "moondev_system_score",
    value: score.overall,
    unit: "score",
    dimensions: {},
  });

  return { ok: true, nexoraBrain: true, score };
}

export function createMoonDevSystemPhasePlan(input: any = {}) {
  const inventory = input.inventory || createMoonDevSystemInventory(input).inventory;
  const gaps = createMoonDevSystemGapAnalysis({ inventory }).analysis;
  const score = createMoonDevSystemScore({ inventory }).score;
  const phasePlanId = String(input.phasePlanId || nexoraLocalId("moondev_phase_plan"));

  const phasePlan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_system_phase_plan",
    phasePlanId,
    generatedAt: now(),
    sourceInventoryId: inventory.inventoryId,
    systemScoreId: score.scoreId,
    phases: [
      {
        phase: 1,
        name: "Swarm upgrade",
        target: "moondev-swarm / swarmruntime",
        status: "next",
        tasks: [
          "Add stronger fallback vote model.",
          "Add consensus comparison against MoonDev swarm source.",
          "Add confidence memory.",
        ],
      },
      {
        phase: 2,
        name: "Polymarket parser upgrade",
        target: "polymarket-superstack",
        status: "planned",
        tasks: [
          "Extract market parsing patterns.",
          "Normalize Gamma/CLOB market metadata.",
          "Improve paper edge scan input schema.",
        ],
      },
      {
        phase: 3,
        name: "Risk upgrade",
        target: "risk-governor / trading-execution",
        status: "planned",
        tasks: [
          "Extract drawdown/exposure rules.",
          "Enhance kill switch test runner.",
          "Improve readiness failure reporting.",
        ],
      },
      {
        phase: 4,
        name: "Strategy/backtest upgrade",
        target: "strategy-runtime / trading-lab",
        status: "planned",
        tasks: [
          "Parse top MoonDev backtest result metrics.",
          "Create Nexora paper strategy candidates.",
          "Run Nexora backtest tournament.",
        ],
      },
      {
        phase: 5,
        name: "Copy/whale upgrade",
        target: "copy-whale paper signals",
        status: "planned",
        tasks: [
          "Extract whale/copy signal concepts.",
          "Build paper-only whale signal confidence scoring.",
          "Never live copy trade.",
        ],
      },
    ],
    gaps,
    score,
    hardRules: [
      "No direct Python execution.",
      "No direct import.",
      "No private keys.",
      "No live trading.",
      "Translate to Nexora-native TypeScript.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("moondev-systems", "phase-plan", `${phasePlanId}.json`), phasePlan);
  appendNexoraJsonl(PHASE_LOG, { event: "systems.phase_plan", phasePlan, createdAt: now() });
  journal("systems.phase_plan", { phasePlanId });

  recordNexoraTimelineEvent({
    type: "moondev_phase_plan",
    title: "MoonDev systems phase plan created",
    severity: "info",
    payload: { phasePlanId, overallScore: score.overall },
  });

  return { ok: true, nexoraBrain: true, phasePlan };
}

export function getMoonDevSystemsStatus() {
  const reports = readNexoraJsonl(REPORT_LOG).filter((row: any) => row.event === "systems.inventory");
  const gaps = readNexoraJsonl(GAP_LOG).filter((row: any) => row.event === "systems.gap_analysis");
  const scores = readNexoraJsonl(SCORE_LOG).filter((row: any) => row.event === "systems.score");
  const phases = readNexoraJsonl(PHASE_LOG).filter((row: any) => row.event === "systems.phase_plan");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_systems_status",
    generatedAt: now(),
    counts: {
      inventories: reports.length,
      gapAnalyses: gaps.length,
      scores: scores.length,
      phasePlans: phases.length,
    },
    latest: {
      inventory: reports.slice(-1)[0]?.inventory || null,
      score: scores.slice(-1)[0]?.score || null,
      phasePlan: phases.slice(-1)[0]?.phasePlan || null,
    },
    safety: {
      noDirectExecution: true,
      noDirectImport: true,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };
}
