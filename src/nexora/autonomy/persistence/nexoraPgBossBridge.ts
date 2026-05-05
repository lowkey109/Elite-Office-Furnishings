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
