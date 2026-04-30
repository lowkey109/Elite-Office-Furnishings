const { Client } = require("pg");

async function q(client, sql, label) {
  try {
    await client.query(sql);
    console.log("OK:", label);
  } catch (err) {
    console.error("FAILED:", label);
    console.error(err.message);
    throw err;
  }
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log("== PHANTOM X LEARNING COLUMN REPAIR ==");
  console.log("NO DROP. NO DELETE. ADD COLUMNS ONLY.");

  await q(client, `
    CREATE TABLE IF NOT EXISTS phantom_x_learning_state (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `, "create phantom_x_learning_state");

  await q(client, `
    CREATE TABLE IF NOT EXISTS phantom_x_strategy_memory (
      id SERIAL PRIMARY KEY,
      strategy_key TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `, "create phantom_x_strategy_memory");

  await q(client, `
    CREATE TABLE IF NOT EXISTS phantom_x_outcomes (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `, "create phantom_x_outcomes");

  await q(client, `
    CREATE TABLE IF NOT EXISTS phantom_x_learning_runs (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `, "create phantom_x_learning_runs");

  await q(client, `
    CREATE TABLE IF NOT EXISTS phantom_x_wallet_scores (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `, "create phantom_x_wallet_scores");

  const alters = [
    `ALTER TABLE phantom_x_learning_state ADD COLUMN IF NOT EXISTS key TEXT;`,
    `ALTER TABLE phantom_x_learning_state ADD COLUMN IF NOT EXISTS value JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE phantom_x_learning_state ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0;`,
    `ALTER TABLE phantom_x_learning_state ADD COLUMN IF NOT EXISTS sample_size INTEGER DEFAULT 0;`,
    `ALTER TABLE phantom_x_learning_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`,

    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS strategy_key TEXT;`,
    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS label TEXT;`,
    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS total_signals INTEGER DEFAULT 0;`,
    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS total_outcomes INTEGER DEFAULT 0;`,
    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0;`,
    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0;`,
    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS win_rate NUMERIC DEFAULT 0;`,
    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS total_pnl NUMERIC DEFAULT 0;`,
    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS avg_confidence NUMERIC DEFAULT 0;`,
    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS notes TEXT;`,
    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE phantom_x_strategy_memory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`,

    `ALTER TABLE phantom_x_outcomes ADD COLUMN IF NOT EXISTS source_table TEXT;`,
    `ALTER TABLE phantom_x_outcomes ADD COLUMN IF NOT EXISTS source_id TEXT;`,
    `ALTER TABLE phantom_x_outcomes ADD COLUMN IF NOT EXISTS strategy_key TEXT;`,
    `ALTER TABLE phantom_x_outcomes ADD COLUMN IF NOT EXISTS market_key TEXT;`,
    `ALTER TABLE phantom_x_outcomes ADD COLUMN IF NOT EXISTS decision TEXT;`,
    `ALTER TABLE phantom_x_outcomes ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0;`,
    `ALTER TABLE phantom_x_outcomes ADD COLUMN IF NOT EXISTS pnl NUMERIC DEFAULT 0;`,
    `ALTER TABLE phantom_x_outcomes ADD COLUMN IF NOT EXISTS outcome TEXT;`,
    `ALTER TABLE phantom_x_outcomes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`,

    `ALTER TABLE phantom_x_learning_runs ADD COLUMN IF NOT EXISTS run_type TEXT DEFAULT 'old_memory_import';`,
    `ALTER TABLE phantom_x_learning_runs ADD COLUMN IF NOT EXISTS summary JSONB DEFAULT '{}'::jsonb;`,

    `ALTER TABLE phantom_x_wallet_scores ADD COLUMN IF NOT EXISTS wallet_address TEXT;`,
    `ALTER TABLE phantom_x_wallet_scores ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 0;`,
    `ALTER TABLE phantom_x_wallet_scores ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0;`,
    `ALTER TABLE phantom_x_wallet_scores ADD COLUMN IF NOT EXISTS sample_size INTEGER DEFAULT 0;`,
    `ALTER TABLE phantom_x_wallet_scores ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE phantom_x_wallet_scores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`,
  ];

  for (const sql of alters) {
    await q(client, sql, sql.replace(/\s+/g, " ").trim());
  }

  const indexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_phantom_x_learning_state_key_unique ON phantom_x_learning_state(key);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_phantom_x_strategy_memory_key_unique ON phantom_x_strategy_memory(strategy_key);`,
    `CREATE INDEX IF NOT EXISTS idx_phantom_x_outcomes_strategy_key ON phantom_x_outcomes(strategy_key);`,
    `CREATE INDEX IF NOT EXISTS idx_phantom_x_outcomes_source ON phantom_x_outcomes(source_table, source_id);`,
    `CREATE INDEX IF NOT EXISTS idx_phantom_x_learning_runs_created ON phantom_x_learning_runs(created_at);`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_phantom_x_wallet_scores_wallet_unique ON phantom_x_wallet_scores(wallet_address);`,
  ];

  for (const sql of indexes) {
    await q(client, sql, sql.replace(/\s+/g, " ").trim());
  }

  console.log("");
  console.log("== COLUMN CHECK ==");
  const r = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'phantom_x_learning_state',
        'phantom_x_strategy_memory',
        'phantom_x_outcomes',
        'phantom_x_learning_runs',
        'phantom_x_wallet_scores'
      )
    ORDER BY table_name, ordinal_position
  `);

  for (const row of r.rows) {
    console.log(row.table_name + "." + row.column_name);
  }

  await client.end();
  console.log("");
  console.log("DONE — learning columns repaired.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
