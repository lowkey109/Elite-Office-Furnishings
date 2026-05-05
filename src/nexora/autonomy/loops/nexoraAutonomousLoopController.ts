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
