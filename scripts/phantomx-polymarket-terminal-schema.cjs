const { Client } = require("pg");

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

  const statements = [
    `CREATE TABLE IF NOT EXISTS phantom_x_markets (
      id TEXT PRIMARY KEY,
      question TEXT,
      slug TEXT,
      category TEXT,
      price NUMERIC DEFAULT 0,
      yes_price NUMERIC DEFAULT 0,
      no_price NUMERIC DEFAULT 0,
      liquidity NUMERIC DEFAULT 0,
      volume NUMERIC DEFAULT 0,
      active BOOLEAN DEFAULT TRUE,
      closed BOOLEAN DEFAULT FALSE,
      source_url TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS phantom_x_market_snapshots (
      id SERIAL PRIMARY KEY,
      market_id TEXT,
      price NUMERIC DEFAULT 0,
      liquidity NUMERIC DEFAULT 0,
      volume NUMERIC DEFAULT 0,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS phantom_x_wallets (
      id SERIAL PRIMARY KEY,
      address TEXT UNIQUE NOT NULL,
      label TEXT,
      source TEXT,
      score NUMERIC DEFAULT 0,
      pnl NUMERIC DEFAULT 0,
      win_rate NUMERIC DEFAULT 0,
      volume NUMERIC DEFAULT 0,
      risk_score NUMERIC DEFAULT 0,
      metadata JSONB DEFAULT '{}'::jsonb,
      last_seen_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS phantom_x_opportunities (
      id SERIAL PRIMARY KEY,
      market_id TEXT,
      title TEXT,
      score NUMERIC DEFAULT 0,
      confidence NUMERIC DEFAULT 0,
      thesis TEXT,
      evidence_summary TEXT,
      status TEXT DEFAULT 'watch',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS phantom_x_paper_trades (
      id SERIAL PRIMARY KEY,
      market_id TEXT,
      market_title TEXT,
      side TEXT,
      entry_price NUMERIC DEFAULT 0,
      current_price NUMERIC DEFAULT 0,
      pnl NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'open',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS phantom_x_decisions (
      id SERIAL PRIMARY KEY,
      market_id TEXT,
      decision TEXT,
      reason TEXT,
      confidence NUMERIC DEFAULT 0,
      evidence JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    );`,

    `CREATE INDEX IF NOT EXISTS idx_phantom_x_markets_volume ON phantom_x_markets(volume);`,
    `CREATE INDEX IF NOT EXISTS idx_phantom_x_markets_updated ON phantom_x_markets(updated_at);`,
    `CREATE INDEX IF NOT EXISTS idx_phantom_x_wallets_score ON phantom_x_wallets(score);`,
    `CREATE INDEX IF NOT EXISTS idx_phantom_x_opportunities_score ON phantom_x_opportunities(score);`,
    `CREATE INDEX IF NOT EXISTS idx_phantom_x_paper_trades_status ON phantom_x_paper_trades(status);`,
    `CREATE INDEX IF NOT EXISTS idx_phantom_x_decisions_created ON phantom_x_decisions(created_at);`
  ];

  console.log("== Safe Phantom X schema ==");
  console.log("CREATE/ADD ONLY. NO DROP. NO DELETE.");

  for (const sql of statements) {
    await client.query(sql);
    console.log("OK:", sql.split("\n")[0].trim());
  }

  await client.end();
  console.log("Schema ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
