import type { Express } from "express";
import fs from "fs";
import path from "path";

type R = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "moondev-full-harvest");
const STATE = path.join(ROOT, "state.json");
const SOURCE_ROOT = path.join(process.cwd(), "research", "moondev-selected");

function now() {
  return new Date().toISOString();
}

function ensure() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safety() {
  return {
    directPythonExecution: false,
    directPythonImport: false,
    liveTradingEnabled: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    autonomousMoneyMovement: false,
    humanApprovalRequired: true,
    externalSignerRequiredForReal: true,
  };
}

function exists(file: string) {
  return fs.existsSync(path.join(SOURCE_ROOT, file));
}

function source(file: string) {
  const full = path.join(SOURCE_ROOT, file);
  if (!fs.existsSync(full)) return { exists: false, file };
  const text = fs.readFileSync(full, "utf8");
  return {
    exists: true,
    file,
    lines: text.split("\n").length,
    chars: text.length,
    preview: text.slice(0, 400),
  };
}

function buildHarvest() {
  ensure();

  const harvest = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_full_safe_harvest",
    generatedAt: now(),
    sourceRoot: "research/moondev-selected",
    categories: {
      strategyIdeas: {
        status: "harvested",
        sourceFiles: [
          source("src/agents/strategy_agent.py"),
          source("src/strategies/base_strategy.py"),
          source("src/strategies/example_strategy.py"),
          source("docs/strategy_agent.md"),
          source("docs/backtest_dashboard.md")
        ],
        nexoraTargets: [
          "strategy runtime",
          "paper replay",
          "strategy tournament",
          "PnL timeline",
          "final readiness scoring"
        ],
        translatedPatterns: [
          "strategy candidate records",
          "strategy scoring",
          "paper-only tournament",
          "bad strategy quarantine",
          "promotion only after evidence"
        ]
      },
      agentPatterns: {
        status: "harvested",
        sourceFiles: [
          source("src/agents/base_agent.py"),
          source("src/agents/trading_agent.py"),
          source("src/agents/example_unified_agent.py"),
          source("docs/trading_agent.md")
        ],
        nexoraTargets: [
          "unified agent runtime",
          "BaseNexoraAgent",
          "operator control",
          "task/result memory"
        ],
        translatedPatterns: [
          "standard agent lifecycle",
          "heartbeat/result shape",
          "task context",
          "approval-required output",
          "safe failure handling"
        ]
      },
      swarmThinking: {
        status: "harvested",
        sourceFiles: [
          source("src/agents/swarm_agent.py"),
          source("docs/swarm_agent.md")
        ],
        nexoraTargets: [
          "swarm consensus runtime",
          "risk veto",
          "operator summary"
        ],
        translatedPatterns: [
          "multi-role voting",
          "bull/bear/risk/research/critic roles",
          "weighted confidence",
          "consensus summary",
          "risk veto final authority"
        ]
      },
      riskAgentConcepts: {
        status: "harvested",
        sourceFiles: [
          source("src/agents/risk_agent.py"),
          source("docs/risk_agent.md")
        ],
        nexoraTargets: [
          "risk governor",
          "trading readiness",
          "kill-switch evidence",
          "live-money gate"
        ],
        translatedPatterns: [
          "drawdown guard",
          "losing streak guard",
          "exposure guard",
          "daily risk cap",
          "human review on breach",
          "no auto live execution"
        ]
      },
      polymarketResearchPatterns: {
        status: "harvested",
        sourceFiles: [
          source("src/agents/polymarket_agent.py"),
          source("src/agents/polymarket_websearch_agent.py"),
          source("docs/polymarket_agent.md"),
          source("docs/polymarket_agents.md")
        ],
        nexoraTargets: [
          "Polymarket superstack",
          "market discovery",
          "CLOB/orderbook parser",
          "trade-intent draft",
          "paper practice loop"
        ],
        translatedPatterns: [
          "market scanning",
          "question/context enrichment",
          "consensus market ranking",
          "paper-only market watch",
          "no wallet/order execution copied"
        ]
      },
      copyWhaleIdeas: {
        status: "harvested",
        sourceFiles: [
          source("src/agents/copybot_agent.py"),
          source("src/agents/whale_agent.py"),
          source("docs/copybot_agent.md"),
          source("docs/volume_agent.md")
        ],
        nexoraTargets: [
          "copy/whale paper signal scoring",
          "smart wallet watchlist later",
          "paper-only copy simulator",
          "risk-gated signal queue"
        ],
        translatedPatterns: [
          "whale activity observation",
          "copy signal confidence",
          "signal decay",
          "paper-only copy simulation",
          "human approval before real action"
        ]
      },
      marketScanningPatterns: {
        status: "harvested",
        sourceFiles: [
          source("src/agents/volume_agent.py"),
          source("src/agents/research_agent.py"),
          source("docs/websearch_agent.md"),
          source("docs/volume_agent.md")
        ],
        nexoraTargets: [
          "market scanner",
          "opportunity queue",
          "moving charts",
          "paper replay",
          "learning memory"
        ],
        translatedPatterns: [
          "volume spike scanning",
          "liquidity watch",
          "market quality score",
          "opportunity shortlist",
          "operator review before promotion"
        ]
      }
    },
    integratedIntoNexora: [
      "/api/nexora/moondev-strategy-import/status",
      "/api/nexora/moondev-phase1/status",
      "/api/nexora/poly-builds/bash1/status",
      "/api/nexora/poly-builds/bash2/status",
      "/api/nexora/poly-builds/final/latest",
      "/api/nexora/paper-practice/status",
      "/api/nexora/poly-charts/latest"
    ],
    nextBuilds: [
      "copy/whale paper simulator",
      "market scanner opportunity queue",
      "moving chart frontend panels",
      "learning-memory feedback loop",
      "operator approval UI"
    ],
    hardRules: [
      "Do not execute MoonDev Python directly.",
      "Do not import MoonDev Python runtime.",
      "Do not copy wallet/private-key logic.",
      "Do not enable live trading from harvest.",
      "Translate safe patterns into Nexora TypeScript only."
    ],
    safety: safety()
  };

  fs.writeFileSync(STATE, JSON.stringify(harvest, null, 2));
  return harvest;
}

function readState() {
  ensure();
  try {
    if (fs.existsSync(STATE)) return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {}
  return buildHarvest();
}

export function registerNexoraMoonDevFullHarvestRoutes(app: Express): void {
  app.get("/api/nexora/moondev-full/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_moondev_full_status",
      generatedAt: now(),
      sourceRootExists: fs.existsSync(SOURCE_ROOT),
      harvested: fs.existsSync(STATE),
      safety: safety()
    });
  });

  app.post("/api/nexora/moondev-full/harvest", (_req, res) => {
    res.json(buildHarvest());
  });

  app.get("/api/nexora/moondev-full/blueprint", (_req, res) => {
    res.json(readState());
  });
}
