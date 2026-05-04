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

const JOURNAL = nexoraLocalPath("moondev-phase1", "journal", "phase1-journal.jsonl");
const ADAPTER_LOG = nexoraLocalPath("moondev-phase1", "adapters", "adapter-log.jsonl");
const PLAN_LOG = nexoraLocalPath("moondev-phase1", "plans", "plan-log.jsonl");
const STUB_LOG = nexoraLocalPath("moondev-phase1", "stubs", "stub-log.jsonl");
const REPORT_LOG = nexoraLocalPath("moondev-phase1", "reports", "report-log.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function selectedRoot(input: any = {}) {
  const root = String(input.root || "research/moondev-selected");
  return fs.existsSync(root) ? root : "research/moondev";
}

function readFileSafe(file: string) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function fileOrNull(root: string, rel: string) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? file : null;
}

function extractPythonSymbols(source: string) {
  return {
    classes: [...source.matchAll(/^class\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]),
    functions: [...source.matchAll(/^def\s+([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]),
    asyncFunctions: [...source.matchAll(/^async\s+def\s+([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]),
    imports: [...source.matchAll(/^(?:from\s+([A-Za-z0-9_./]+)\s+import|import\s+([A-Za-z0-9_./]+))/gm)]
      .map((m) => m[1] || m[2])
      .filter(Boolean),
  };
}

function summarizeSource(root: string, rel: string) {
  const file = fileOrNull(root, rel);
  if (!file) {
    return {
      exists: false,
      relative: rel,
      lines: 0,
      symbols: null,
      snippets: [],
    };
  }

  const source = readFileSafe(file);
  const lines = source.split("\n");

  const snippets = [
    ...lines.filter((line) => /class |def |async def |consensus|risk|strategy|polymarket|order|wallet|private/i.test(line)).slice(0, 40),
  ];

  return {
    exists: true,
    file,
    relative: rel,
    lines: lines.length,
    symbols: extractPythonSymbols(source),
    snippets,
    danger: /private[_ -]?key|seed phrase|mnemonic|place_order|submit_order|sign_order|wallet|live trading|clob/i.test(source),
  };
}

export function createMoonDevBaseAgentAdapterPlan(input: any = {}) {
  const root = selectedRoot(input);
  const source = summarizeSource(root, "src/agents/base_agent.py");
  const planId = String(input.planId || nexoraLocalId("base_adapter_plan"));

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_base_agent_adapter_plan",
    planId,
    createdAt: now(),
    source,
    target: "unifiedAgentRuntime/agents/BaseNexoraAgent.ts",
    adapterIdeas: [
      "Compare MoonDev base lifecycle with BaseNexoraAgent.",
      "Ensure every Nexora agent supports heartbeat, memory, task context, emit/log helpers.",
      "Add timeout and retry metadata at task-envelope level.",
      "Add standard result shape: completed, failed, approval_required, skipped.",
      "Do not import Python base agent directly.",
    ],
    nexoraActions: [
      "Keep current BaseNexoraAgent.",
      "Add optional timeout/retry wrappers in a later build if MoonDev base has stronger hooks.",
      "Use MoonDev as interface reference only.",
    ],
    safety: {
      directImport: false,
      directExecution: false,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-phase1", "adapters", `${planId}.base-agent.json`), plan);
  appendNexoraJsonl(ADAPTER_LOG, { event: "adapter.base_agent", plan, createdAt: now() });
  journal("adapter.base_agent", plan);

  return { ok: true, nexoraBrain: true, plan };
}

export function createMoonDevSwarmAdapterPlan(input: any = {}) {
  const root = selectedRoot(input);
  const source = summarizeSource(root, "src/agents/swarm_agent.py");
  const planId = String(input.planId || nexoraLocalId("swarm_adapter_plan"));

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_swarm_adapter_plan",
    planId,
    createdAt: now(),
    source,
    target: "swarmruntime/nexoraSwarmConsensusRuntime.ts",
    adapterIdeas: [
      "Use multiple roles: bull, bear, risk, execution, research, critic.",
      "Add vote timeout support.",
      "Add failed agent vote handling.",
      "Add weighted consensus.",
      "Keep risk veto as final authority.",
      "Persist every vote and consensus result.",
    ],
    nexoraActions: [
      "Current Nexora swarm already has weighted votes and risk veto.",
      "Next improvement: add per-agent timeoutMs and fallback vote.",
      "Next improvement: add model/source confidence scoring.",
      "Next improvement: add route to compare MoonDev swarm symbols to Nexora swarm roles.",
    ],
    safety: {
      noLiveTrading: true,
      noPrivateKeys: true,
      directImport: false,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-phase1", "swarm", `${planId}.json`), plan);
  appendNexoraJsonl(ADAPTER_LOG, { event: "adapter.swarm", plan, createdAt: now() });
  journal("adapter.swarm", plan);

  return { ok: true, nexoraBrain: true, plan };
}

export function createMoonDevRiskAdapterPlan(input: any = {}) {
  const root = selectedRoot(input);
  const source = summarizeSource(root, "src/agents/risk_agent.py");
  const planId = String(input.planId || nexoraLocalId("risk_adapter_plan"));

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_risk_adapter_plan",
    planId,
    createdAt: now(),
    source,
    target: "riskgovernor + tradingexecution + live-money",
    adapterIdeas: [
      "Exposure caps.",
      "Drawdown stops.",
      "Per-trade limits.",
      "Daily loss limits.",
      "Kill switch enforcement.",
      "API/latency/fill mismatch stops.",
      "No live execution without owner commit.",
    ],
    nexoraActions: [
      "Map any useful MoonDev risk checks into Nexora trading execution safety.",
      "Never copy wallet/private key logic.",
      "Never enable live execution from this adapter.",
      "Add stronger kill-switch test runner later.",
    ],
    safety: {
      noLiveTrading: true,
      noPrivateKeys: true,
      riskVetoRequired: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-phase1", "risk", `${planId}.json`), plan);
  appendNexoraJsonl(ADAPTER_LOG, { event: "adapter.risk", plan, createdAt: now() });
  journal("adapter.risk", plan);

  return { ok: true, nexoraBrain: true, plan };
}

export function createMoonDevStrategyAdapterPlan(input: any = {}) {
  const root = selectedRoot(input);
  const strategySource = summarizeSource(root, "src/agents/strategy_agent.py");
  const volumeSource = summarizeSource(root, "src/agents/volume_agent.py");
  const planId = String(input.planId || nexoraLocalId("strategy_adapter_plan"));

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_strategy_adapter_plan_v1",
    planId,
    createdAt: now(),
    sources: {
      strategyAgent: strategySource,
      volumeAgent: volumeSource,
    },
    target: "strategyruntime + tradinglab + backtesting",
    adapterIdeas: [
      "Strategy plugin records.",
      "Strategy mutation and scoring.",
      "Backtest-first promotion.",
      "Disable bad performers.",
      "Volume/volatility feature signals.",
      "Paper tournament ranking.",
    ],
    nexoraActions: [
      "Current Nexora has strategy runtime and trading lab.",
      "Next improvement: parse MoonDev strategy/backtest files into structured strategy candidates.",
      "Next improvement: run Nexora synthetic backtests over top imported candidates.",
      "Next improvement: auto-disable candidates with bad paper evidence.",
    ],
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      directImport: false,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-phase1", "strategy", `${planId}.json`), plan);
  appendNexoraJsonl(ADAPTER_LOG, { event: "adapter.strategy", plan, createdAt: now() });
  journal("adapter.strategy", plan);

  return { ok: true, nexoraBrain: true, plan };
}

export function createMoonDevPolymarketAdapterPlan(input: any = {}) {
  const root = selectedRoot(input);
  const polySource = summarizeSource(root, "src/agents/polymarket_agent.py");
  const webSearchSource = summarizeSource(root, "src/agents/polymarket_websearch_agent.py");
  const planId = String(input.planId || nexoraLocalId("polymarket_adapter_plan"));

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_polymarket_adapter_plan",
    planId,
    createdAt: now(),
    sources: {
      polymarketAgent: polySource,
      websearchAgent: webSearchSource,
    },
    target: "polymarket-superstack + marketdata + collectors",
    adapterIdeas: [
      "Market discovery.",
      "Market parsing.",
      "Question context enrichment.",
      "Paper signal generation.",
      "CLOB snapshot normalization.",
      "No live order placement.",
    ],
    nexoraActions: [
      "Current Nexora has Polymarket collector/superstack.",
      "Next improvement: build market discovery adapter using safe API fetch only.",
      "Next improvement: add Gamma/CLOB parser output schema.",
      "Next improvement: add market context memory records.",
    ],
    safety: {
      noOrders: true,
      noWalletSigning: true,
      noPrivateKeys: true,
      directImport: false,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-phase1", "polymarket", `${planId}.json`), plan);
  appendNexoraJsonl(ADAPTER_LOG, { event: "adapter.polymarket", plan, createdAt: now() });
  journal("adapter.polymarket", plan);

  return { ok: true, nexoraBrain: true, plan };
}

export function createMoonDevCopyWhaleAdapterPlan(input: any = {}) {
  const root = selectedRoot(input);
  const copySource = summarizeSource(root, "src/agents/copybot_agent.py");
  const whaleSource = summarizeSource(root, "src/agents/whale_agent.py");
  const planId = String(input.planId || nexoraLocalId("copy_whale_adapter_plan"));

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_copy_whale_adapter_plan",
    planId,
    createdAt: now(),
    sources: {
      copybotAgent: copySource,
      whaleAgent: whaleSource,
    },
    target: "tradingmega + paper copy signal ranking",
    adapterIdeas: [
      "Whale wallet observations.",
      "Copy-signal scoring.",
      "Consensus across whales.",
      "Paper-only copy tracking.",
      "Delayed fill/slippage simulation.",
    ],
    nexoraActions: [
      "Keep copy trading paper-only.",
      "Add smart wallet allowlist schema later.",
      "Add copy signal confidence decay later.",
    ],
    safety: {
      noLiveCopyTrading: true,
      noWalletSigning: true,
      directImport: false,
    },
  };

  writeNexoraJson(nexoraLocalPath("moondev-phase1", "plans", `${planId}.copy-whale.json`), plan);
  appendNexoraJsonl(ADAPTER_LOG, { event: "adapter.copy_whale", plan, createdAt: now() });
  journal("adapter.copy_whale", plan);

  return { ok: true, nexoraBrain: true, plan };
}

export function createMoonDevPhase1MasterPlan(input: any = {}) {
  const masterPlanId = String(input.masterPlanId || nexoraLocalId("moondev_phase1_master"));

  const plans = {
    base: createMoonDevBaseAgentAdapterPlan({ root: input.root }).plan,
    swarm: createMoonDevSwarmAdapterPlan({ root: input.root }).plan,
    risk: createMoonDevRiskAdapterPlan({ root: input.root }).plan,
    strategy: createMoonDevStrategyAdapterPlan({ root: input.root }).plan,
    polymarket: createMoonDevPolymarketAdapterPlan({ root: input.root }).plan,
    copyWhale: createMoonDevCopyWhaleAdapterPlan({ root: input.root }).plan,
  };

  const master = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_phase1_master_plan",
    masterPlanId,
    createdAt: now(),
    plans,
    buildOrder: [
      "MoonDev market discovery adapter",
      "MoonDev swarm timeout/fallback upgrade",
      "MoonDev risk governor upgrade",
      "MoonDev strategy/backtest parser",
      "MoonDev paper copy/whale scoring",
      "MoonDev base agent lifecycle comparison",
    ],
    hardRules: [
      "Keep Nexora as operating system.",
      "Use MoonDev as architecture/reference.",
      "Do not execute MoonDev directly.",
      "Do not import Python runtime.",
      "No private keys.",
      "No live trading.",
    ],
  };

  writeNexoraJson(nexoraLocalPath("moondev-phase1", "reports", `${masterPlanId}.json`), master);
  appendNexoraJsonl(PLAN_LOG, { event: "phase1.master_plan", master, createdAt: now() });
  journal("phase1.master_plan", master);

  recordNexoraTimelineEvent({
    type: "moondev_phase1",
    title: "MoonDev Phase 1 adapter master plan created",
    severity: "info",
    payload: { masterPlanId },
  });

  return { ok: true, nexoraBrain: true, master };
}

export function getMoonDevPhase1AdapterStatus() {
  const adapters = readNexoraJsonl(ADAPTER_LOG);
  const plans = readNexoraJsonl(PLAN_LOG);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_phase1_adapter_status",
    generatedAt: now(),
    counts: {
      adapters: adapters.length,
      masterPlans: plans.length,
    },
    latestMasterPlan: plans.slice(-1)[0]?.master || null,
    safety: {
      directImport: false,
      directExecution: false,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };
}
