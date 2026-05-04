import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../../localcore/nexoraLocalCore";
import { recordNexoraMetric } from "../../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

const FACTORY_LOG = nexoraLocalPath("poly-five", "strategies", "strategy-factory-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-five", "journal", "poly-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function moondevImportedStrategies(limit = 500) {
  return readNexoraJsonl(nexoraLocalPath("moondev-strategy-import", "strategies", "strategy-log.jsonl"))
    .filter((row: any) => row.event === "strategy.imported")
    .map((row: any) => row.strategy)
    .slice(-limit)
    .reverse();
}

export function createNexoraStrategyCandidateFromMoonDev(input: any = {}) {
  const candidateId = String(input.candidateId || nexoraLocalId("strategy_candidate"));
  const source = input.source || moondevImportedStrategies(1)[0] || null;

  const candidate = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_strategy_candidate",
    candidateId,
    createdAt: now(),
    sourceStrategyId: source?.strategyId || null,
    name: String(input.name || source?.name || "MoonDev-inspired paper strategy"),
    sourceFile: source?.relativePath || source?.sourceFile || null,
    family:
      source?.classification?.volatility ? "volatility" :
      source?.classification?.momentum ? "momentum" :
      source?.classification?.liquidity ? "liquidity" :
      source?.classification?.meanReversion ? "mean_reversion" :
      "general",
    mode: "paper_only",
    parameters: {
      minEdgeBps: Number(input.minEdgeBps || 250),
      maxLatencyMs: Number(input.maxLatencyMs || 3000),
      maxRiskFraction: Number(input.maxRiskFraction || 0.02),
      volatilityBps: Number(input.volatilityBps || 35),
      slippageBps: Number(input.slippageBps || 50),
    },
    score: Number(input.score || source?.score || 0),
    directUseAllowed: false,
    adaptedFromMoonDev: Boolean(source),
    safety: {
      noLiveTrading: true,
      noPrivateKeys: true,
      noDirectPythonExecution: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-five", "strategies", `${candidateId}.json`), candidate);
  appendNexoraJsonl(FACTORY_LOG, { event: "strategy.candidate", candidate, createdAt: now() });
  journal("strategy.candidate", candidate);

  return { ok: true, nexoraBrain: true, candidate };
}

export function batchCreateNexoraStrategyCandidates(input: any = {}) {
  const batchId = String(input.batchId || nexoraLocalId("strategy_batch"));
  const limit = Number(input.limit || 25);
  const imported = moondevImportedStrategies(limit);

  const candidates = imported.map((source: any) =>
    createNexoraStrategyCandidateFromMoonDev({
      source,
      score: source.score || 0,
    }).candidate
  );

  const result = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_strategy_candidate_batch",
    batchId,
    createdAt: now(),
    count: candidates.length,
    candidates,
  };

  appendNexoraJsonl(FACTORY_LOG, { event: "strategy.batch", result, createdAt: now() });
  journal("strategy.batch", result);

  recordNexoraMetric({
    name: "poly_strategy_candidates_created",
    value: candidates.length,
    unit: "strategies",
    dimensions: {},
  });

  return { ok: true, nexoraBrain: true, result };
}

export function listNexoraPolyStrategyCandidates(input: any = {}) {
  const limit = Number(input.limit || 100);
  const family = input.family ? String(input.family) : "";

  const rows = readNexoraJsonl(FACTORY_LOG)
    .filter((row: any) => row.event === "strategy.candidate")
    .map((row: any) => row.candidate)
    .filter((row: any) => !family || row.family === family)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getPolyStrategyFactoryStatus() {
  const rows = listNexoraPolyStrategyCandidates({ limit: 1000 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_strategy_factory_status",
    candidates: rows.count,
    safety: {
      paperOnly: true,
      noDirectPythonExecution: true,
    },
  };
}
