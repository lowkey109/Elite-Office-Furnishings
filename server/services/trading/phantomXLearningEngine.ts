import { Client } from "pg";
import { assertNexoraExecutionApproved } from "../intelligence/nexora/nexoraExecutionGate";

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER
      ? `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD || ""}@${process.env.PGHOST}:${process.env.PGPORT || "5432"}/${process.env.PGDATABASE}`
      : "")
  );
}

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function strategyKeyFromMarket(row: any): string {
  const raw = String(row.category || row.status || row.side || "general")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return raw || "general";
}

function confidenceFromSamples(samples: number): number {
  if (samples <= 0) return 0;
  return Math.min(0.98, samples / 50);
}

export async function runPhantomXLearningCycle() {
  const gate = assertNexoraExecutionApproved({
    moduleKey: "phantom_x",
    intent: "learn",
    requestedBy: "nexora",
    reason: "Nexora approved Phantom X learning cycle",
    evidence: {
      source: "phantom_x_learning_cycle",
      mode: "paper_learning",
    },
  });

  console.log("[Nexora PhantomX] Learning approved through execution gate", {
    decision: gate.decision,
    empireScore: gate.empireScore?.empireScore,
  });

  const url = connectionString();
  if (!url) throw new Error("DATABASE_URL is not configured");

  const client = new Client({
    connectionString: url,
    ssl: url.includes("railway") || url.includes("rlwy") ? { rejectUnauthorized: false } : undefined,
  } as any);

  await client.connect();

  const stats = {
    marketsSeen: 0,
    opportunitiesSeen: 0,
    paperTradesSeen: 0,
    outcomesCreated: 0,
    strategiesUpdated: 0,
    walletScoresUpdated: 0,
    thresholdWatch: 45,
    thresholdPaper: 70,
    thresholdAvoid: 20,
    notes: [] as string[],
  };

  const markets = await client.query(`
    SELECT id, question, category, price, liquidity, volume, updated_at
    FROM phantom_x_markets
    ORDER BY COALESCE(updated_at, created_at) DESC
    LIMIT 250
  `).catch(() => ({ rows: [] as any[] }));

  stats.marketsSeen = markets.rows.length;

  const opportunities = await client.query(`
    SELECT id, market_id, title, score, confidence, thesis, evidence_summary, status, created_at
    FROM phantom_x_opportunities
    ORDER BY created_at DESC
    LIMIT 250
  `).catch(() => ({ rows: [] as any[] }));

  stats.opportunitiesSeen = opportunities.rows.length;

  const paperTrades = await client.query(`
    SELECT id, market_id, market_title, side, entry_price, current_price, pnl, status, created_at, updated_at
    FROM phantom_x_paper_trades
    ORDER BY created_at DESC
    LIMIT 500
  `).catch(() => ({ rows: [] as any[] }));

  stats.paperTradesSeen = paperTrades.rows.length;

  for (const trade of paperTrades.rows) {
    const pnl = safeNumber(trade.pnl);
    const result = pnl > 0 ? "win" : pnl < 0 ? "loss" : "flat";
    const strategyKey = strategyKeyFromMarket(trade);

    await client.query(`
      INSERT INTO phantom_x_outcomes
        (source_type, source_id, market_id, market_title, strategy_key, entry_price, exit_price, pnl, result, evidence)
      VALUES
        ('paper_trade', $1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT DO NOTHING
    `, [
      String(trade.id),
      trade.market_id,
      trade.market_title,
      strategyKey,
      safeNumber(trade.entry_price),
      safeNumber(trade.current_price),
      pnl,
      result,
      JSON.stringify({
        status: trade.status,
        side: trade.side,
        createdAt: trade.created_at,
        updatedAt: trade.updated_at,
      }),
    ]);

    stats.outcomesCreated++;
  }

  const strategyRows = await client.query(`
    SELECT
      strategy_key,
      COUNT(*) FILTER (WHERE result = 'win')::int AS wins,
      COUNT(*) FILTER (WHERE result = 'loss')::int AS losses,
      COUNT(*)::int AS samples,
      COALESCE(SUM(pnl), 0)::numeric AS total_pnl,
      COALESCE(AVG(pnl), 0)::numeric AS avg_pnl
    FROM phantom_x_outcomes
    GROUP BY strategy_key
  `).catch(() => ({ rows: [] as any[] }));

  for (const row of strategyRows.rows) {
    const wins = safeNumber(row.wins);
    const losses = safeNumber(row.losses);
    const samples = safeNumber(row.samples);
    const totalPnl = safeNumber(row.total_pnl);
    const avgPnl = safeNumber(row.avg_pnl);
    const winRate = samples ? wins / samples : 0;
    const confidence = confidenceFromSamples(samples);

    await client.query(`
      INSERT INTO phantom_x_strategy_memory
        (strategy_key, label, category, wins, losses, total_pnl, avg_pnl, win_rate, confidence, last_seen_at, metadata, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,NOW())
      ON CONFLICT (strategy_key) DO UPDATE SET
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        total_pnl = EXCLUDED.total_pnl,
        avg_pnl = EXCLUDED.avg_pnl,
        win_rate = EXCLUDED.win_rate,
        confidence = EXCLUDED.confidence,
        last_seen_at = NOW(),
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `, [
      row.strategy_key,
      String(row.strategy_key).replace(/_/g, " "),
      row.strategy_key,
      wins,
      losses,
      totalPnl,
      avgPnl,
      winRate,
      confidence,
      JSON.stringify({ samples }),
    ]);

    stats.strategiesUpdated++;
  }

  const bestStrategies = strategyRows.rows
    .map((row: any) => ({
      key: row.strategy_key,
      samples: safeNumber(row.samples),
      winRate: safeNumber(row.samples) ? safeNumber(row.wins) / safeNumber(row.samples) : 0,
      avgPnl: safeNumber(row.avg_pnl),
    }))
    .filter((s: any) => s.samples >= 3)
    .sort((a: any, b: any) => (b.winRate * b.avgPnl) - (a.winRate * a.avgPnl));

  if (bestStrategies.length) {
    const top = bestStrategies[0];
    const watch = top.winRate > 0.58 ? 42 : 45;
    const paper = top.winRate > 0.62 ? 66 : 70;

    stats.thresholdWatch = watch;
    stats.thresholdPaper = paper;
    stats.notes.push(`Adaptive thresholds adjusted from learned paper outcomes. Best=${top.key}`);

    await client.query(`
      INSERT INTO phantom_x_learning_state (key, value, confidence, sample_size, updated_at)
      VALUES ('opportunity_thresholds', $1, $2, $3, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        confidence = EXCLUDED.confidence,
        sample_size = EXCLUDED.sample_size,
        updated_at = NOW()
    `, [
      JSON.stringify({ watch, paper, avoid: 20, bestStrategy: top.key }),
      confidenceFromSamples(top.samples),
      top.samples,
    ]);
  }

  const walletRows = await client.query(`
    SELECT address, label, pnl, win_rate, volume, risk_score
    FROM phantom_x_wallets
    ORDER BY COALESCE(updated_at, created_at) DESC
    LIMIT 500
  `).catch(() => ({ rows: [] as any[] }));

  for (const wallet of walletRows.rows) {
    const pnl = safeNumber(wallet.pnl);
    const winRate = safeNumber(wallet.win_rate);
    const volume = safeNumber(wallet.volume);
    const risk = safeNumber(wallet.risk_score);

    const pnlScore = Math.max(0, Math.min(100, Math.log10(Math.abs(pnl) + 10) * 18));
    const consistencyScore = Math.max(0, Math.min(100, winRate * 100));
    const riskPenalty = Math.max(0, Math.min(35, risk));
    const score = Math.max(0, Math.min(100, pnlScore * 0.35 + consistencyScore * 0.45 + Math.log10(volume + 10) * 8 - riskPenalty));

    const copyPriority =
      score >= 80 ? "high_watch" :
      score >= 60 ? "watch" :
      score >= 40 ? "low_watch" :
      "ignore";

    await client.query(`
      INSERT INTO phantom_x_wallet_scores
        (wallet_address, score, pnl_score, consistency_score, risk_score, copy_priority, evidence, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (wallet_address) DO UPDATE SET
        score = EXCLUDED.score,
        pnl_score = EXCLUDED.pnl_score,
        consistency_score = EXCLUDED.consistency_score,
        risk_score = EXCLUDED.risk_score,
        copy_priority = EXCLUDED.copy_priority,
        evidence = EXCLUDED.evidence,
        updated_at = NOW()
    `, [
      wallet.address,
      score,
      pnlScore,
      consistencyScore,
      risk,
      copyPriority,
      JSON.stringify({ pnl, winRate, volume, label: wallet.label }),
    ]);

    stats.walletScoresUpdated++;
  }

  await client.query(`
    INSERT INTO phantom_x_learning_runs
      (status, markets_seen, opportunities_seen, paper_trades_seen, outcomes_created, strategies_updated, notes)
    VALUES
      ('completed', $1, $2, $3, $4, $5, $6)
  `, [
    stats.marketsSeen,
    stats.opportunitiesSeen,
    stats.paperTradesSeen,
    stats.outcomesCreated,
    stats.strategiesUpdated,
    stats.notes.join("; "),
  ]);

  await client.end();

  return {
    ok: true,
    mode: "paper_learning",
    stats,
    learnedAt: new Date().toISOString(),
  };
}

export async function getPhantomXLearningSnapshot() {
  const url = connectionString();
  if (!url) throw new Error("DATABASE_URL is not configured");

  const client = new Client({
    connectionString: url,
    ssl: url.includes("railway") || url.includes("rlwy") ? { rejectUnauthorized: false } : undefined,
  } as any);

  await client.connect();

  const state = await client.query(`
    SELECT key, value, confidence, sample_size, updated_at
    FROM phantom_x_learning_state
    ORDER BY key
  `).catch(() => ({ rows: [] as any[] }));

  const strategies = await client.query(`
    SELECT strategy_key, label, wins, losses, total_pnl, avg_pnl, win_rate, confidence, updated_at
    FROM phantom_x_strategy_memory
    ORDER BY confidence DESC, win_rate DESC, total_pnl DESC
    LIMIT 20
  `).catch(() => ({ rows: [] as any[] }));

  const runs = await client.query(`
    SELECT status, markets_seen, opportunities_seen, paper_trades_seen, outcomes_created, strategies_updated, notes, created_at
    FROM phantom_x_learning_runs
    ORDER BY created_at DESC
    LIMIT 10
  `).catch(() => ({ rows: [] as any[] }));

  const walletScores = await client.query(`
    SELECT wallet_address, score, pnl_score, consistency_score, risk_score, copy_priority, updated_at
    FROM phantom_x_wallet_scores
    ORDER BY score DESC
    LIMIT 20
  `).catch(() => ({ rows: [] as any[] }));

  await client.end();

  return {
    ok: true,
    state: state.rows,
    strategies: strategies.rows,
    runs: runs.rows,
    walletScores: walletScores.rows,
    generatedAt: new Date().toISOString(),
  };
}
