const { Client } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing. Add DATABASE_URL in Replit Secrets or run this where DATABASE_URL exists.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  console.log("== SAFE LIVE DB REPAIR ==");
  console.log("NO DROP. NO DELETE. CREATE/ADD ONLY.");

  const statements = [
    `
    CREATE TABLE IF NOT EXISTS site_visits (
      id SERIAL PRIMARY KEY,
      visitor_id TEXT,
      session_id TEXT,
      path TEXT,
      page TEXT,
      referrer TEXT,
      user_agent TEXT,
      ip_address TEXT,
      city TEXT,
      region TEXT,
      country TEXT,
      device_type TEXT,
      browser TEXT,
      source TEXT,
      medium TEXT,
      campaign TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    `,

    `
    CREATE TABLE IF NOT EXISTS visitor_sessions (
      id SERIAL PRIMARY KEY,
      visitor_id TEXT,
      session_id TEXT,
      started_at TIMESTAMP DEFAULT NOW(),
      last_seen_at TIMESTAMP DEFAULT NOW(),
      path TEXT,
      referrer TEXT,
      user_agent TEXT,
      ip_address TEXT,
      city TEXT,
      region TEXT,
      country TEXT,
      device_type TEXT,
      browser TEXT,
      source TEXT,
      medium TEXT,
      campaign TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    `,

    `
    CREATE TABLE IF NOT EXISTS partner_commissions (
      id SERIAL PRIMARY KEY,
      partner_id TEXT,
      referral_id TEXT,
      lead_id INTEGER,
      quote_id INTEGER,
      customer_name TEXT,
      customer_email TEXT,
      deal_value NUMERIC DEFAULT 0,
      commission_rate NUMERIC DEFAULT 0.075,
      commission_amount NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    `,

    `
    CREATE TABLE IF NOT EXISTS territories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      state TEXT,
      country TEXT DEFAULT 'Australia',
      status TEXT DEFAULT 'active',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    `,

    `
    CREATE TABLE IF NOT EXISTS territory_buildings (
      id SERIAL PRIMARY KEY,
      territory_id INTEGER,
      building_name TEXT,
      address TEXT,
      suburb TEXT,
      city TEXT,
      state TEXT,
      postcode TEXT,
      tenant_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    `
  ];

  for (const sql of statements) {
    await client.query(sql);
  }

  const alterStatements = [
    `ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS visitor_id TEXT;`,
    `ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS session_id TEXT;`,
    `ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS path TEXT;`,
    `ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS page TEXT;`,
    `ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS referrer TEXT;`,
    `ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS user_agent TEXT;`,
    `ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS ip_address TEXT;`,
    `ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`,

    `ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS visitor_id TEXT;`,
    `ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS session_id TEXT;`,
    `ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMP DEFAULT NOW();`,
    `ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NOW();`,
    `ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`,

    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS partner_id TEXT;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS referral_id TEXT;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS lead_id INTEGER;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS quote_id INTEGER;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS deal_value NUMERIC DEFAULT 0;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0.075;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`
  ];

  for (const sql of alterStatements) {
    await client.query(sql);
  }

  const indexStatements = [
    `CREATE INDEX IF NOT EXISTS idx_site_visits_created_at ON site_visits(created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_site_visits_visitor_id ON site_visits(visitor_id);`,
    `CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_id ON visitor_sessions(visitor_id);`,
    `CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);`,
    `CREATE INDEX IF NOT EXISTS idx_territory_buildings_territory_id ON territory_buildings(territory_id);`
  ];

  for (const sql of indexStatements) {
    await client.query(sql);
  }

  const checkTables = [
    "site_visits",
    "visitor_sessions",
    "partner_commissions",
    "territories",
    "territory_buildings",
    "phantom_x_signals",
    "phantom_x_opportunities",
    "phantom_x_trades",
    "phantom_x_positions",
    "nexora_runs",
    "nexora_decisions",
    "deal_hunter_signals",
    "office_move_radar"
  ];

  console.log("");
  console.log("== TABLE CHECK ==");
  for (const table of checkTables) {
    const r = await client.query("SELECT to_regclass($1) AS exists", [`public.${table}`]);
    console.log(table, r.rows[0].exists ? "OK" : "MISSING");
  }

  await client.end();

  console.log("");
  console.log("SAFE DB REPAIR COMPLETE — no existing data deleted.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
