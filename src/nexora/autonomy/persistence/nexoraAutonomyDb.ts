import { Pool, QueryResult } from 'pg';

let pool: Pool | null = null;

export function nexoraHasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PGHOST);
}

export function getNexoraPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  pool = connectionString
    ? new Pool({
        connectionString,
        ssl: process.env.NEXORA_PG_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: Number(process.env.NEXORA_PG_POOL_MAX || 10),
      })
    : new Pool({
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        max: Number(process.env.NEXORA_PG_POOL_MAX || 10),
      });

  pool.on('error', (err) => {
    console.error('[NEXORA_DB_POOL_ERROR]', err);
  });

  return pool;
}

export async function nexoraQuery<T = any>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
  if (!nexoraHasDatabase()) {
    throw new Error('Nexora persistence requires DATABASE_URL, POSTGRES_URL, or PG* environment variables.');
  }

  return getNexoraPool().query<T>(sql, params);
}

export async function ensureNexoraAutonomySchema(): Promise<void> {
  if (!nexoraHasDatabase()) {
    console.warn('[NEXORA_PERSISTENCE] Database env not found. Persistent autonomy is unavailable in this runtime.');
    return;
  }

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_autonomy_tasks (
      id TEXT PRIMARY KEY,
      queue_name TEXT NOT NULL DEFAULT 'nexora.autonomy.default',
      worker_key TEXT NOT NULL,
      division TEXT NOT NULL,
      kind TEXT NOT NULL,
      risk TEXT NOT NULL CHECK (risk IN ('low','medium','high','critical')),
      priority INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL CHECK (status IN ('queued','approval_required','running','completed','failed','dead','cancelled','timeout')),
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      result JSONB,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      locked_until TIMESTAMPTZ,
      approval_required BOOLEAN NOT NULL DEFAULT false,
      approval_id TEXT,
      source TEXT NOT NULL DEFAULT 'nexora',
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_tasks_status_priority
      ON nexora_autonomy_tasks(status, priority DESC, scheduled_at ASC);
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_tasks_worker_status
      ON nexora_autonomy_tasks(worker_key, status);
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_autonomy_approvals (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      risk TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','expired')),
      requested_by TEXT NOT NULL DEFAULT 'nexora',
      decided_by TEXT,
      decision_note TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      decided_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_approvals_status
      ON nexora_autonomy_approvals(status, created_at DESC);
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_autonomy_reports (
      id TEXT PRIMARY KEY,
      report_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_reports_type_created
      ON nexora_autonomy_reports(report_type, created_at DESC);
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_worker_state (
      worker_key TEXT PRIMARY KEY,
      division TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      current_task_id TEXT,
      total_tasks INTEGER NOT NULL DEFAULT 0,
      successful_tasks INTEGER NOT NULL DEFAULT 0,
      failed_tasks INTEGER NOT NULL DEFAULT 0,
      timeout_tasks INTEGER NOT NULL DEFAULT 0,
      retired_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_worker_state_division_status
      ON nexora_worker_state(division, status);
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_worker_scores (
      id TEXT PRIMARY KEY,
      worker_key TEXT NOT NULL,
      division TEXT NOT NULL,
      task_id TEXT,
      success BOOLEAN NOT NULL,
      duration_ms INTEGER,
      risk TEXT,
      signal TEXT NOT NULL DEFAULT 'execution',
      weight NUMERIC NOT NULL DEFAULT 1,
      score_delta NUMERIC NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_worker_scores_worker_created
      ON nexora_worker_scores(worker_key, created_at DESC);
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_operating_memory (
      id TEXT PRIMARY KEY,
      memory_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      importance INTEGER NOT NULL DEFAULT 50,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_memory_subject_created
      ON nexora_operating_memory(subject, created_at DESC);
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_loop_runs (
      id TEXT PRIMARY KEY,
      loop_name TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ,
      duration_ms INTEGER,
      summary TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_loop_runs_name_started
      ON nexora_loop_runs(loop_name, started_at DESC);
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_dead_letters (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      worker_key TEXT NOT NULL,
      reason TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export function nexoraId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 12);
  return `${prefix}_${stamp}_${rand}`;
}
