import type { Express, Request, Response } from "express";

import {
  rankMoonDevImportedStrategies,
  createMoonDevStrategyAdapterPlan,
  getMoonDevStrategyImportStatus,
} from "../moondevstrategyimport/nexoraMoonDevStrategyBacktestImporter";

import {
  runMoonDevImportedStrategyTournament,
  getMoonDevImportedStrategyTournamentStatus,
} from "../polyfinalfive/moondevtournament/nexoraMoonDevTournamentFromImported";

import {
  runPolyStrategyTournament,
  getPolyStrategyTournamentStatus,
} from "../polynextfive/strategytournament/nexoraPolyStrategyTournament";

import {
  runPolyRiskStressTest,
  getPolyRiskStressStatus,
} from "../polynextfive/riskstress/nexoraPolyRiskStress";

import {
  runNexoraBacktestSimulation,
  getNexoraBacktestStatus,
} from "../backtesting/nexoraBacktestSimulationEngine";

import { coinbaseSafetyEnvelope } from "../../coinbase/nexoraCoinbaseLiveConfig";
import { coinbaseLearningSnapshot } from "../../coinbase/nexoraCoinbaseLearningEngine";
import { chooseCoinbasePaperStrategy } from "../../coinbase/nexoraCoinbaseStrategyEngine";
import { coinbaseMarketBias } from "../../coinbase/nexoraCoinbaseMarketBiasEngine";

export function registerNexoraCoinbaseMoonDevBridgeRoutes(app: Express) {
  app.get("/api/nexora/coinbase/moondev/status", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "nexora_coinbase_moondev_bridge",
      safety: coinbaseSafetyEnvelope(),
      coinbase: {
        learning: coinbaseLearningSnapshot(),
        strategy: chooseCoinbasePaperStrategy(),
        bias: coinbaseMarketBias(),
      },
      moondev: {
        importStatus: getMoonDevStrategyImportStatus(),
        importedTournamentStatus: getMoonDevImportedStrategyTournamentStatus(),
        polyTournamentStatus: getPolyStrategyTournamentStatus(),
        riskStressStatus: getPolyRiskStressStatus(),
        backtestStatus: getNexoraBacktestStatus(),
      },
    });
  });

  app.post("/api/nexora/coinbase/moondev/run", (req: Request, res: Response) => {
    const body = req.body || {};

    const strategyRanking = rankMoonDevImportedStrategies({
      limit: Number(body.limit || 25),
    });

    const adapterPlan = createMoonDevStrategyAdapterPlan({
      venue: "coinbase",
      mode: "paper",
      products: ["BTC-USD", "ETH-USD", "SOL-USD"],
      safety: coinbaseSafetyEnvelope(),
    });

    const importedTournament = runMoonDevImportedStrategyTournament({
      venue: "coinbase",
      mode: "paper",
      products: ["BTC-USD", "ETH-USD", "SOL-USD"],
      limit: Number(body.limit || 25),
    });

    const polyTournament = runPolyStrategyTournament({
      venue: "coinbase",
      mode: "paper",
      products: ["BTC-USD", "ETH-USD", "SOL-USD"],
      count: Number(body.count || 20),
    });

    const riskStress = runPolyRiskStressTest({
      venue: "coinbase",
      mode: "paper",
      products: ["BTC-USD", "ETH-USD", "SOL-USD"],
      scenario: body.scenario || "coinbase_paper_autopilot",
    });

    const backtest = runNexoraBacktestSimulation({
      venue: "coinbase",
      mode: "paper",
      products: ["BTC-USD", "ETH-USD", "SOL-USD"],
      strategy: "moondev_consensus",
      dataset: body.dataset || "synthetic",
    });

    res.json({
      ok: true,
      service: "nexora_coinbase_moondev_bridge_run",
      generatedAt: new Date().toISOString(),
      safety: coinbaseSafetyEnvelope(),
      coinbase: {
        learning: coinbaseLearningSnapshot(),
        strategy: chooseCoinbasePaperStrategy(),
        bias: coinbaseMarketBias(),
      },
      moondev: {
        strategyRanking,
        adapterPlan,
        importedTournament,
        polyTournament,
        riskStress,
        backtest,
      },
      directive: {
        mode: "paper_only",
        action: "use_moondev_rankings_to_steer_coinbase_autopilot",
        liveTrading: false,
      },
    });
  });
}
