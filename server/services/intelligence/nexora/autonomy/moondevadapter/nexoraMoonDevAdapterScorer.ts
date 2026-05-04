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

const JOURNAL = nexoraLocalPath("moondev-adapter", "journal", "adapter-journal.jsonl");
const SCORE_LOG = nexoraLocalPath("moondev-adapter", "scores", "adapter-score-log.jsonl");
const PLAN_LOG = nexoraLocalPath("moondev-adapter", "plans", "adapter-plan-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function read(file: string) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
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

function classify(file: string, source: string) {
  const text = `${file}\n${source}`.toLowerCase();
  return {
    baseAgent: /baseagent|base_agent|abstract|execute|run/.test(text),
    swarm: /swarm|consensus|vote|parallel|aggregate|multi.?agent|ensemble/.test(text),
    polymarket: /polymarket|clob|gamma|market|prediction/.test(text),
    risk: /risk|drawdown|exposure|kelly|limit|stop|throttle/.test(text),
    strategy: /strategy|signal|edge|alpha|mutation|backtest/.test(text),
    copy: /copy|whale|wallet|smart.?money|leader/.test(text),
    modelRouting: /openai|claude|openrouter|model|llm|anthropic/.test(text),
    backtest: /backtest|historical|simulation|paper/.test(text),
    danger: /private[_ -]?key|seed phrase|mnemonic|place_order|submit_order|sign_order|wallet|live trading|clob/i.test(source),
  };
}

function targetFor(file: string, c: any) {
  if (c.baseAgent) return "unifiedAgentRuntime/BaseNexoraAgent";
  if (c.swarm) return "swarmruntime/nexoraSwarmConsensusRuntime";
  if (c.polymarket) return "polymarket-superstack + marketdata + collectors";
  if (c.risk) return "riskgovernor + tradingexecution + live-money guard";
  if (c.strategy) return "strategyruntime + tradinglab + backtesting";
  if (c.copy) return "tradingmega whale/copy signals";
  if (c.modelRouting) return "agent runtime model-router scaffold";
  if (c.backtest) return "backtesting + MoonDev result parser";
  return "reference";
}

function scoreFile(file: string, c: any, source: string) {
  let score = 0;
  if (file.endsWith("base_agent.py")) score += 100;
  if (file.endsWith("swarm_agent.py")) score += 100;
  if (file.endsWith("polymarket_agent.py")) score += 100;
  if (file.endsWith("risk_agent.py")) score += 90;
  if (file.endsWith("strategy_agent.py")) score += 80;
  if (file.endsWith("trading_agent.py")) score += 80;
  if (file.endsWith("copybot_agent.py")) score += 70;
  if (file.endsWith("volume_agent.py")) score += 60;
  if (c.baseAgent) score += 30;
  if (c.swarm) score += 35;
  if (c.polymarket) score += 35;
  if (c.risk) score += 35;
  if (c.strategy) score += 25;
  if (c.copy) score += 20;
  if (c.modelRouting) score += 15;
  if (c.backtest) score += 15;
  if (c.danger) score -= 20;
  if (source.length > 20000) score -= 5;
  return Math.max(0, score);
}

export function scoreMoonDevSelectedForAdapters(input: any = {}) {
  const root = String(input.root || "research/moondev-selected");
  const scoreId = String(input.scoreId || nexoraLocalId("moondev_adapter_score"));

  const files = walk(root).filter((file) => /\.(py|md|txt|json)$/.test(file));

  const rows = files.map((file) => {
    const source = read(file);
    const c = classify(file, source);
    const symbols = file.endsWith(".py") ? extractSymbols(source) : null;
    const score = scoreFile(file, c, source);

    return {
      file,
      relative: path.relative(root, file),
      basename: path.basename(file),
      lines: source.split("\n").length,
      bytes: source.length,
      classification: c,
      symbols,
      score,
      nexoraTarget: targetFor(file, c),
      adoption:
        c.danger ? "adapt_with_quarantine_review" :
        score >= 120 ? "adapt_first" :
        score >= 70 ? "adapt_second" :
        score >= 30 ? "reference" :
        "ignore",
      directCopyAllowed: false,
    };
  }).sort((a, b) => b.score - a.score);

  const scorecard = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_adapter_scorecard",
    scoreId,
    generatedAt: now(),
    root,
    fileCount: rows.length,
    adaptFirst: rows.filter((r) => r.adoption === "adapt_first"),
    adaptSecond: rows.filter((r) => r.adoption === "adapt_second"),
    quarantineReview: rows.filter((r) => r.adoption === "adapt_with_quarantine_review"),
    rows,
    rules: {
      directCopy: false,
      directImport: false,
      directExecution: false,
      liveTrading: false,
      privateKeys: false,
      translateToNexoraTypeScript: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-adapter", "scores", `${scoreId}.json`), scorecard);
  appendNexoraJsonl(SCORE_LOG, { event: "moondev.adapter_scorecard", scorecard, createdAt: now() });
  journal("moondev.adapter_scorecard", { scoreId, fileCount: rows.length });

  recordNexoraMetric({
    name: "moondev_adapter_files_scored",
    value: rows.length,
    unit: "files",
    dimensions: {},
  });

  return { ok: true, nexoraBrain: true, scorecard };
}

export function createMoonDevAdapterBuildPlan(input: any = {}) {
  const scorecard = input.scorecard || scoreMoonDevSelectedForAdapters(input).scorecard;
  const planId = String(input.planId || nexoraLocalId("moondev_adapter_plan"));

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_adapter_build_plan",
    planId,
    createdAt: now(),
    sourceScoreId: scorecard.scoreId,
    buildOrder: [
      {
        order: 1,
        title: "BaseAgent Runtime Upgrade",
        source: scorecard.rows.filter((r: any) => r.relative.includes("base_agent.py")),
        target: "unifiedAgentRuntime/BaseNexoraAgent",
        action: "Compare interface, add missing lifecycle hooks if useful.",
      },
      {
        order: 2,
        title: "Swarm Consensus Upgrade",
        source: scorecard.rows.filter((r: any) => r.relative.includes("swarm_agent.py")),
        target: "swarmruntime",
        action: "Add timeouts, model vote weighting, fallback votes, and consensus logs.",
      },
      {
        order: 3,
        title: "Polymarket Parser Upgrade",
        source: scorecard.rows.filter((r: any) => r.relative.includes("polymarket_agent.py")),
        target: "polymarket-superstack",
        action: "Extract market parsing ideas into Nexora TypeScript collector adapters.",
      },
      {
        order: 4,
        title: "Risk Governor Upgrade",
        source: scorecard.rows.filter((r: any) => r.relative.includes("risk_agent.py")),
        target: "riskgovernor + tradingexecution",
        action: "Improve exposure caps, drawdown rules, and kill-switch policy.",
      },
      {
        order: 5,
        title: "Strategy Runtime Upgrade",
        source: scorecard.rows.filter((r: any) => r.relative.includes("strategy_agent.py")),
        target: "strategyruntime + tradinglab",
        action: "Improve mutation/scoring/tournament flow.",
      },
      {
        order: 6,
        title: "Copy/Whale Signal Upgrade",
        source: scorecard.rows.filter((r: any) => r.relative.includes("copybot_agent.py") || r.relative.includes("whale_agent.py")),
        target: "tradingmega",
        action: "Extract whale/copy paper-signal scoring concepts.",
      },
    ],
    safety: {
      noDirectExecution: true,
      noDirectImport: true,
      noPrivateKeys: true,
      noLiveTrading: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-adapter", "plans", `${planId}.json`), plan);
  appendNexoraJsonl(PLAN_LOG, { event: "moondev.adapter_plan", plan, createdAt: now() });
  journal("moondev.adapter_plan", plan);

  recordNexoraTimelineEvent({
    type: "moondev_adapter_plan",
    title: "MoonDev adapter build plan created",
    severity: "info",
    payload: { planId },
  });

  return { ok: true, nexoraBrain: true, plan };
}

export function getMoonDevAdapterStatus() {
  const scorecards = readNexoraJsonl(SCORE_LOG).filter((row: any) => row.event === "moondev.adapter_scorecard");
  const plans = readNexoraJsonl(PLAN_LOG).filter((row: any) => row.event === "moondev.adapter_plan");

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_adapter_status",
    generatedAt: now(),
    scorecards: scorecards.length,
    plans: plans.length,
    latestScorecard: scorecards.slice(-1)[0]?.scorecard || null,
    latestPlan: plans.slice(-1)[0]?.plan || null,
  };
}
