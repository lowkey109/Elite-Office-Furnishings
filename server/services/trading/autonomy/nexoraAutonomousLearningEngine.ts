import { sql } from "drizzle-orm";
import { db } from "../../../db";
import { getNexoraSetupPromotions } from "../promotion/nexoraSetupPromotionEngine";
import { getNexoraPortfolioBrain } from "../portfolio/nexoraPortfolioBrain";
import { getNexoraMarketRegimeSnapshot } from "../regime/nexoraMarketRegimeEngine";

export type NexoraAutonomyDecision = {
  ok: boolean;
  service: "nexora_autonomous_learning_engine";
  symbol: string;
  strategy: string;
  direction: "long" | "short";
  mode: "blocked" | "micro_probe" | "standard_paper" | "promoted_paper";
  positionSizeMultiplier: number;
  confidenceAdjustment: number;
  reasons: string[];
  updatedAt: string;
};

export async function ensureNexoraAutonomyTables() {
  await db.execute(sql`
    create table if not exists nexora_strategy_memory (
      id text primary key,
      symbol text not null,
      strategy text not null,
      direction text not null,
      regime text not null default 'unknown',
      score numeric not null default 50,
      decay_score numeric not null default 0,
      activation_status text not null default 'testing',
      last_reason text,
      updated_at timestamptz not null default now()
    );
  `);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function evaluateNexoraAutonomy(input: {
  symbol: string;
  strategy: string;
  direction: "long" | "short";
  baseConfidence: number;
}): Promise<NexoraAutonomyDecision> {
  await ensureNexoraAutonomyTables();

  const [promotions, portfolio, regimes] = await Promise.all([
    getNexoraSetupPromotions().catch(() => null),
    getNexoraPortfolioBrain().catch(() => null),
    getNexoraMarketRegimeSnapshot().catch(() => null),
  ]);

  const reasons: string[] = [];
  const promotion = promotions?.rows?.find((row: any) =>
    row.symbol === input.symbol &&
    row.strategy === input.strategy &&
    (row.direction === input.direction || row.direction === "unknown")
  );

  const regime = regimes?.results?.find((row: any) =>
    row.symbol === input.symbol && row.timeframe === "1m"
  );

  let score = Number(input.baseConfidence || 50);
  let mode: NexoraAutonomyDecision["mode"] = "micro_probe";
  let size = 0.1;

  if (promotion?.status === "blocked") {
    score -= 25;
    reasons.push(`Promotion status blocked: ${promotion.reason || "weak setup"}.`);
  }

  if (promotion?.status === "candidate") {
    score += 8;
    size = 0.25;
    mode = "standard_paper";
    reasons.push("Promotion engine marks setup as candidate.");
  }

  if (promotion?.status === "promoted" || promotion?.status === "elite") {
    score += promotion.status === "elite" ? 20 : 14;
    size = promotion.status === "elite" ? 0.75 : 0.5;
    mode = "promoted_paper";
    reasons.push(`Promotion engine marks setup as ${promotion.status}.`);
  }

  if (regime?.regime === "risk_off") {
    score -= 20;
    size *= 0.25;
    reasons.push("Market regime is risk-off.");
  }

  const regimeAgrees =
    (input.direction === "long" && regime?.regime === "trend_up") ||
    (input.direction === "short" && regime?.regime === "trend_down") ||
    regime?.regime === "squeeze";

  if (regimeAgrees) {
    score += 8;
    reasons.push(`Regime ${regime?.regime} supports setup.`);
  } else if (regime?.regime) {
    score -= 8;
    reasons.push(`Regime ${regime.regime} does not strongly support setup.`);
  }

  if (portfolio?.riskState === "medium") {
    size *= 0.5;
    reasons.push("Portfolio risk is medium; reducing size.");
  }

  if (portfolio?.riskState === "high") {
    score -= 30;
    size = 0;
    mode = "blocked";
    reasons.push("Portfolio risk is high; blocked.");
  }

  if (score < 45) {
    mode = "blocked";
    size = 0;
    reasons.push("Autonomy score below minimum.");
  } else if (score < 65 && mode !== "blocked") {
    mode = "micro_probe";
    size = Math.min(size, 0.1);
    reasons.push("Research probe only.");
  }

  const id = [input.symbol, input.strategy, input.direction, regime?.regime || "unknown"].join("|");

  await db.execute(sql`
    insert into nexora_strategy_memory (
      id, symbol, strategy, direction, regime, score, decay_score, activation_status, last_reason, updated_at
    )
    values (
      ${id},
      ${input.symbol},
      ${input.strategy},
      ${input.direction},
      ${regime?.regime || "unknown"},
      ${score},
      ${score < 45 ? 100 - score : 0},
      ${mode},
      ${reasons.join(" ")},
      now()
    )
    on conflict(id)
    do update set
      score = excluded.score,
      decay_score = excluded.decay_score,
      activation_status = excluded.activation_status,
      last_reason = excluded.last_reason,
      updated_at = now();
  `);

  return {
    ok: mode !== "blocked",
    service: "nexora_autonomous_learning_engine",
    symbol: input.symbol,
    strategy: input.strategy,
    direction: input.direction,
    mode,
    positionSizeMultiplier: clamp(size, 0, 1),
    confidenceAdjustment: Math.round(score - input.baseConfidence),
    reasons,
    updatedAt: new Date().toISOString(),
  };
}

export async function getNexoraStrategyMemory() {
  await ensureNexoraAutonomyTables();

  const result: any = await db.execute(sql`
    select *
    from nexora_strategy_memory
    order by updated_at desc
    limit 200;
  `);

  return {
    ok: true,
    service: "nexora_strategy_memory",
    rows: Array.isArray(result) ? result : result.rows || [],
    updatedAt: new Date().toISOString(),
  };
}
