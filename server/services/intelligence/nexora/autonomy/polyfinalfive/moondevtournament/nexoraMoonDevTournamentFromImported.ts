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

const TOURNAMENT_LOG = nexoraLocalPath("poly-final-five", "moondev-tournament", "moondev-tournament-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-final-five", "journal", "poly-final-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function importedStrategies() {
  return readNexoraJsonl(nexoraLocalPath("moondev-strategy-import", "strategies", "strategy-log.jsonl"))
    .filter((row: any) => row.event === "strategy.imported")
    .map((row: any) => row.strategy);
}

function importedBacktests() {
  return readNexoraJsonl(nexoraLocalPath("moondev-strategy-import", "backtests", "backtest-log.jsonl"))
    .filter((row: any) => row.event === "backtest.imported")
    .map((row: any) => row.result);
}

export function runMoonDevImportedStrategyTournament(input: any = {}) {
  const tournamentId = String(input.tournamentId || nexoraLocalId("moondev_tournament"));
  const limit = Number(input.limit || 100);
  const strategies = importedStrategies().slice(0, limit);
  const backtests = importedBacktests();

  const ranked = strategies.map((strategy: any) => {
    const related = backtests.filter((result: any) => {
      const a = String(result.relativePath || "").toLowerCase();
      const b = String(strategy.name || "").toLowerCase();
      return a.includes(b) || b.includes(a.replace(/\.(json|txt|md|csv)$/i, ""));
    }).slice(0, 10);

    const backtestBoost = related.reduce((sum: number, r: any) => sum + Number(r.score || 0), 0) / Math.max(1, related.length);
    const baseScore = Number(strategy.score || 0);
    const dangerPenalty = strategy.classification?.danger ? 100 : 0;
    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore * 0.65 + backtestBoost * 0.35 - dangerPenalty)));

    return {
      strategyId: strategy.strategyId,
      name: strategy.name,
      sourceFile: strategy.relativePath,
      baseScore,
      relatedBacktests: related.length,
      finalScore,
      action:
        strategy.classification?.danger ? "quarantine" :
        finalScore >= 80 ? "paper_test_priority" :
        finalScore >= 55 ? "paper_test" :
        finalScore >= 30 ? "reference" :
        "ignore",
      strategy,
    };
  }).sort((a: any, b: any) => b.finalScore - a.finalScore);

  const tournament = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_imported_strategy_tournament",
    tournamentId,
    createdAt: now(),
    strategies: strategies.length,
    backtests: backtests.length,
    winner: ranked[0] || null,
    top: ranked.slice(0, 50),
    safety: {
      paperOnly: true,
      noDirectPythonExecution: true,
      noLiveTrading: true,
      noPrivateKeys: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-final-five", "moondev-tournament", `${tournamentId}.json`), tournament);
  appendNexoraJsonl(TOURNAMENT_LOG, { event: "moondev.tournament", tournament, createdAt: now() });
  journal("moondev.tournament", tournament);

  recordNexoraMetric({
    name: "moondev_tournament_candidates",
    value: ranked.length,
    unit: "strategies",
    dimensions: {},
  });

  return { ok: true, nexoraBrain: true, tournament };
}

export function listMoonDevImportedStrategyTournaments(input: any = {}) {
  const limit = Number(input.limit || 50);
  const rows = readNexoraJsonl(TOURNAMENT_LOG)
    .filter((row: any) => row.event === "moondev.tournament")
    .map((row: any) => row.tournament)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getMoonDevImportedStrategyTournamentStatus() {
  const rows = listMoonDevImportedStrategyTournaments({ limit: 50 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_moondev_imported_strategy_tournament_status",
    tournaments: rows.count,
    latest: rows.rows[0] || null,
  };
}
