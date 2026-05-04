import fs from "fs";
import path from "path";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../../localcore/nexoraLocalCore";
import { recordNexoraMetric } from "../../warehouse/nexoraLocalWarehouse";
import { recordNexoraTimelineEvent } from "../../timeline/nexoraTimeline";

function now() {
  return new Date().toISOString();
}

const RISK_LOG = nexoraLocalPath("poly-five", "risk", "risk-extractor-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-five", "journal", "poly-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if ([".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".cache"].includes(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(py|md|txt|json)$/.test(name)) out.push(full);
  }
  return out;
}

function read(file: string) {
  try { return fs.readFileSync(file, "utf8"); } catch { return ""; }
}

function extractRules(file: string, source: string) {
  const lines = source.split("\n");
  const matches = lines
    .map((line, index) => ({ line: line.trim(), index: index + 1 }))
    .filter((row) =>
      /risk|drawdown|exposure|kelly|stop.?loss|limit|position.?size|slippage|kill|throttle|veto|approve|private|wallet|live/i.test(row.line)
    )
    .slice(0, 120);

  const text = source.toLowerCase();

  return {
    file,
    lines: source.split("\n").length,
    matches,
    categories: {
      drawdown: /drawdown/.test(text),
      exposure: /exposure|position.?size/.test(text),
      kelly: /kelly/.test(text),
      stopLoss: /stop.?loss/.test(text),
      slippage: /slippage/.test(text),
      killSwitch: /kill|halt|shutdown|circuit/.test(text),
      privateKeyDanger: /private[_ -]?key|seed phrase|mnemonic|wallet/.test(text),
      liveTradingDanger: /live trading|place_order|submit_order|sign_order/.test(text),
    },
  };
}

export function extractMoonDevRiskRules(input: any = {}) {
  const root = String(input.root || "research/moondev-selected");
  const extractionId = String(input.extractionId || nexoraLocalId("risk_extract"));

  const files = walk(root).filter((file) =>
    /risk|trading|strategy|copybot|polymarket|base_agent|swarm/i.test(file)
  );

  const extracted = files.map((file) => extractRules(file, read(file))).filter((row) => row.matches.length > 0);

  const rulePack = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_risk_rule_extractor",
    extractionId,
    root,
    createdAt: now(),
    fileCount: files.length,
    extractedCount: extracted.length,
    extracted,
    nexoraPolicyMapping: [
      "max_single_trade_usd",
      "max_open_exposure_usd",
      "max_daily_loss_usd",
      "kill_switch_required",
      "no_private_keys",
      "no_live_trading_without_owner_commit",
      "slippage_limit_bps",
      "latency_limit_ms",
    ],
    safety: {
      directExecution: false,
      noPrivateKeys: true,
      noLiveTrading: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-five", "risk", `${extractionId}.json`), rulePack);
  appendNexoraJsonl(RISK_LOG, { event: "risk_rules.extracted", rulePack, createdAt: now() });
  journal("risk_rules.extracted", { extractionId, extracted: extracted.length });

  recordNexoraMetric({
    name: "moondev_risk_rules_extracted",
    value: extracted.length,
    unit: "files",
    dimensions: {},
  });

  recordNexoraTimelineEvent({
    type: "poly_risk_extractor",
    title: "MoonDev risk rules extracted for Nexora",
    severity: "info",
    payload: { extractionId, extracted: extracted.length },
  });

  return { ok: true, nexoraBrain: true, rulePack };
}

export function getPolyRiskExtractorStatus() {
  const rows = readNexoraJsonl(RISK_LOG).filter((row: any) => row.event === "risk_rules.extracted");
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_risk_rule_extractor_status",
    extractions: rows.length,
    latest: rows.slice(-1)[0]?.rulePack || null,
  };
}
