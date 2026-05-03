import { sql } from "drizzle-orm";
import { db } from "../../../db";

export async function ensureNexoraSimulationTables() {
  await db.execute(sql`
    create table if not exists nexora_simulation_runs (
      id text primary key,
      market_id text,
      strategy text,
      scenario_count int,
      expected_pnl numeric,
      expected_win_rate numeric,
      expected_drawdown numeric,
      confidence_score numeric,
      payload jsonb,
      created_at timestamptz default now()
    );
  `);

  await db.execute(sql`
    create table if not exists nexora_shadow_decisions (
      id text primary key,
      live_signal jsonb,
      shadow_signal jsonb,
      divergence_score numeric,
      created_at timestamptz default now()
    );
  `);

  return true;
}

function rand(min:number,max:number){
  return Math.random()*(max-min)+min;
}

export async function runNexoraMonteCarloSimulation(input:any={}) {
  await ensureNexoraSimulationTables();

  const runs = Number(input.runs || 500);
  const edge = Number(input.edgePct || 7);
  const bankroll = Number(input.bankrollUsd || 1000);

  let pnl = 0;
  let wins = 0;
  let worstDrawdown = 0;
  let running = bankroll;

  for(let i=0;i<runs;i++){
    const simulatedEdge = edge + rand(-4,4);
    const outcome = simulatedEdge > 0 ? rand(-1,3) : rand(-3,1);

    pnl += outcome;

    if(outcome > 0) wins++;

    running += outcome;

    const dd = bankroll - running;
    if(dd > worstDrawdown) worstDrawdown = dd;
  }

  const expectedPnl = Number((pnl).toFixed(2));
  const expectedWinRate = Number(((wins/runs)*100).toFixed(2));

  const confidence =
    expectedWinRate >= 65 && expectedPnl > 0
      ? 85
      : expectedWinRate >= 55
      ? 70
      : 45;

  const id = `sim_${Date.now()}`;

  await db.execute(sql`
    insert into nexora_simulation_runs (
      id,
      market_id,
      strategy,
      scenario_count,
      expected_pnl,
      expected_win_rate,
      expected_drawdown,
      confidence_score,
      payload
    ) values (
      ${id},
      ${String(input.marketId || "")},
      ${String(input.strategy || "mispricing_value_edge")},
      ${runs},
      ${expectedPnl},
      ${expectedWinRate},
      ${worstDrawdown},
      ${confidence},
      ${JSON.stringify(input)}::jsonb
    );
  `);

  return {
    ok: true,
    service: "nexora_monte_carlo_simulation",
    id,
    runs,
    expectedPnl,
    expectedWinRate,
    expectedDrawdown: worstDrawdown,
    confidence,
    paperOnly: true,
    updatedAt: new Date().toISOString(),
  };
}

export async function runNexoraShadowExecution(input:any={}) {
  await ensureNexoraSimulationTables();

  const liveSignal = input.liveSignal || {};
  const shadowSignal = input.shadowSignal || {};

  const divergence =
    Math.abs(
      Number(liveSignal.modelProbability || 0) -
      Number(shadowSignal.modelProbability || 0)
    ) * 100;

  const id = `shadow_${Date.now()}`;

  await db.execute(sql`
    insert into nexora_shadow_decisions (
      id,
      live_signal,
      shadow_signal,
      divergence_score
    ) values (
      ${id},
      ${JSON.stringify(liveSignal)}::jsonb,
      ${JSON.stringify(shadowSignal)}::jsonb,
      ${divergence}
    );
  `);

  return {
    ok: true,
    service: "nexora_shadow_execution",
    id,
    divergenceScore: divergence,
    recommendation:
      divergence > 15
        ? "Signals disagree heavily. Block execution."
        : "Signals aligned.",
    paperOnly: true,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraSimulationStatus() {
  return {
    ok: true,
    service: "nexora_omega_simulation_grid",
    systems: [
      "monte carlo simulator",
      "shadow execution",
      "probability stress testing",
      "drawdown analysis",
      "confidence scoring",
      "paper-only simulation"
    ],
    status: "Omega simulation grid active.",
    liveTradingEnabled: false,
    updatedAt: new Date().toISOString(),
  };
}
