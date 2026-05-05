#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "NEXORA BUILD: PERSISTENCE + DURABLE AUTONOMOUS EXECUTION"
echo "============================================================"

ROOT_DIR="$(pwd)"
DOMAIN="${NEXORA_DOMAIN:-https://www.thecorporatedesk.au}"

echo "Working directory: $ROOT_DIR"
echo "Target domain: $DOMAIN"

echo "Installing durable queue dependencies..."
npm install pg pg-boss
npm install -D @types/pg

mkdir -p src/nexora/autonomy/persistence
mkdir -p src/nexora/autonomy/loops
mkdir -p src/nexora/autonomy/routes
mkdir -p scripts

cat > src/nexora/autonomy/persistence/nexoraAutonomyTypes.ts <<'TS'
export type NexoraAutonomyRisk = 'low' | 'medium' | 'high' | 'critical';
export type NexoraTaskStatus =
  | 'queued'
  | 'approval_required'
  | 'running'
  | 'completed'
  | 'failed'
  | 'dead'
  | 'cancelled'
  | 'timeout';

export type NexoraApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type NexoraWorkerStatus = 'online' | 'idle' | 'busy' | 'degraded' | 'dead' | 'retired';

export interface NexoraDurableTaskInput {
  workerKey: string;
  division: string;
  kind: string;
  risk: NexoraAutonomyRisk;
  priority?: number;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  scheduledAt?: string;
  approvalRequired?: boolean;
  source?: string;
}

export interface NexoraDurableTask {
  id: string;
  queueName: string;
  workerKey: string;
  division: string;
  kind: string;
  risk: NexoraAutonomyRisk;
  priority: number;
  status: NexoraTaskStatus;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  lockedUntil?: string | null;
  approvalRequired: boolean;
  approvalId?: string | null;
  source: string;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NexoraWorkerHeartbeatInput {
  workerKey: string;
  division: string;
  status?: NexoraWorkerStatus;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface NexoraWorkerScoreInput {
  workerKey: string;
  division: string;
  taskId?: string;
  success: boolean;
  durationMs?: number;
  risk?: NexoraAutonomyRisk;
  signal?: string;
  weight?: number;
}
TS

cat > src/nexora/autonomy/persistence/nexoraAutonomyDb.ts <<'TS'
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
TS

cat > src/nexora/autonomy/persistence/nexoraDurableAutonomyStore.ts <<'TS'
import { ensureNexoraAutonomySchema, nexoraHasDatabase, nexoraId, nexoraQuery } from './nexoraAutonomyDb';
import {
  NexoraAutonomyRisk,
  NexoraDurableTask,
  NexoraDurableTaskInput,
  NexoraWorkerHeartbeatInput,
  NexoraWorkerScoreInput,
} from './nexoraAutonomyTypes';

const HIGH_RISK: NexoraAutonomyRisk[] = ['high', 'critical'];

export async function initializeNexoraDurableAutonomy(): Promise<{ ok: boolean; persistent: boolean; message: string }> {
  await ensureNexoraAutonomySchema();

  return {
    ok: true,
    persistent: nexoraHasDatabase(),
    message: nexoraHasDatabase()
      ? 'Nexora durable autonomy schema is ready.'
      : 'Nexora durable autonomy schema skipped because database environment is unavailable.',
  };
}

export async function createNexoraDurableTask(input: NexoraDurableTaskInput): Promise<NexoraDurableTask> {
  await ensureNexoraAutonomySchema();

  const id = nexoraId('task');
  const approvalRequired = Boolean(input.approvalRequired || HIGH_RISK.includes(input.risk));
  const status = approvalRequired ? 'approval_required' : 'queued';
  const approvalId = approvalRequired ? nexoraId('approval') : null;

  const taskResult = await nexoraQuery<NexoraDurableTask>(
    `
      INSERT INTO nexora_autonomy_tasks (
        id, queue_name, worker_key, division, kind, risk, priority, status,
        payload, max_attempts, scheduled_at, approval_required, approval_id, source
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,COALESCE($11::timestamptz, now()),$12,$13,$14)
      RETURNING
        id,
        queue_name as "queueName",
        worker_key as "workerKey",
        division,
        kind,
        risk,
        priority,
        status,
        payload,
        attempts,
        max_attempts as "maxAttempts",
        scheduled_at as "scheduledAt",
        locked_until as "lockedUntil",
        approval_required as "approvalRequired",
        approval_id as "approvalId",
        source,
        last_error as "lastError",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `,
    [
      id,
      'nexora.autonomy.default',
      input.workerKey,
      input.division,
      input.kind,
      input.risk,
      input.priority ?? 50,
      status,
      JSON.stringify(input.payload || {}),
      input.maxAttempts ?? 3,
      input.scheduledAt || null,
      approvalRequired,
      approvalId,
      input.source || 'nexora',
    ],
  );

  if (approvalRequired && approvalId) {
    await nexoraQuery(
      `
        INSERT INTO nexora_autonomy_approvals (id, task_id, risk, reason, status, payload, expires_at)
        VALUES ($1,$2,$3,$4,'pending',$5::jsonb, now() + interval '7 days')
      `,
      [
        approvalId,
        id,
        input.risk,
        `Nexora execution gate requires approval for ${input.risk} risk task ${input.kind}.`,
        JSON.stringify(input.payload || {}),
      ],
    );
  }

  await writeNexoraMemory('task.created', input.workerKey, 60, {
    taskId: id,
    status,
    division: input.division,
    kind: input.kind,
    risk: input.risk,
  });

  return taskResult.rows[0];
}

export async function approveNexoraTask(approvalId: string, decidedBy = 'nexora-admin', note = 'Approved.'): Promise<void> {
  await ensureNexoraAutonomySchema();

  await nexoraQuery(
    `
      UPDATE nexora_autonomy_approvals
      SET status = 'approved', decided_by = $2, decision_note = $3, decided_at = now()
      WHERE id = $1 AND status = 'pending'
    `,
    [approvalId, decidedBy, note],
  );

  await nexoraQuery(
    `
      UPDATE nexora_autonomy_tasks
      SET status = 'queued', updated_at = now()
      WHERE approval_id = $1 AND status = 'approval_required'
    `,
    [approvalId],
  );
}

export async function rejectNexoraTask(approvalId: string, decidedBy = 'nexora-admin', note = 'Rejected.'): Promise<void> {
  await ensureNexoraAutonomySchema();

  await nexoraQuery(
    `
      UPDATE nexora_autonomy_approvals
      SET status = 'rejected', decided_by = $2, decision_note = $3, decided_at = now()
      WHERE id = $1 AND status = 'pending'
    `,
    [approvalId, decidedBy, note],
  );

  await nexoraQuery(
    `
      UPDATE nexora_autonomy_tasks
      SET status = 'cancelled', updated_at = now(), last_error = $2
      WHERE approval_id = $1 AND status = 'approval_required'
    `,
    [approvalId, note],
  );
}

export async function heartbeatNexoraWorker(input: NexoraWorkerHeartbeatInput): Promise<void> {
  await ensureNexoraAutonomySchema();

  await nexoraQuery(
    `
      INSERT INTO nexora_worker_state (
        worker_key, division, status, capabilities, metadata, last_heartbeat_at, updated_at
      )
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,now(),now())
      ON CONFLICT (worker_key)
      DO UPDATE SET
        division = EXCLUDED.division,
        status = EXCLUDED.status,
        capabilities = EXCLUDED.capabilities,
        metadata = nexora_worker_state.metadata || EXCLUDED.metadata,
        last_heartbeat_at = now(),
        updated_at = now(),
        retired_at = NULL
    `,
    [
      input.workerKey,
      input.division,
      input.status || 'idle',
      JSON.stringify(input.capabilities || []),
      JSON.stringify(input.metadata || {}),
    ],
  );
}

export async function claimNextNexoraTask(lockMs = 120000): Promise<NexoraDurableTask | null> {
  await ensureNexoraAutonomySchema();

  const result = await nexoraQuery<NexoraDurableTask>(
    `
      WITH next_task AS (
        SELECT id
        FROM nexora_autonomy_tasks
        WHERE status = 'queued'
          AND scheduled_at <= now()
        ORDER BY priority DESC, scheduled_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE nexora_autonomy_tasks t
      SET
        status = 'running',
        attempts = attempts + 1,
        locked_until = now() + ($1::text || ' milliseconds')::interval,
        updated_at = now()
      FROM next_task
      WHERE t.id = next_task.id
      RETURNING
        t.id,
        t.queue_name as "queueName",
        t.worker_key as "workerKey",
        t.division,
        t.kind,
        t.risk,
        t.priority,
        t.status,
        t.payload,
        t.attempts,
        t.max_attempts as "maxAttempts",
        t.scheduled_at as "scheduledAt",
        t.locked_until as "lockedUntil",
        t.approval_required as "approvalRequired",
        t.approval_id as "approvalId",
        t.source,
        t.last_error as "lastError",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt"
    `,
    [lockMs],
  );

  const task = result.rows[0] || null;

  if (task) {
    await nexoraQuery(
      `
        UPDATE nexora_worker_state
        SET status = 'busy', current_task_id = $2, updated_at = now(), last_heartbeat_at = now()
        WHERE worker_key = $1
      `,
      [task.workerKey, task.id],
    );
  }

  return task;
}

export async function completeNexoraTask(taskId: string, result: Record<string, unknown>): Promise<void> {
  await ensureNexoraAutonomySchema();

  const task = await nexoraQuery<{ workerKey: string; division: string }>(
    `
      UPDATE nexora_autonomy_tasks
      SET status = 'completed', result = $2::jsonb, locked_until = NULL, updated_at = now()
      WHERE id = $1
      RETURNING worker_key as "workerKey", division
    `,
    [taskId, JSON.stringify(result)],
  );

  const row = task.rows[0];

  if (row) {
    await nexoraQuery(
      `
        UPDATE nexora_worker_state
        SET status = 'idle',
            current_task_id = NULL,
            total_tasks = total_tasks + 1,
            successful_tasks = successful_tasks + 1,
            updated_at = now(),
            last_heartbeat_at = now()
        WHERE worker_key = $1
      `,
      [row.workerKey],
    );

    await scoreNexoraWorker({
      workerKey: row.workerKey,
      division: row.division,
      taskId,
      success: true,
      signal: 'task.completed',
      weight: 1,
    });
  }
}

export async function failNexoraTask(taskId: string, error: string): Promise<void> {
  await ensureNexoraAutonomySchema();

  const taskResult = await nexoraQuery<{
    id: string;
    workerKey: string;
    division: string;
    attempts: number;
    maxAttempts: number;
    payload: Record<string, unknown>;
  }>(
    `
      SELECT
        id,
        worker_key as "workerKey",
        division,
        attempts,
        max_attempts as "maxAttempts",
        payload
      FROM nexora_autonomy_tasks
      WHERE id = $1
    `,
    [taskId],
  );

  const task = taskResult.rows[0];
  if (!task) return;

  const terminal = task.attempts >= task.maxAttempts;
  const nextStatus = terminal ? 'dead' : 'failed';

  await nexoraQuery(
    `
      UPDATE nexora_autonomy_tasks
      SET status = $2,
          last_error = $3,
          locked_until = NULL,
          scheduled_at = CASE WHEN $2 = 'failed' THEN now() + interval '60 seconds' ELSE scheduled_at END,
          updated_at = now()
      WHERE id = $1
    `,
    [taskId, nextStatus, error],
  );

  if (terminal) {
    await nexoraQuery(
      `
        INSERT INTO nexora_dead_letters (id, task_id, worker_key, reason, payload)
        VALUES ($1,$2,$3,$4,$5::jsonb)
      `,
      [nexoraId('dead'), taskId, task.workerKey, error, JSON.stringify(task.payload || {})],
    );
  } else {
    await nexoraQuery(
      `
        UPDATE nexora_autonomy_tasks
        SET status = 'queued', updated_at = now()
        WHERE id = $1
      `,
      [taskId],
    );
  }

  await nexoraQuery(
    `
      UPDATE nexora_worker_state
      SET status = CASE WHEN $2 = 'dead' THEN 'degraded' ELSE 'idle' END,
          current_task_id = NULL,
          total_tasks = total_tasks + 1,
          failed_tasks = failed_tasks + 1,
          updated_at = now(),
          last_heartbeat_at = now()
      WHERE worker_key = $1
    `,
    [task.workerKey, nextStatus],
  );

  await scoreNexoraWorker({
    workerKey: task.workerKey,
    division: task.division,
    taskId,
    success: false,
    signal: terminal ? 'task.dead' : 'task.failed.retry',
    weight: terminal ? 3 : 1,
  });
}

export async function recoverTimedOutNexoraTasks(timeoutMinutes = 5): Promise<number> {
  await ensureNexoraAutonomySchema();

  const result = await nexoraQuery<{ id: string; workerKey: string; division: string }>(
    `
      UPDATE nexora_autonomy_tasks
      SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
          last_error = 'Nexora recovered task after worker timeout.',
          locked_until = NULL,
          updated_at = now()
      WHERE status = 'running'
        AND locked_until < now()
      RETURNING id, worker_key as "workerKey", division
    `,
  );

  for (const row of result.rows) {
    await nexoraQuery(
      `
        UPDATE nexora_worker_state
        SET status = 'degraded',
            current_task_id = NULL,
            timeout_tasks = timeout_tasks + 1,
            updated_at = now()
        WHERE worker_key = $1
      `,
      [row.workerKey],
    );

    await scoreNexoraWorker({
      workerKey: row.workerKey,
      division: row.division,
      taskId: row.id,
      success: false,
      signal: 'task.timeout.recovered',
      weight: 2,
    });
  }

  await nexoraQuery(
    `
      UPDATE nexora_worker_state
      SET status = 'dead', updated_at = now()
      WHERE retired_at IS NULL
        AND last_heartbeat_at < now() - ($1::text || ' minutes')::interval
        AND status NOT IN ('retired')
    `,
    [timeoutMinutes],
  );

  return result.rowCount || 0;
}

export async function scoreNexoraWorker(input: NexoraWorkerScoreInput): Promise<void> {
  await ensureNexoraAutonomySchema();

  const base = input.success ? 10 : -12;
  const riskMultiplier =
    input.risk === 'critical' ? 3 :
    input.risk === 'high' ? 2 :
    input.risk === 'medium' ? 1.25 :
    1;

  const speedBonus = input.durationMs && input.durationMs < 5000 ? 2 : 0;
  const scoreDelta = (base * riskMultiplier + speedBonus) * Number(input.weight || 1);

  await nexoraQuery(
    `
      INSERT INTO nexora_worker_scores (
        id, worker_key, division, task_id, success, duration_ms, risk, signal, weight, score_delta
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
    [
      nexoraId('score'),
      input.workerKey,
      input.division,
      input.taskId || null,
      input.success,
      input.durationMs || null,
      input.risk || null,
      input.signal || 'execution',
      input.weight || 1,
      scoreDelta,
    ],
  );
}

export async function writeNexoraReport(
  reportType: string,
  severity: string,
  title: string,
  summary: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await ensureNexoraAutonomySchema();

  await nexoraQuery(
    `
      INSERT INTO nexora_autonomy_reports (id, report_type, severity, title, summary, payload)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb)
    `,
    [nexoraId('report'), reportType, severity, title, summary, JSON.stringify(payload)],
  );
}

export async function writeNexoraMemory(
  memoryType: string,
  subject: string,
  importance: number,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await ensureNexoraAutonomySchema();

  await nexoraQuery(
    `
      INSERT INTO nexora_operating_memory (id, memory_type, subject, importance, payload)
      VALUES ($1,$2,$3,$4,$5::jsonb)
    `,
    [nexoraId('mem'), memoryType, subject, importance, JSON.stringify(payload)],
  );
}

export async function getNexoraDurableSnapshot(): Promise<Record<string, unknown>> {
  await ensureNexoraAutonomySchema();

  const [tasks, approvals, workers, reports, scores, loops] = await Promise.all([
    nexoraQuery(`
      SELECT status, count(*)::int AS count
      FROM nexora_autonomy_tasks
      GROUP BY status
      ORDER BY status
    `),
    nexoraQuery(`
      SELECT status, count(*)::int AS count
      FROM nexora_autonomy_approvals
      GROUP BY status
      ORDER BY status
    `),
    nexoraQuery(`
      SELECT status, count(*)::int AS count
      FROM nexora_worker_state
      GROUP BY status
      ORDER BY status
    `),
    nexoraQuery(`
      SELECT report_type, severity, title, summary, created_at
      FROM nexora_autonomy_reports
      ORDER BY created_at DESC
      LIMIT 10
    `),
    nexoraQuery(`
      SELECT
        worker_key,
        division,
        round(coalesce(sum(score_delta), 0), 2)::float AS score,
        count(*)::int AS signals
      FROM nexora_worker_scores
      GROUP BY worker_key, division
      ORDER BY score DESC
      LIMIT 20
    `),
    nexoraQuery(`
      SELECT loop_name, status, started_at, completed_at, duration_ms, summary
      FROM nexora_loop_runs
      ORDER BY started_at DESC
      LIMIT 10
    `),
  ]);

  return {
    persistent: true,
    generatedAt: new Date().toISOString(),
    tasks: tasks.rows,
    approvals: approvals.rows,
    workers: workers.rows,
    recentReports: reports.rows,
    workerRanking: scores.rows,
    recentLoops: loops.rows,
    nextActions: [
      'Continue durable worker heartbeat collection.',
      'Keep high-risk execution approval gated.',
      'Promote consistently high-scoring low-risk workers to higher queue priority.',
      'Retire or retrain workers with repeated timeout/dead-letter signals.',
    ],
  };
}

export async function seedNexoraDurableWorkers(): Promise<void> {
  const workers = [
    ['office.receptionist', 'office', ['lead_capture', 'quote_qualification', 'followup_generation']],
    ['office.quote-builder', 'office', ['quote_draft', 'fitout_scope', 'margin_check']],
    ['office.procurement-scout', 'procurement', ['supplier_scan', 'price_compare', 'stock_watch']],
    ['trading.phantom-x.paper', 'trading', ['paper_signal_review', 'risk_scan', 'market_memory']],
    ['learning.curriculum-worker', 'learning', ['lesson_plan', 'worker_training', 'knowledge_capture']],
    ['safety.execution-gate', 'safety', ['risk_gate', 'approval_hold', 'policy_enforcement']],
    ['reporting.command-centre', 'reporting', ['snapshot', 'summary', 'next_action_recommendation']],
  ] as const;

  for (const [workerKey, division, capabilities] of workers) {
    await heartbeatNexoraWorker({
      workerKey,
      division,
      status: 'idle',
      capabilities: [...capabilities],
      metadata: {
        seededBy: 'nexora.persistence.build',
        nexoraAuthority: true,
      },
    });
  }
}
TS

cat > src/nexora/autonomy/persistence/nexoraPgBossBridge.ts <<'TS'
import PgBoss from 'pg-boss';
import { nexoraHasDatabase } from './nexoraAutonomyDb';
import { createNexoraDurableTask } from './nexoraDurableAutonomyStore';
import { NexoraDurableTaskInput } from './nexoraAutonomyTypes';

let boss: PgBoss | null = null;
let started = false;

export async function getNexoraPgBoss(): Promise<PgBoss | null> {
  if (!nexoraHasDatabase()) return null;
  if (boss && started) return boss;

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) return null;

  boss = new PgBoss({
    connectionString,
    schema: process.env.NEXORA_PGBOSS_SCHEMA || 'pgboss',
  } as any);

  boss.on('error', (error) => {
    console.error('[NEXORA_PGBOSS_ERROR]', error);
  });

  await boss.start();
  started = true;

  try {
    await (boss as any).createQueue?.('nexora.autonomy.default', {
      retryLimit: 3,
      retryDelay: 60,
    });
  } catch (error) {
    console.warn('[NEXORA_PGBOSS_QUEUE_CREATE_SKIPPED]', error instanceof Error ? error.message : error);
  }

  return boss;
}

export async function enqueueNexoraPgBossTask(input: NexoraDurableTaskInput): Promise<Record<string, unknown>> {
  const durableTask = await createNexoraDurableTask(input);
  const instance = await getNexoraPgBoss();

  if (!instance || durableTask.status === 'approval_required') {
    return {
      durableTaskId: durableTask.id,
      pgBossJobId: null,
      status: durableTask.status,
      queued: durableTask.status === 'queued',
      approvalRequired: durableTask.approvalRequired,
    };
  }

  const jobId = await (instance as any).send('nexora.autonomy.default', {
    durableTaskId: durableTask.id,
    workerKey: durableTask.workerKey,
    division: durableTask.division,
    kind: durableTask.kind,
    risk: durableTask.risk,
  });

  return {
    durableTaskId: durableTask.id,
    pgBossJobId: jobId,
    status: durableTask.status,
    queued: true,
    approvalRequired: false,
  };
}
TS

cat > src/nexora/autonomy/loops/nexoraAutonomousLoopController.ts <<'TS'
import { nexoraId, nexoraQuery } from '../persistence/nexoraAutonomyDb';
import {
  claimNextNexoraTask,
  completeNexoraTask,
  failNexoraTask,
  getNexoraDurableSnapshot,
  heartbeatNexoraWorker,
  initializeNexoraDurableAutonomy,
  recoverTimedOutNexoraTasks,
  seedNexoraDurableWorkers,
  writeNexoraReport,
} from '../persistence/nexoraDurableAutonomyStore';

async function runSafeWorkerExecution(task: any): Promise<Record<string, unknown>> {
  const started = Date.now();

  if (task.risk === 'high' || task.risk === 'critical') {
    throw new Error('Execution gate violation: high-risk task reached runner without approval.');
  }

  const output = {
    executedBy: 'nexora.autonomous.loop',
    workerKey: task.workerKey,
    division: task.division,
    kind: task.kind,
    risk: task.risk,
    safeMode: true,
    tradingMode: task.division === 'trading' ? 'paper/sandbox' : undefined,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    decision: 'completed_safe_autonomous_task',
  };

  return output;
}

export async function runNexoraDurableAutonomyCycle(): Promise<Record<string, unknown>> {
  await initializeNexoraDurableAutonomy();
  await seedNexoraDurableWorkers();

  const loopId = nexoraId('loop');
  const started = Date.now();

  await nexoraQuery(
    `
      INSERT INTO nexora_loop_runs (id, loop_name, status, payload)
      VALUES ($1,'nexora.durable.autonomy','running',$2::jsonb)
    `,
    [loopId, JSON.stringify({ startedBy: 'nexora' })],
  );

  let claimed = 0;
  let completed = 0;
  let failed = 0;

  const recovered = await recoverTimedOutNexoraTasks();

  for (let i = 0; i < Number(process.env.NEXORA_AUTONOMY_CYCLE_LIMIT || 5); i += 1) {
    const task = await claimNextNexoraTask(Number(process.env.NEXORA_TASK_LOCK_MS || 120000));
    if (!task) break;

    claimed += 1;

    await heartbeatNexoraWorker({
      workerKey: task.workerKey,
      division: task.division,
      status: 'busy',
      metadata: {
        activeTaskId: task.id,
        loopId,
      },
    });

    try {
      const result = await runSafeWorkerExecution(task);
      await completeNexoraTask(task.id, result);
      completed += 1;
    } catch (error) {
      await failNexoraTask(task.id, error instanceof Error ? error.message : String(error));
      failed += 1;
    }
  }

  const durationMs = Date.now() - started;
  const summary = `Nexora durable autonomy cycle claimed ${claimed}, completed ${completed}, failed ${failed}, recovered ${recovered}.`;

  await writeNexoraReport('autonomy.cycle', failed > 0 ? 'warning' : 'info', 'Nexora durable autonomy cycle', summary, {
    loopId,
    claimed,
    completed,
    failed,
    recovered,
    durationMs,
  });

  await nexoraQuery(
    `
      UPDATE nexora_loop_runs
      SET status = 'completed',
          completed_at = now(),
          duration_ms = $2,
          summary = $3,
          payload = payload || $4::jsonb
      WHERE id = $1
    `,
    [
      loopId,
      durationMs,
      summary,
      JSON.stringify({
        claimed,
        completed,
        failed,
        recovered,
      }),
    ],
  );

  const snapshot = await getNexoraDurableSnapshot();

  return {
    ok: true,
    loopId,
    summary,
    claimed,
    completed,
    failed,
    recovered,
    durationMs,
    snapshot,
  };
}

let loopTimer: NodeJS.Timeout | null = null;

export function startNexoraAutonomousLoopTimer(): { started: boolean; intervalMs: number } {
  const enabled = process.env.NEXORA_AUTONOMY_LOOP_ENABLED === 'true';
  const intervalMs = Number(process.env.NEXORA_AUTONOMY_LOOP_INTERVAL_MS || 60000);

  if (!enabled) {
    return { started: false, intervalMs };
  }

  if (loopTimer) {
    return { started: true, intervalMs };
  }

  loopTimer = setInterval(() => {
    runNexoraDurableAutonomyCycle().catch((error) => {
      console.error('[NEXORA_AUTONOMY_LOOP_ERROR]', error);
    });
  }, intervalMs);

  if (typeof loopTimer.unref === 'function') {
    loopTimer.unref();
  }

  return { started: true, intervalMs };
}
TS

cat > src/nexora/autonomy/routes/nexoraDurableAutonomyRoutes.ts <<'TS'
import {
  approveNexoraTask,
  createNexoraDurableTask,
  getNexoraDurableSnapshot,
  initializeNexoraDurableAutonomy,
  rejectNexoraTask,
  seedNexoraDurableWorkers,
} from '../persistence/nexoraDurableAutonomyStore';
import { enqueueNexoraPgBossTask, getNexoraPgBoss } from '../persistence/nexoraPgBossBridge';
import {
  runNexoraDurableAutonomyCycle,
  startNexoraAutonomousLoopTimer,
} from '../loops/nexoraAutonomousLoopController';

export function registerNexoraDurableAutonomyRoutes(app: any): void {
  app.get('/api/nexora/autonomy/persistence/status', async (_req: any, res: any) => {
    try {
      const init = await initializeNexoraDurableAutonomy();
      const loop = startNexoraAutonomousLoopTimer();
      const boss = await getNexoraPgBoss();

      res.json({
        ok: true,
        nexoraBrain: true,
        persistent: init.persistent,
        pgBoss: Boolean(boss),
        loop,
        message: init.message,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/persistence/seed', async (_req: any, res: any) => {
    try {
      await initializeNexoraDurableAutonomy();
      await seedNexoraDurableWorkers();
      res.json({
        ok: true,
        seeded: true,
        message: 'Nexora durable workers seeded under the single Nexora brain.',
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/api/nexora/autonomy/persistence/snapshot', async (_req: any, res: any) => {
    try {
      const snapshot = await getNexoraDurableSnapshot();
      res.json({
        ok: true,
        nexoraBrain: true,
        snapshot,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/tasks', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const task = await createNexoraDurableTask({
        workerKey: String(body.workerKey || 'reporting.command-centre'),
        division: String(body.division || 'reporting'),
        kind: String(body.kind || 'operating_snapshot'),
        risk: body.risk || 'low',
        priority: Number(body.priority || 50),
        payload: body.payload || {},
        maxAttempts: Number(body.maxAttempts || 3),
        source: body.source || 'api',
        approvalRequired: Boolean(body.approvalRequired),
      });

      res.json({
        ok: true,
        task,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/tasks/enqueue', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await enqueueNexoraPgBossTask({
        workerKey: String(body.workerKey || 'office.receptionist'),
        division: String(body.division || 'office'),
        kind: String(body.kind || 'lead_followup'),
        risk: body.risk || 'low',
        priority: Number(body.priority || 60),
        payload: body.payload || {},
        maxAttempts: Number(body.maxAttempts || 3),
        source: body.source || 'api.pg-boss',
        approvalRequired: Boolean(body.approvalRequired),
      });

      res.json({
        ok: true,
        result,
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/approvals/:approvalId/approve', async (req: any, res: any) => {
    try {
      await approveNexoraTask(
        req.params.approvalId,
        req.body?.decidedBy || 'nexora-admin',
        req.body?.note || 'Approved through Nexora approval gate.',
      );

      res.json({
        ok: true,
        approvalId: req.params.approvalId,
        status: 'approved',
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/approvals/:approvalId/reject', async (req: any, res: any) => {
    try {
      await rejectNexoraTask(
        req.params.approvalId,
        req.body?.decidedBy || 'nexora-admin',
        req.body?.note || 'Rejected through Nexora approval gate.',
      );

      res.json({
        ok: true,
        approvalId: req.params.approvalId,
        status: 'rejected',
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/loop/run', async (_req: any, res: any) => {
    try {
      const result = await runNexoraDurableAutonomyCycle();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/autonomy/loop/start', async (_req: any, res: any) => {
    try {
      const result = startNexoraAutonomousLoopTimer();
      res.json({
        ok: true,
        ...result,
        note: result.started
          ? 'Nexora autonomous loop timer is active in this process.'
          : 'Set NEXORA_AUTONOMY_LOOP_ENABLED=true to enable automatic in-process loops.',
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
TS

cat > scripts/patch-nexora-durable-autonomy-routes.cjs <<'JS'
const fs = require('fs');
const path = require('path');

const candidates = [
  'src/server.ts',
  'src/index.ts',
  'src/app.ts',
  'server.ts',
  'index.ts',
  'app.ts',
  'backend/src/server.ts',
  'backend/src/index.ts',
  'backend/src/app.ts',
];

function findFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) findFiles(full, out);
    else if (/\.(ts|tsx|js)$/.test(name)) out.push(full);
  }
  return out;
}

const files = [
  ...candidates.filter((file) => fs.existsSync(file)),
  ...findFiles('src'),
];

const target = files.find((file) => {
  const text = fs.readFileSync(file, 'utf8');
  return (
    text.includes('express(') &&
    (
      text.includes('app.listen') ||
      text.includes('createServer') ||
      text.includes('module.exports = app') ||
      text.includes('export default app')
    )
  );
});

if (!target) {
  console.error('Could not locate Express app entrypoint to patch.');
  process.exit(1);
}

let text = fs.readFileSync(target, 'utf8');

if (text.includes('registerNexoraDurableAutonomyRoutes')) {
  console.log(`Routes already patched in ${target}`);
  process.exit(0);
}

const fromTargetDir = path.relative(path.dirname(target), 'src/nexora/autonomy/routes/nexoraDurableAutonomyRoutes')
  .replace(/\\/g, '/');

const importPath = fromTargetDir.startsWith('.') ? fromTargetDir : `./${fromTargetDir}`;
const importLine = `import { registerNexoraDurableAutonomyRoutes } from '${importPath}';\n`;

if (/^import\s/m.test(text)) {
  text = text.replace(/^(import[\s\S]*?;\n)(?!import)/m, `$1${importLine}`);
} else {
  text = `${importLine}${text}`;
}

const appPatterns = [
  /const\s+app\s*=\s*express\s*\(\s*\)\s*;?/,
  /let\s+app\s*=\s*express\s*\(\s*\)\s*;?/,
  /var\s+app\s*=\s*express\s*\(\s*\)\s*;?/,
];

let patched = false;

for (const pattern of appPatterns) {
  if (pattern.test(text)) {
    text = text.replace(pattern, (match) => `${match}\nregisterNexoraDurableAutonomyRoutes(app);`);
    patched = true;
    break;
  }
}

if (!patched) {
  const listenIndex = text.indexOf('app.listen');
  if (listenIndex !== -1) {
    text = `${text.slice(0, listenIndex)}registerNexoraDurableAutonomyRoutes(app);\n${text.slice(listenIndex)}`;
    patched = true;
  }
}

if (!patched) {
  console.error(`Found candidate ${target}, but could not patch app registration safely.`);
  process.exit(1);
}

fs.writeFileSync(target, text);
console.log(`Patched Nexora durable autonomy routes into ${target}`);
JS

node scripts/patch-nexora-durable-autonomy-routes.cjs

echo "Running TypeScript/build checks..."
npm run check

echo "Committing build..."
git add package.json package-lock.json src scripts build-nexora-persistence-autonomy.sh
git commit -m "Add Nexora durable autonomy persistence and loop framework" || echo "Nothing new to commit."

echo "Deploying to Railway..."
railway deploy

echo "Waiting briefly before curl verification..."
sleep 12

echo "Running deployed curl tests..."
set +e

curl -fsS "$DOMAIN/api/nexora/autonomy/persistence/status" | tee /tmp/nexora_persistence_status.json
STATUS_1=$?

echo ""
curl -fsS -X POST "$DOMAIN/api/nexora/autonomy/persistence/seed" \
  -H "Content-Type: application/json" \
  -d '{}' | tee /tmp/nexora_persistence_seed.json
STATUS_2=$?

echo ""
curl -fsS -X POST "$DOMAIN/api/nexora/autonomy/tasks/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "workerKey":"office.receptionist",
    "division":"office",
    "kind":"lead_followup",
    "risk":"low",
    "priority":80,
    "payload":{
      "leadType":"office furniture and fitout",
      "source":"post-deploy curl test",
      "nextStep":"qualify urgency and prepare quote path"
    }
  }' | tee /tmp/nexora_enqueue_test.json
STATUS_3=$?

echo ""
curl -fsS -X POST "$DOMAIN/api/nexora/autonomy/loop/run" \
  -H "Content-Type: application/json" \
  -d '{}' | tee /tmp/nexora_loop_run.json
STATUS_4=$?

echo ""
curl -fsS "$DOMAIN/api/nexora/autonomy/persistence/snapshot" | tee /tmp/nexora_snapshot.json
STATUS_5=$?

set -e

echo ""
echo "Curl status codes:"
echo "status endpoint:   $STATUS_1"
echo "seed endpoint:     $STATUS_2"
echo "enqueue endpoint:  $STATUS_3"
echo "loop endpoint:     $STATUS_4"
echo "snapshot endpoint: $STATUS_5"

if [ "$STATUS_1" -ne 0 ] || [ "$STATUS_2" -ne 0 ] || [ "$STATUS_3" -ne 0 ] || [ "$STATUS_4" -ne 0 ] || [ "$STATUS_5" -ne 0 ]; then
  echo "One or more deployed curl tests failed."
  exit 1
fi

echo "============================================================"
echo "NEXORA DURABLE AUTONOMY BUILD COMPLETE"
echo "============================================================"
