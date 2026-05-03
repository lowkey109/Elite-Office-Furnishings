import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { critiqueNexoraPredictionTrade } from "./nexoraSelfCritique";
import { recordNexoraPredictionPaperDecision } from "./nexoraPredictionPaperJournal";
import { evaluateNexoraCalibration } from "./nexoraCalibrationLearner";
import { nexoraDbFallback } from "../resilience/nexoraDbResilience";

export async function ensureNexoraPredictionLearningMemory() {
  await db.execute(sql`
    create table if not exists nexora_prediction_learning_memory (
      id text primary key,
      market_id text,
      strategy text not null,
      predicted_probability numeric,
      market_probability numeric,
      edge_pct numeric,
      simulated_outcome text,
      simulated_pnl numeric,
      critique jsonb,
      raw_signal jsonb,
      created_at timestamptz not null default now()
    );
  `);

  await db.execute(sql`
    create index if not exists nexora_prediction_learning_memory_created_idx
    on nexora_prediction_learning_memory(created_at desc);
  `);

  return true;
}

export function simulateNexoraPredictionOutcome(input: any = {}) {
  const modelProbability = Number(input.modelProbability ?? input.fairProbability ?? 0.5);
  const marketProbability = Number(input.marketProbability ?? input.price ?? 0.5);
  const edgePct = Math.round((modelProbability - marketProbability) * 10000) / 100;
  const positionUsd = Number(input.positionUsd || 10);

  const expectedValue = (modelProbability - marketProbability) * positionUsd;
  const simulatedWin = modelProbability >= 0.5;
  const simulatedPnl = simulatedWin
    ? Math.round(Math.abs(expectedValue) * 100) / 100
    : Math.round(-Math.abs(expectedValue) * 100) / 100;

  return {
    ok: true,
    service: "nexora_prediction_outcome_simulator",
    paperOnly: true,
    modelProbability,
    marketProbability,
    edgePct,
    positionUsd,
    simulatedOutcome: simulatedWin ? "won" : "lost",
    simulatedPnl,
    rule: "Paper simulator estimates outcome/EV until real resolved prediction-market outcomes are available.",
    updatedAt: new Date().toISOString(),
  };
}

export async function recordNexoraAdvancedPaperSignal(input: any = {}) {
  try {
    await ensureNexoraPredictionLearningMemory();

    const id = String(input.id || `${input.marketId || "prediction"}|${Date.now()}`);
    const critique = critiqueNexoraPredictionTrade(input);
    const simulation = simulateNexoraPredictionOutcome(input);

    await recordNexoraPredictionPaperDecision({
      id,
      marketId: input.marketId,
      title: input.title,
      category: input.category,
      strategy: input.strategy || "advanced_prediction_market_stack",
      direction: input.direction || input.finalAction || "MONITOR_ONLY",
      marketProbability: input.marketProbability,
      modelProbability: input.modelProbability || input.fairProbability,
      edgePct: simulation.edgePct,
      positionUsd: input.positionUsd || 10,
      status: simulation.simulatedOutcome,
      decision: { input, critique, simulation },
    });

    await db.execute(sql`
      insert into nexora_prediction_learning_memory (
        id, market_id, strategy, predicted_probability, market_probability,
        edge_pct, simulated_outcome, simulated_pnl, critique, raw_signal
      ) values (
        ${id},
        ${String(input.marketId || "")},
        ${String(input.strategy || "advanced_prediction_market_stack")},
        ${String(input.modelProbability || input.fairProbability || 0.5)},
        ${String(input.marketProbability || input.price || 0.5)},
        ${String(simulation.edgePct)},
        ${simulation.simulatedOutcome},
        ${String(simulation.simulatedPnl)},
        ${JSON.stringify(critique)}::jsonb,
        ${JSON.stringify(input)}::jsonb
      )
      on conflict (id) do nothing;
    `);

    return {
      ok: true,
      service: "nexora_advanced_paper_signal_recorder",
      paperOnly: true,
      recorded: true,
      id,
      critique,
      simulation,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    return nexoraDbFallback("nexora_advanced_paper_signal_recorder", err, { recorded: false });
  }
}

export async function getNexoraPredictionCalibrationMemory(limit = 200) {
  try {
    await ensureNexoraPredictionLearningMemory();

    const rows: any = await db.execute(sql`
      select *
      from nexora_prediction_learning_memory
      order by created_at desc
      limit ${Number(limit) || 200};
    `);

    const outcomes = (rows.rows || []).map((r: any) => ({
      predictedProbability: Number(r.predicted_probability || 0.5),
      won: r.simulated_outcome === "won",
    }));

    return {
      ok: true,
      service: "nexora_prediction_calibration_memory",
      paperOnly: true,
      sampleSize: outcomes.length,
      calibration: evaluateNexoraCalibration({ outcomes }),
      rows: rows.rows || [],
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    return nexoraDbFallback("nexora_prediction_calibration_memory", err, {
      sampleSize: 0,
      rows: [],
      calibration: evaluateNexoraCalibration({ outcomes: [] }),
    });
  }
}
