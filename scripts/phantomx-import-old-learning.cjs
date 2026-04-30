const { Client } = require("pg");

function json(v) {
  return JSON.stringify(v ?? {});
}

async function tableExists(client, table) {
  const r = await client.query("SELECT to_regclass($1) AS exists", [`public.${table}`]);
  return Boolean(r.rows[0]?.exists);
}

async function safeRows(client, table, limit = 500) {
  if (!(await tableExists(client, table))) return [];
  const r = await client.query(`SELECT * FROM ${table} ORDER BY id DESC LIMIT ${Number(limit)}`);
  return r.rows;
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    (process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER
      ? `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD || ""}@${process.env.PGHOST}:${process.env.PGPORT || "5432"}/${process.env.PGDATABASE}`
      : "");

  if (!connectionString) throw new Error("No database connection found");

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("railway") || connectionString.includes("rlwy")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();

  console.log("== PHANTOM X OLD LEARNING IMPORT ==");
  console.log("NO DROP. NO DELETE. READ OLD DATA -> UPSERT NEW MEMORY.");

  await client.query(`
    CREATE TABLE IF NOT EXISTS phantom_x_learning_state (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value JSONB DEFAULT '{}'::jsonb,
      confidence NUMERIC DEFAULT 0,
      sample_size INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS phantom_x_strategy_memory (
      id SERIAL PRIMARY KEY,
      strategy_key TEXT UNIQUE NOT NULL,
      label TEXT,
      total_signals INTEGER DEFAULT 0,
      total_outcomes INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      win_rate NUMERIC DEFAULT 0,
      total_pnl NUMERIC DEFAULT 0,
      avg_confidence NUMERIC DEFAULT 0,
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS phantom_x_outcomes (
      id SERIAL PRIMARY KEY,
      source_table TEXT,
      source_id TEXT,
      strategy_key TEXT,
      market_key TEXT,
      decision TEXT,
      confidence NUMERIC DEFAULT 0,
      pnl NUMERIC DEFAULT 0,
      outcome TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS phantom_x_learning_runs (
      id SERIAL PRIMARY KEY,
      run_type TEXT DEFAULT 'old_memory_import',
      summary JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS phantom_x_wallet_scores (
      id SERIAL PRIMARY KEY,
      wallet_address TEXT UNIQUE,
      score NUMERIC DEFAULT 0,
      confidence NUMERIC DEFAULT 0,
      sample_size INTEGER DEFAULT 0,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const oldSignals = await safeRows(client, "phantom_x_signals", 1000);
  const oldOpps = await safeRows(client, "phantom_x_opportunities", 1000);
  const oldTrades = await safeRows(client, "phantom_x_trades", 1000);
  const oldPositions = await safeRows(client, "phantom_x_positions", 1000);
  const nexoraDecisions = await safeRows(client, "nexora_decisions", 1000);

  console.log("old phantom_x_signals:", oldSignals.length);
  console.log("old phantom_x_opportunities:", oldOpps.length);
  console.log("old phantom_x_trades:", oldTrades.length);
  console.log("old phantom_x_positions:", oldPositions.length);
  console.log("old nexora_decisions:", nexoraDecisions.length);

  const allRows = [
    ...oldSignals.map(r => ({ source: "phantom_x_signals", row: r })),
    ...oldOpps.map(r => ({ source: "phantom_x_opportunities", row: r })),
    ...oldTrades.map(r => ({ source: "phantom_x_trades", row: r })),
    ...oldPositions.map(r => ({ source: "phantom_x_positions", row: r })),
    ...nexoraDecisions.map(r => ({ source: "nexora_decisions", row: r })),
  ];

  const strategy = new Map();

  function strategyKey(source, r) {
    const raw =
      r.strategy_key ||
      r.strategy ||
      r.signal_type ||
      r.type ||
      r.category ||
      r.market_type ||
      source;

    return String(raw || source)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || source;
  }

  for (const { source, row } of allRows) {
    const key = strategyKey(source, row);

    const confidence =
      Number(row.confidence ?? row.score ?? row.probability ?? row.win_probability ?? 0) || 0;

    const pnl =
      Number(row.pnl ?? row.profit_loss ?? row.paper_pnl ?? row.realized_pnl ?? row.unrealized_pnl ?? 0) || 0;

    const decision =
      row.decision ||
      row.action ||
      row.recommendation ||
      row.status ||
      "WATCH";

    const outcome =
      pnl > 0 ? "win" :
      pnl < 0 ? "loss" :
      String(row.outcome || row.result || row.status || "unknown").toLowerCase();

    if (!strategy.has(key)) {
      strategy.set(key, {
        key,
        label: key.replace(/_/g, " ").toUpperCase(),
        total_signals: 0,
        total_outcomes: 0,
        wins: 0,
        losses: 0,
        total_pnl: 0,
        confidence_sum: 0,
        examples: [],
      });
    }

    const s = strategy.get(key);
    s.total_signals += 1;
    s.confidence_sum += confidence;

    if (outcome.includes("win") || pnl > 0) {
      s.total_outcomes += 1;
      s.wins += 1;
    } else if (outcome.includes("loss") || pnl < 0) {
      s.total_outcomes += 1;
      s.losses += 1;
    }

    s.total_pnl += pnl;

    if (s.examples.length < 5) {
      s.examples.push({
        source,
        id: row.id,
        decision,
        confidence,
        pnl,
        outcome,
      });
    }

    await client.query(
      `
      INSERT INTO phantom_x_outcomes
        (source_table, source_id, strategy_key, market_key, decision, confidence, pnl, outcome, metadata)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      `,
      [
        source,
        String(row.id ?? ""),
        key,
        String(row.market_key || row.market_id || row.slug || row.question || row.title || ""),
        String(decision),
        confidence,
        pnl,
        String(outcome),
        json(row),
      ]
    );
  }

  for (const s of strategy.values()) {
    const winRate = s.total_outcomes ? s.wins / s.total_outcomes : 0;
    const avgConfidence = s.total_signals ? s.confidence_sum / s.total_signals : 0;

    await client.query(
      `
      INSERT INTO phantom_x_strategy_memory
        (strategy_key, label, total_signals, total_outcomes, wins, losses, win_rate, total_pnl, avg_confidence, notes, metadata, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW())
      ON CONFLICT (strategy_key)
      DO UPDATE SET
        label = EXCLUDED.label,
        total_signals = GREATEST(phantom_x_strategy_memory.total_signals, EXCLUDED.total_signals),
        total_outcomes = GREATEST(phantom_x_strategy_memory.total_outcomes, EXCLUDED.total_outcomes),
        wins = GREATEST(phantom_x_strategy_memory.wins, EXCLUDED.wins),
        losses = GREATEST(phantom_x_strategy_memory.losses, EXCLUDED.losses),
        win_rate = EXCLUDED.win_rate,
        total_pnl = EXCLUDED.total_pnl,
        avg_confidence = EXCLUDED.avg_confidence,
        notes = EXCLUDED.notes,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      `,
      [
        s.key,
        s.label,
        s.total_signals,
        s.total_outcomes,
        s.wins,
        s.losses,
        winRate,
        s.total_pnl,
        avgConfidence,
        "Imported from old Phantom X / Trading Monitor memory. Do not retrain from zero.",
        json({ examples: s.examples }),
      ]
    );
  }

  const summary = {
    importedRows: allRows.length,
    strategies: strategy.size,
    sources: {
      phantom_x_signals: oldSignals.length,
      phantom_x_opportunities: oldOpps.length,
      phantom_x_trades: oldTrades.length,
      phantom_x_positions: oldPositions.length,
      nexora_decisions: nexoraDecisions.length,
    },
  };

  await client.query(
    `
    INSERT INTO phantom_x_learning_state
      (key, value, confidence, sample_size, updated_at)
    VALUES
      ('legacy_trading_memory_import', $1::jsonb, $2, $3, NOW())
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      confidence = EXCLUDED.confidence,
      sample_size = EXCLUDED.sample_size,
      updated_at = NOW()
    `,
    [json(summary), strategy.size ? 0.85 : 0, allRows.length]
  );

  await client.query(
    `
    INSERT INTO phantom_x_learning_runs
      (run_type, summary)
    VALUES
      ('legacy_trading_memory_import', $1::jsonb)
    `,
    [json(summary)]
  );

  console.log("== IMPORT SUMMARY ==");
  console.log(JSON.stringify(summary, null, 2));

  await client.end();

  console.log("DONE — old trading knowledge has been bridged into Phantom X learning memory.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
