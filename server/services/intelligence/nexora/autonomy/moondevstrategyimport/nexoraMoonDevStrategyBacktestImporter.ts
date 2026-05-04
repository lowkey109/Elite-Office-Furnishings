import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { recordNexoraTimelineEvent } from "../timeline/nexoraTimeline";
import { recordNexoraMetric } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const JOURNAL = nexoraLocalPath("moondev-strategy-import", "journal", "journal.jsonl");
const STRATEGY_LOG = nexoraLocalPath("moondev-strategy-import", "strategies", "strategy-log.jsonl");
const BACKTEST_LOG = nexoraLocalPath("moondev-strategy-import", "backtests", "backtest-log.jsonl");
const RANKING_LOG = nexoraLocalPath("moondev-strategy-import", "rankings", "ranking-log.jsonl");
const IMPORT_LOG = nexoraLocalPath("moondev-strategy-import", "imports", "import-log.jsonl");
const ADAPTER_LOG = nexoraLocalPath("moondev-strategy-import", "adapters", "adapter-log.jsonl");
const REPORT_LOG = nexoraLocalPath("moondev-strategy-import", "reports", "report-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function safeRead(file: string) {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function safeJson(file: string) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if ([".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".cache"].includes(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }

  return out;
}

function rootFromInput(input: any = {}) {
  const preferred = String(input.root || "");
  if (preferred && fs.existsSync(preferred)) return preferred;
  if (fs.existsSync("research/moondev-selected")) return "research/moondev-selected";
  return "research/moondev";
}

function extractStrategyName(file: string, source: string) {
  const base = path.basename(file).replace(/\.(py|txt|md|json)$/i, "");
  const classMatch = source.match(/class\s+([A-Za-z0-9_]+)/);
  if (classMatch) return classMatch[1];
  const titleMatch = source.match(/^#\s+(.+)$/m);
  if (titleMatch) return titleMatch[1].trim().replace(/[^a-zA-Z0-9_ -]+/g, "");
  return base;
}

function classifyStrategy(file: string, source: string) {
  const text = `${file}\n${source}`.toLowerCase();

  return {
    volatility: /volatility|vol|squeeze|bandwidth|atr/i.test(text),
    momentum: /momentum|trend|breakout|surge|adx|macd/i.test(text),
    meanReversion: /reversion|reversal|fade|contrarian|oversold|overbought/i.test(text),
    liquidity: /liquidation|liquidity|order.?book|depth/i.test(text),
    fibonacci: /fib|fibonacci|gann/i.test(text),
    stochastic: /stochastic|rsi|oscillator|williams/i.test(text),
    vwap: /vwap|volume weighted/i.test(text),
    polymarket: /polymarket|prediction|clob|binary/i.test(text),
    backtest: /backtest|btfinal|bt\.py|strategy_bt|execution_results/i.test(text),
    danger:
      /private[_ -]?key|seed phrase|mnemonic|place_order|submit_order|sign_order|wallet|live trading|clob order/i.test(text),
  };
}

function extractMetricsFromText(source: string) {
  const pctMatches = [...source.matchAll(/(-?\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  const moneyMatches = [...source.matchAll(/\$(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  const sharpeMatch = source.match(/sharpe[^0-9-]*(-?\d+(?:\.\d+)?)/i);
  const drawdownMatch = source.match(/drawdown[^0-9-]*(-?\d+(?:\.\d+)?)/i);
  const winRateMatch = source.match(/win.?rate[^0-9-]*(-?\d+(?:\.\d+)?)/i);

  return {
    percentValues: pctMatches.slice(0, 20),
    moneyValues: moneyMatches.slice(0, 20),
    bestPercent: pctMatches.length ? Math.max(...pctMatches) : null,
    worstPercent: pctMatches.length ? Math.min(...pctMatches) : null,
    sharpe: sharpeMatch ? Number(sharpeMatch[1]) : null,
    drawdown: drawdownMatch ? Number(drawdownMatch[1]) : null,
    winRate: winRateMatch ? Number(winRateMatch[1]) : null,
  };
}

function extractMetricsFromJson(json: any) {
  if (!json || typeof json !== "object") return null;
  const text = JSON.stringify(json);
  const raw = extractMetricsFromText(text);

  const candidates = [
    json.total_return,
    json.totalReturn,
    json.total_return_pct,
    json.totalReturnPct,
    json.return_pct,
    json.pnl,
    json.total_pnl,
    json.profit,
    json.final_return,
    json.performance,
  ].map(Number).filter(Number.isFinite);

  return {
    ...raw,
    explicitValues: candidates,
    bestExplicit: candidates.length ? Math.max(...candidates) : null,
  };
}

function scoreImportedStrategy(classification: any, metrics: any, source: string) {
  let score = 0;

  if (classification.polymarket) score += 30;
  if (classification.volatility) score += 20;
  if (classification.momentum) score += 15;
  if (classification.meanReversion) score += 15;
  if (classification.liquidity) score += 15;
  if (classification.backtest) score += 10;
  if (classification.danger) score -= 30;

  const best = metrics?.bestPercent ?? metrics?.bestExplicit ?? null;
  const drawdown = metrics?.drawdown ?? null;
  const winRate = metrics?.winRate ?? null;

  if (typeof best === "number") {
    if (best > 100) score += 30;
    else if (best > 10) score += 20;
    else if (best > 1) score += 10;
    else if (best < 0) score -= 10;
  }

  if (typeof drawdown === "number") {
    if (Math.abs(drawdown) > 50) score -= 20;
    else if (Math.abs(drawdown) > 20) score -= 10;
  }

  if (typeof winRate === "number") {
    if (winRate > 60) score += 10;
    else if (winRate < 45) score -= 10;
  }

  if (source.length > 30000) score -= 5;

  return Math.max(0, Math.round(score));
}

export function importMoonDevStrategies(input: any = {}) {
  const root = rootFromInput(input);
  const importId = String(input.importId || nexoraLocalId("moondev_strategy_import"));
  const limit = Number(input.limit || 5000);

  const files = walk(root)
    .filter((file) => /\.(py|txt|md)$/i.test(file))
    .filter((file) =>
      /strategy|backtest|_BT|BTFinal|agent|polymarket|risk|swarm|copybot|volume/i.test(file)
    )
    .slice(0, limit);

  const strategies = files.map((file) => {
    const source = safeRead(file);
    const classification = classifyStrategy(file, source);
    const metrics = extractMetricsFromText(source);
    const strategyId = nexoraLocalId("moondev_strategy");
    const name = extractStrategyName(file, source);
    const score = scoreImportedStrategy(classification, metrics, source);

    return {
      ok: true,
      nexoraBrain: true,
      service: "nexora_moondev_imported_strategy",
      strategyId,
      name,
      sourceFile: file,
      relativePath: path.relative(root, file),
      root,
      importedAt: now(),
      lines: source.split("\n").length,
      bytes: source.length,
      classification,
      metrics,
      score,
      directUseAllowed: false,
      paperOnly: true,
      nexoraAction:
        classification.danger ? "quarantine_review" :
        score >= 60 ? "adapt_priority" :
        score >= 30 ? "adapt_later" :
        "reference_only",
    };
  }).sort((a, b) => b.score - a.score);

  for (const strategy of strategies) {
    writeNexoraJson(
      nexoraLocalPath("moondev-strategy-import", "strategies", `${strategy.strategyId}.json`),
      strategy,
    );
    appendNexoraJsonl(STRATEGY_LOG, { event: "strategy.imported", strategy, createdAt: now() });
  }

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_strategy_import",
    importId,
    root,
    importedAt: now(),
    count: strategies.length,
    top: strategies.slice(0, 50),
    safety: {
      directUseAllowed: false,
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-strategy-import", "imports", `${importId}.json`), result);
  appendNexoraJsonl(IMPORT_LOG, { event: "strategies.imported", result, createdAt: now() });
  journal("strategies.imported", { importId, count: strategies.length });

  recordNexoraMetric({
    name: "moondev_strategies_imported",
    value: strategies.length,
    unit: "strategies",
    dimensions: { root },
  });

  return { ok: true, nexoraBrain: true, result };
}

export function importMoonDevBacktestResults(input: any = {}) {
  const root = rootFromInput(input);
  const importId = String(input.importId || nexoraLocalId("moondev_backtest_import"));
  const limit = Number(input.limit || 5000);

  const files = walk(root)
    .filter((file) => /\.(json|txt|md|csv)$/i.test(file))
    .filter((file) => /execution_results|backtest|results|stats|performance|summary/i.test(file))
    .slice(0, limit);

  const results = files.map((file) => {
    const source = safeRead(file);
    const json = file.endsWith(".json") ? safeJson(file) : null;
    const metrics = json ? extractMetricsFromJson(json) : extractMetricsFromText(source);
    const classification = classifyStrategy(file, source);

    const resultId = nexoraLocalId("moondev_bt_result");
    const metricsAny = metrics as any;
    const best = metricsAny?.bestExplicit ?? metricsAny?.bestPercent ?? 0;

    return {
      ok: true,
      nexoraBrain: true,
      service: "nexora_moondev_backtest_result",
      resultId,
      sourceFile: file,
      relativePath: path.relative(root, file),
      importedAt: now(),
      metrics,
      classification,
      score: scoreImportedStrategy(classification, metrics, source),
      bestValue: best,
      directUseAllowed: false,
      paperOnly: true,
    };
  }).sort((a, b) => b.score - a.score);

  for (const result of results) {
    writeNexoraJson(
      nexoraLocalPath("moondev-strategy-import", "backtests", `${result.resultId}.json`),
      result,
    );
    appendNexoraJsonl(BACKTEST_LOG, { event: "backtest.imported", result, createdAt: now() });
  }

  const summary = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_backtest_import",
    importId,
    root,
    importedAt: now(),
    count: results.length,
    top: results.slice(0, 50),
    safety: {
      directUseAllowed: false,
      paperOnly: true,
      noLiveTrading: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-strategy-import", "imports", `${importId}.backtests.json`), summary);
  appendNexoraJsonl(IMPORT_LOG, { event: "backtests.imported", summary, createdAt: now() });
  journal("backtests.imported", { importId, count: results.length });

  return { ok: true, nexoraBrain: true, summary };
}

export function rankMoonDevImportedStrategies(input: any = {}) {
  const rankingId = String(input.rankingId || nexoraLocalId("moondev_strategy_ranking"));
  const limit = Number(input.limit || 100);

  const strategies = readNexoraJsonl(STRATEGY_LOG)
    .filter((row: any) => row.event === "strategy.imported")
    .map((row: any) => row.strategy);

  const backtests = readNexoraJsonl(BACKTEST_LOG)
    .filter((row: any) => row.event === "backtest.imported")
    .map((row: any) => row.result);

  const ranked = strategies.map((strategy: any) => {
    const related = backtests
      .filter((result: any) => {
        const a = String(result.relativePath || "").toLowerCase();
        const b = String(strategy.name || "").toLowerCase();
        return a.includes(b.toLowerCase()) || b.includes(path.basename(a).replace(/\.(json|txt|md|csv)$/i, "").toLowerCase());
      })
      .slice(0, 10);

    const relatedBoost = related.reduce((sum: number, r: any) => sum + Number(r.score || 0), 0) / Math.max(1, related.length || 1);

    const finalScore = Math.round(Number(strategy.score || 0) + relatedBoost * 0.4);

    return {
      strategyId: strategy.strategyId,
      name: strategy.name,
      sourceFile: strategy.relativePath,
      classification: strategy.classification,
      baseScore: strategy.score,
      relatedBacktests: related.length,
      finalScore,
      action:
        strategy.classification?.danger ? "quarantine_review" :
        finalScore >= 80 ? "adapt_first" :
        finalScore >= 50 ? "adapt_second" :
        finalScore >= 25 ? "reference" :
        "ignore",
      nexoraTarget:
        strategy.classification?.polymarket ? "polymarket-superstack" :
        strategy.classification?.risk ? "risk-governor" :
        strategy.classification?.strategy ? "strategy-runtime" :
        strategy.classification?.backtest ? "backtesting" :
        "research",
    };
  }).sort((a, b) => b.finalScore - a.finalScore);

  const ranking = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_strategy_ranking",
    rankingId,
    generatedAt: now(),
    count: ranked.length,
    top: ranked.slice(0, limit),
    safety: {
      directUseAllowed: false,
      paperOnly: true,
      noLiveTrading: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-strategy-import", "rankings", `${rankingId}.json`), ranking);
  appendNexoraJsonl(RANKING_LOG, { event: "strategies.ranked", ranking, createdAt: now() });
  journal("strategies.ranked", { rankingId, count: ranked.length });

  recordNexoraTimelineEvent({
    type: "moondev_strategy_ranking",
    title: "MoonDev imported strategies ranked for Nexora adaptation",
    severity: "info",
    payload: { rankingId, count: ranked.length },
  });

  return { ok: true, nexoraBrain: true, ranking };
}

export function createMoonDevStrategyAdapterPlan(input: any = {}) {
  const planId = String(input.planId || nexoraLocalId("moondev_strategy_adapter_plan"));
  const ranking = input.ranking || rankMoonDevImportedStrategies({ limit: 50 }).ranking;

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_strategy_adapter_plan",
    planId,
    createdAt: now(),
    sourceRankingId: ranking.rankingId,
    phases: [
      {
        phase: 1,
        title: "Adapt top non-dangerous Polymarket/research concepts",
        targets: ranking.top.filter((row: any) => row.action === "adapt_first").slice(0, 10),
      },
      {
        phase: 2,
        title: "Convert strategy names and parameters into Nexora strategy runtime records",
        targets: ranking.top.filter((row: any) => row.action === "adapt_first" || row.action === "adapt_second").slice(0, 25),
      },
      {
        phase: 3,
        title: "Backtest selected ideas using Nexora paper simulator",
        targets: ranking.top.filter((row: any) => row.nexoraTarget === "backtesting" || row.nexoraTarget === "strategy-runtime").slice(0, 25),
      },
      {
        phase: 4,
        title: "Quarantine dangerous execution/key logic",
        targets: ranking.top.filter((row: any) => row.action === "quarantine_review"),
      },
    ],
    hardRules: [
      "Do not execute MoonDev code directly.",
      "Do not import Python runtime into Nexora.",
      "Do not use private keys.",
      "Do not live trade.",
      "Translate to Nexora TypeScript only.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("moondev-strategy-import", "adapters", `${planId}.json`), plan);
  appendNexoraJsonl(ADAPTER_LOG, { event: "adapter.plan", plan, createdAt: now() });
  journal("adapter.plan", plan);

  return { ok: true, nexoraBrain: true, plan };
}

export function createMoonDevStrategyImportReport(input: any = {}) {
  const reportId = String(input.reportId || nexoraLocalId("moondev_strategy_report"));
  const strategies = readNexoraJsonl(STRATEGY_LOG).filter((row: any) => row.event === "strategy.imported");
  const backtests = readNexoraJsonl(BACKTEST_LOG).filter((row: any) => row.event === "backtest.imported");
  const rankings = readNexoraJsonl(RANKING_LOG).filter((row: any) => row.event === "strategies.ranked");
  const plans = readNexoraJsonl(ADAPTER_LOG).filter((row: any) => row.event === "adapter.plan");

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_strategy_import_report",
    reportId,
    generatedAt: now(),
    counts: {
      strategies: strategies.length,
      backtests: backtests.length,
      rankings: rankings.length,
      plans: plans.length,
    },
    latestRanking: rankings.slice(-1)[0]?.ranking || null,
    latestPlan: plans.slice(-1)[0]?.plan || null,
    safety: {
      directExecution: false,
      directImport: false,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-strategy-import", "reports", `${reportId}.json`), report);
  appendNexoraJsonl(REPORT_LOG, { event: "report.created", report, createdAt: now() });
  journal("report.created", report);

  return { ok: true, nexoraBrain: true, report };
}

export function getMoonDevStrategyImportStatus() {
  const report = createMoonDevStrategyImportReport({ reportId: "latest" }).report;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_strategy_import_status",
    generatedAt: now(),
    report,
  };
}
