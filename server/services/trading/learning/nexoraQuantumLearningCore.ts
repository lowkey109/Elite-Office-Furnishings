import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function ensureNexoraQuantumTables() {
  await db.execute(sql`
    create table if not exists nexora_probability_calibration (
      id text primary key,
      strategy text,
      predicted_confidence numeric,
      actual_outcome numeric,
      calibration_error numeric,
      created_at timestamptz default now()
    );
  `);

  await db.execute(sql`
    create table if not exists nexora_source_reliability (
      source text primary key,
      trust_score numeric default 50,
      correct_signals int default 0,
      false_signals int default 0,
      updated_at timestamptz default now()
    );
  `);

  await db.execute(sql`
    create table if not exists nexora_market_regimes (
      id text primary key,
      regime text,
      volatility numeric,
      liquidity numeric,
      sentiment numeric,
      recommended_strategy text,
      created_at timestamptz default now()
    );
  `);

  return true;
}

export async function recordNexoraCalibration(input: any = {}) {
  await ensureNexoraQuantumTables();

  const id = String(input.id || `cal_${Date.now()}`);
  const predicted = Number(input.predictedConfidence || 0);
  const actual = Number(input.actualOutcome || 0);

  const calibrationError = Math.abs(predicted - actual);

  await db.execute(sql`
    insert into nexora_probability_calibration (
      id,
      strategy,
      predicted_confidence,
      actual_outcome,
      calibration_error
    ) values (
      ${id},
      ${String(input.strategy || "unknown")},
      ${predicted},
      ${actual},
      ${calibrationError}
    )
    on conflict (id) do nothing;
  `);

  return {
    ok: true,
    service: "nexora_probability_calibration",
    id,
    calibrationError,
    updatedAt: new Date().toISOString(),
  };
}

export async function updateNexoraSourceReliability(input: any = {}) {
  await ensureNexoraQuantumTables();

  const source = String(input.source || "unknown");
  const correct = Number(input.correct || 0);
  const incorrect = Number(input.incorrect || 0);

  const score =
    correct + incorrect === 0
      ? 50
      : Math.round((correct / (correct + incorrect)) * 100);

  await db.execute(sql`
    insert into nexora_source_reliability (
      source,
      trust_score,
      correct_signals,
      false_signals,
      updated_at
    ) values (
      ${source},
      ${score},
      ${correct},
      ${incorrect},
      now()
    )
    on conflict (source)
    do update set
      trust_score = ${score},
      correct_signals = nexora_source_reliability.correct_signals + ${correct},
      false_signals = nexora_source_reliability.false_signals + ${incorrect},
      updated_at = now();
  `);

  return {
    ok: true,
    service: "nexora_source_reliability",
    source,
    trustScore: score,
    updatedAt: new Date().toISOString(),
  };
}

export async function detectNexoraMarketRegime(input: any = {}) {
  await ensureNexoraQuantumTables();

  const volatility = Number(input.volatility || 0);
  const liquidity = Number(input.liquidity || 0);
  const sentiment = Number(input.sentiment || 0);

  let regime = "balanced";
  let strategy = "mispricing_value_edge";

  if (volatility > 70 && liquidity > 60) {
    regime = "high_volatility";
    strategy = "momentum_repricing";
  } else if (volatility < 30 && liquidity > 70) {
    regime = "stable_liquid";
    strategy = "market_making_spread_capture";
  } else if (sentiment > 80) {
    regime = "euphoric";
    strategy = "mean_reversion_overreaction";
  } else if (liquidity < 30) {
    regime = "illiquid";
    strategy = "risk_off_monitor_mode";
  }

  const id = `regime_${Date.now()}`;

  await db.execute(sql`
    insert into nexora_market_regimes (
      id,
      regime,
      volatility,
      liquidity,
      sentiment,
      recommended_strategy
    ) values (
      ${id},
      ${regime},
      ${volatility},
      ${liquidity},
      ${sentiment},
      ${strategy}
    );
  `);

  return {
    ok: true,
    service: "nexora_market_regime_detector",
    regime,
    recommendedStrategy: strategy,
    volatility,
    liquidity,
    sentiment,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraQuantumStatus() {
  return {
    ok: true,
    service: "nexora_quantum_learning_core",
    activeSystems: [
      "probability calibration",
      "source reliability scoring",
      "market regime detection",
      "adaptive strategy selection",
      "signal memory",
      "strategy ranking",
      "self critique",
      "risk protection",
      "paper execution queue",
      "fallback strategy engine"
    ],
    paperOnly: true,
    liveTradingEnabled: false,
    status: "Quantum learning core active.",
    updatedAt: new Date().toISOString(),
  };
}
