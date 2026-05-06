import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "research", "moondev-selected");

function read(file: string) {
  try {
    return fs.readFileSync(path.join(ROOT, file), "utf8");
  } catch {
    return "";
  }
}

function extractTripleQuoted(source: string, name: string) {
  const marker = `${name} = """`;
  const start = source.indexOf(marker);
  if (start === -1) return "";

  const contentStart = start + marker.length;
  const end = source.indexOf('"""', contentStart);
  if (end === -1) return "";

  return source.slice(contentStart, end).trim();
}

export function getMoonDevPolicyStatus() {
  const files = [
    "agents/risk_agent.py",
    "agents/strategy_agent.py",
    "agents/trading_agent.py",
    "agents/sentiment_agent.py",
    "strategies/base_strategy.py",
    "docs/IMPORT_NOTES.md",
  ];

  return {
    ok: true,
    service: "nexora_moondev_policy_adapter",
    root: "research/moondev-selected",
    files: files.map((file) => ({
      file,
      present: fs.existsSync(path.join(ROOT, file)),
    })),
  };
}

export function getMoonDevPolicyPrompts() {
  const risk = read("agents/risk_agent.py");
  const strategy = read("agents/strategy_agent.py");
  const trading = read("agents/trading_agent.py");
  const baseStrategy = read("strategies/base_strategy.py");
  const notes = read("docs/IMPORT_NOTES.md");

  return {
    ok: true,
    service: "nexora_moondev_policy_prompts",
    prompts: {
      riskOverride: extractTripleQuoted(risk, "RISK_OVERRIDE_PROMPT"),
      strategyEvaluation: extractTripleQuoted(strategy, "STRATEGY_EVAL_PROMPT"),
      tradingDecision: extractTripleQuoted(trading, "TRADING_PROMPT"),
      allocation: extractTripleQuoted(trading, "ALLOCATION_PROMPT"),
    },
    interfaces: {
      baseStrategySignalShape: baseStrategy.includes("generate_signals")
        ? {
            token: "string",
            signal: "number 0-1",
            direction: "BUY | SELL | NEUTRAL",
            metadata: "object",
          }
        : null,
    },
    importNotes: notes,
  };
}

export function buildMoonDevCoinbasePaperPolicy(input: any = {}) {
  const prompts = getMoonDevPolicyPrompts();

  const products = input.products || ["BTC-USD", "ETH-USD", "SOL-USD"];
  const mode = input.mode || "paper";
  const venue = input.venue || "coinbase";

  return {
    ok: true,
    service: "nexora_moondev_coinbase_paper_policy",
    generatedAt: new Date().toISOString(),
    venue,
    mode,
    products,
    executionRules: {
      liveTrading: false,
      withdrawals: "locked",
      requireDryRun: true,
      requireRiskCheck: true,
      requireStrategyValidation: true,
      requirePortfolioAllocationLimit: true,
    },
    moonDevAdaptation: {
      useRiskOverridePrompt: Boolean(prompts.prompts.riskOverride),
      useStrategyValidationPrompt: Boolean(prompts.prompts.strategyEvaluation),
      useTradingDecisionPrompt: Boolean(prompts.prompts.tradingDecision),
      useAllocationPrompt: Boolean(prompts.prompts.allocation),
      signalInterface: prompts.interfaces.baseStrategySignalShape,
    },
    policy: {
      decisionFlow: [
        "collect market context",
        "collect strategy signals",
        "validate strategy signals with MoonDev strategy-evaluation logic",
        "classify BUY / SELL / NOTHING using MoonDev trading-decision logic",
        "run risk override / respect-limit logic",
        "apply paper-only allocation limits",
        "record outcome into Nexora learning memory",
      ],
      approvalState: "paper_only_auto_allowed",
      livePromotionState: "blocked_until_separate_readiness_gate",
    },
  };
}
