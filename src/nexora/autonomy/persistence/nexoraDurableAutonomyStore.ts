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
