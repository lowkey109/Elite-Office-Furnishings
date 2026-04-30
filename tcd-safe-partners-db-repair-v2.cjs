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
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  console.log("== SAFE PARTNERS DB REPAIR V2 ==");
  console.log("NO DROP. NO DELETE. CREATE/ADD ONLY.");

  const createTables = [
    [
      "partners",
      `
      CREATE TABLE IF NOT EXISTS partners (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      );
      `
    ],
    [
      "partner_commissions",
      `
      CREATE TABLE IF NOT EXISTS partner_commissions (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      );
      `
    ],
    [
      "referrals",
      `
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      );
      `
    ],
    [
      "partner_referral_events",
      `
      CREATE TABLE IF NOT EXISTS partner_referral_events (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      );
      `
    ]
  ];

  for (const [label, sql] of createTables) {
    await q(client, sql, `create table ${label}`);
  }

  const addColumns = [
    // partners
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
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`,

    // partner_commissions
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS partner_id TEXT;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS referral_id TEXT;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS lead_id INTEGER;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS quote_id INTEGER;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS customer_name TEXT;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS customer_email TEXT;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS deal_value NUMERIC DEFAULT 0;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0.075;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS notes TEXT;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE partner_commissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`,

    // referrals
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS partner_id TEXT;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS customer_name TEXT;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS customer_email TEXT;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS customer_phone TEXT;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS company_name TEXT;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS estimated_value NUMERIC DEFAULT 0;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS notes TEXT;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE referrals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`,

    // partner_referral_events
    `ALTER TABLE partner_referral_events ADD COLUMN IF NOT EXISTS partner_id TEXT;`,
    `ALTER TABLE partner_referral_events ADD COLUMN IF NOT EXISTS referral_id TEXT;`,
    `ALTER TABLE partner_referral_events ADD COLUMN IF NOT EXISTS event_type TEXT;`,
    `ALTER TABLE partner_referral_events ADD COLUMN IF NOT EXISTS description TEXT;`,
    `ALTER TABLE partner_referral_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`,
    `ALTER TABLE partner_referral_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`
  ];

  for (const sql of addColumns) {
    await q(client, sql, sql.replace(/\s+/g, " ").trim());
  }

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);`,
    `CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_partner_id ON referrals(partner_id);`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);`,
    `CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner_id ON partner_commissions(partner_id);`,
    `CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);`,
    `CREATE INDEX IF NOT EXISTS idx_partner_referral_events_partner_id ON partner_referral_events(partner_id);`
  ];

  for (const sql of indexes) {
    await q(client, sql, sql.replace(/\s+/g, " ").trim());
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

  console.log("");
  console.log("== PARTNER TABLE COLUMNS ==");
  const cols = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('partners', 'partner_commissions', 'referrals', 'partner_referral_events')
    ORDER BY table_name, ordinal_position;
  `);

  for (const row of cols.rows) {
    console.log(`${row.table_name}.${row.column_name}`);
  }

  await client.end();

  console.log("");
  console.log("SAFE PARTNERS DB REPAIR V2 COMPLETE — no existing data deleted.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
