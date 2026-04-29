const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const sql = `
    CREATE TABLE IF NOT EXISTS phantom_x_learning_scores (
      id SERIAL PRIMARY KEY,
      market_id TEXT,
      score NUMERIC DEFAULT 0,
      confidence NUMERIC DEFAULT 0,
      edge NUMERIC DEFAULT 0,
      risk NUMERIC DEFAULT 0,
      liquidity_score NUMERIC DEFAULT 0,
      volume_score NUMERIC DEFAULT 0,
      price_score NUMERIC DEFAULT 0,
      momentum_score NUMERIC DEFAULT 0,
      decision TEXT DEFAULT 'WATCH',
      reason TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS phantom_x_market_outcomes (
      id SERIAL PRIMARY KEY,
      market_id TEXT UNIQUE,
      final_price NUMERIC DEFAULT 0,
      resolved BOOLEAN DEFAULT FALSE,
      outcome TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_phantom_x_learning_market ON phantom_x_learning_scores(market_id);
    CREATE INDEX IF NOT EXISTS idx_phantom_x_learning_score ON phantom_x_learning_scores(score);
  `;

  await client.query(sql);
  await client.end();
  console.log("Phantom X learning schema ready.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
