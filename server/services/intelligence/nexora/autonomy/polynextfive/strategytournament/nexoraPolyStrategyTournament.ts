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

const TOURNAMENT_LOG = nexoraLocalPath("poly-next-five", "strategy-tournament", "tournament-log.jsonl");
const JOURNAL = nexoraLocalPath("poly-next-five", "journal", "poly-next-five-journal.jsonl");

function journal(event: string, payload: any) {
  appendNexoraJsonl(JOURNAL, { event, payload, createdAt: now() });
}

function importedCandidates() {
  return [
    ...readNexoraJsonl(nexoraLocalPath("poly-five", "strategies", "strategy-factory-log.jsonl"))
      .filter((row: any) => row.event === "strategy.candidate")
      .map((row: any) => row.candidate),
    ...readNexoraJsonl(nexoraLocalPath("moondev-strategy-import", "rankings", "ranking-log.jsonl"))
      .filter((row: any) => row.event === "strategies.ranked")
      .flatMap((row: any) => row.ranking?.top || []),
  ];
}

export function runPolyStrategyTournament(input: any = {}) {
  const tournamentId = String(input.tournamentId || nexoraLocalId("strategy_tournament"));
  const candidates = importedCandidates().slice(0, Number(input.limit || 50));

  const scored = candidates.map((candidate: any, index: number) => {
    const baseScore = Number(candidate.finalScore || candidate.score || candidate.baseScore || 0);
    const riskPenalty =
      JSON.stringify(candidate).toLowerCase().includes("danger") ||
      JSON.stringify(candidate).toLowerCase().includes("private")
        ? 50
        : 0;
    const paperBonus =
      JSON.stringify(candidate).toLowerCase().includes("paper") ||
      JSON.stringify(candidate).toLowerCase().includes("backtest")
        ? 15
        : 0;

    const score = Math.max(0, Math.min(100, baseScore + paperBonus - riskPenalty));

    return {
      rank: index + 1,
      candidateId: candidate.candidateId || candidate.strategyId || candidate.rankId || `candidate_${index + 1}`,
      name: candidate.name || candidate.sourceFile || "MoonDev candidate",
      score,
      action:
        score >= 80 ? "paper_test_priority" :
        score >= 55 ? "paper_test_later" :
        score >= 30 ? "reference" :
        "ignore",
      candidate,
    };
  }).sort((a: any, b: any) => b.score - a.score);

  const tournament = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_strategy_tournament",
    tournamentId,
    createdAt: now(),
    candidateCount: scored.length,
    winner: scored[0] || null,
    top: scored.slice(0, 25),
    safety: {
      paperOnly: true,
      noLiveTrading: true,
      noPrivateKeys: true,
      noDirectPythonExecution: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("poly-next-five", "strategy-tournament", `${tournamentId}.json`), tournament);
  appendNexoraJsonl(TOURNAMENT_LOG, { event: "strategy.tournament", tournament, createdAt: now() });
  journal("strategy.tournament", tournament);

  recordNexoraMetric({
    name: "poly_strategy_tournament_candidates",
    value: scored.length,
    unit: "candidates",
    dimensions: {},
  });

  return { ok: true, nexoraBrain: true, tournament };
}

export function listPolyStrategyTournaments(input: any = {}) {
  const limit = Number(input.limit || 50);

  const rows = readNexoraJsonl(TOURNAMENT_LOG)
    .filter((row: any) => row.event === "strategy.tournament")
    .map((row: any) => row.tournament)
    .slice(-limit)
    .reverse();

  return { ok: true, nexoraBrain: true, count: rows.length, rows };
}

export function getPolyStrategyTournamentStatus() {
  const rows = listPolyStrategyTournaments({ limit: 100 });
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_strategy_tournament_status",
    tournaments: rows.count,
    latest: rows.rows[0] || null,
  };
}
