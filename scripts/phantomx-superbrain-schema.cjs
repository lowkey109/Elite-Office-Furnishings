const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS phantom_x_model_state (
      id SERIAL PRIMARY KEY,
      model_name TEXT UNIQUE NOT NULL,
      entry_threshold NUMERIC DEFAULT 72,
      watch_threshold NUMERIC DEFAULT 52,
      min_liquidity NUMERIC DEFAULT 500,
      min_volume NUMERIC DEFAULT 1000,
      risk_limit NUMERIC DEFAULT 55,
      win_rate NUMERIC DEFAULT 0,
      avg_return NUMERIC DEFAULT 0,
      false_positive_rate NUMERIC DEFAULT 0,
      sample_size INTEGER DEFAULT 0,
      metadata JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS phantom_x_feedback_events (
      id SERIAL PRIMARY KEY,
      market_id TEXT,
      decision_id INTEGER,
      decision TEXT,
      entry_price NUMERIC DEFAULT 0,
      future_price NUMERIC DEFAULT 0,
      price_delta NUMERIC DEFAULT 0,
      success BOOLEAN DEFAULT FALSE,
      horizon_minutes INTEGER DEFAULT 60,
      score NUMERIC DEFAULT 0,
      confidence NUMERIC DEFAULT 0,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS phantom_x_paper_positions (
      id SERIAL PRIMARY KEY,
      market_id TEXT,
      market_title TEXT,
      side TEXT DEFAULT 'YES',
      entry_price NUMERIC DEFAULT 0,
      current_price NUMERIC DEFAULT 0,
      quantity NUMERIC DEFAULT 0,
      notional NUMERIC DEFAULT 0,
      pnl NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'open',
      entry_score NUMERIC DEFAULT 0,
      confidence NUMERIC DEFAULT 0,
      reason TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    INSERT INTO phantom_x_model_state (model_name)
    VALUES ('phantomx-superbrain-v1')
    ON CONFLICT (model_name) DO NOTHING;

    CREATE INDEX IF NOT EXISTS idx_px_feedback_market ON phantom_x_feedback_events(market_id);
    CREATE INDEX IF NOT EXISTS idx_px_feedback_success ON phantom_x_feedback_events(success);
    CREATE INDEX IF NOT EXISTS idx_px_positions_status ON phantom_x_paper_positions(status);
  `);

  await client.end();
  console.log("Phantom X SuperBrain schema ready.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
