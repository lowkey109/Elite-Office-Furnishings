const { Client } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  console.log("== SAFE PARTNERS DB REPAIR ==");
  console.log("NO DROP. NO DELETE. CREATE/ADD ONLY.");

  const statements = [
    `
    CREATE TABLE IF NOT EXISTS partners (
      id SERIAL PRIMARY KEY,
      name TEXT,
      company_name TEXT,
      email TEXT,
      phone TEXT,
      status TEXT DEFAULT 'active',
      partner_type TEXT DEFAULT 'referral',
      commission_rate NUMERIC DEFAULT 0.075,
      total_referrals INTEGER DEFAULT 0,
      total_commission NUMERIC DEFAULT 0,
      notes TEXT,
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
    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      partner_id TEXT,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      company_name TEXT,
      status TEXT DEFAULT 'new',
      estimated_value NUMERIC DEFAULT 0,
      notes TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    `,

    `
    CREATE TABLE IF NOT EXISTS partner_referral_events (
      id SERIAL PRIMARY KEY,
      partner_id TEXT,
      referral_id TEXT,
      event_type TEXT,
      description TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    `
  ];

  for (const sql of statements) {
    await client.query(sql);
  }

  const alters = [
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS name TEXT;`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS company_name TEXT;`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS email TEXT;`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS phone TEXT;`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_type TEXT DEFAULT 'referral';`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0.075;`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0;`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS total_commission NUMERIC DEFAULT 0;`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS notes TEXT;`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`,

    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS partner_id TEXT;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS customer_name TEXT;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS customer_email TEXT;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS customer_phone TEXT;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS company_name TEXT;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS estimated_value NUMERIC DEFAULT 0;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`
  ];

  for (const sql of alters) {
    await client.query(sql);
  }

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);`,
    `CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_partner_id ON referrals(partner_id);`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);`,
    `CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner_id ON partner_commissions(partner_id);`,
    `CREATE INDEX IF NOT EXISTS idx_partner_referral_events_partner_id ON partner_referral_events(partner_id);`
  ];

  for (const sql of indexes) {
    await client.query(sql);
  }

  const tables = [
    "partners",
    "partner_commissions",
    "referrals",
    "partner_referral_events",
    "site_visits",
    "visitor_sessions",
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
  for (const table of tables) {
    const r = await client.query("SELECT to_regclass($1) AS exists", [`public.${table}`]);
    console.log(table, r.rows[0].exists ? "OK" : "MISSING");
  }

  await client.end();
  console.log("");
  console.log("SAFE PARTNERS DB REPAIR COMPLETE");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
