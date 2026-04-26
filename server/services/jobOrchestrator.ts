// ─── Job Orchestrator ─────────────────────────────────────────────────────────
// Durable job queue using pg-boss.
// Replaces in-process setInterval/setTimeout with persistent, crash-safe queues.
// CRITICAL: All existing job functions are preserved and simply called by pg-boss handlers.

import PgBoss from "pg-boss";

const SAFE_MODE = process.env.SAFE_MODE === "true";

let boss: PgBoss | null = null;
let initialized = false;

export const QUEUES = {
  SCAN_NEWS: "scan.news",
  SCAN_JOBS: "scan.jobs",
  SCAN_PREDICTIVE: "scan.predictive",
  SCAN_ALL: "scan.all",
  COMPANY_SYNC: "company.sync",
  FOLLOWUPS_SEND: "followups.send",
  DEMAND_AGGREGATE: "demand.aggregate",
  BUILDING_RISK_REFRESH: "building-risk.refresh",
  CLUSTERS_GENERATE: "clusters.generate",
  ALERTS_GENERATE: "alerts.generate",
  SIGNAL_INGESTION: "signal.ingestion",
  LEASE_EXPIRY_SCAN: "lease-expiry.scan",
  HIERARCHY_BUILD: "hierarchy.build",
  GRAPH_REFRESH: "graph.refresh",
  // ── Outreach Engine ──────────────────────────────────────────────────────────
  CONTACTS_DISCOVERY: "contacts.discovery",
  OUTREACH_GENERATE: "outreach.generate",
  OUTREACH_SEND: "outreach.send",
  OUTREACH_FOLLOWUP: "outreach.followup",
  BOOKING_SYNC: "booking.sync",
  REPLY_DETECT: "reply.detect",
  OUTREACH_METRICS_REFRESH: "outreach.metrics.refresh",
  // ── Stripe Revenue Engine ─────────────────────────────────────────────────
  PAYMENTS_SYNC: "payments.sync",
  PAYMENTS_RECONCILE: "payments.reconcile",
  PAYMENTS_RETRY_FAILED: "payments.retry-failed",
  INVOICES_REFRESH: "invoices.refresh",
  REVENUE_METRICS_REFRESH: "revenue.metrics.refresh",
  WEBHOOKS_REPLAY: "webhooks.replay",
  // ── Alex Autonomous Agent ─────────────────────────────────────────────────
  ALEX_CYCLE: "alex.cycle",
  // ── Revenue Loop Engine ───────────────────────────────────────────────────
  DAILY_DEAL_ENGINE: "daily.deal.engine",
  DEAD_LOOP_DETECT: "dead.loop.detect",
  PROPOSAL_AUTO_SEND: "proposal.auto.send",
  // ── Lead Engine ───────────────────────────────────────────────────────────
  LEAD_SCRAPE_LINKEDIN: "lead.scrape.linkedin",
  LEAD_SCRAPE_MAPS: "lead.scrape.maps",
  // ── Nexora Autonomous Loop ────────────────────────────────────────────────
  NEXORA_LOOP: "nexora.loop",
  // ── Nexora Push Retry (dead-letter / retry) ───────────────────────────────
  NEXORA_PUSH_PIPELINE_RETRY: "nexora.push.pipeline.retry",
  NEXORA_PUSH_RADAR_RETRY: "nexora.push.radar.retry",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");

  boss = new PgBoss({
    connectionString,
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    deleteAfterDays: 7,
    monitorStateIntervalSeconds: 60,
    maintenanceIntervalSeconds: 300,
  });

  boss.on("error", (err) => {
    console.error("[JobOrchestrator] pg-boss error:", err);
  });

  await boss.start();
  initialized = true;
  console.log("[JobOrchestrator] pg-boss started successfully");
  return boss;
}

export async function initJobOrchestrator(): Promise<boolean> {
  try {
    await getBoss();
    return true;
  } catch (err) {
    console.error("[JobOrchestrator] Failed to initialize pg-boss — falling back to in-process timers:", err);
    return false;
  }
}

export async function scheduleJob(
  queue: QueueName,
  data: Record<string, unknown> = {},
  options: {
    singletonKey?: string;
    startAfter?: number;
    repeatEvery?: string;
  } = {}
): Promise<string | null> {
  if (SAFE_MODE && queue !== QUEUES.SIGNAL_INGESTION) {
    console.log(`[JobOrchestrator] SAFE_MODE — suppressing schedule for ${queue}`);
    return null;
  }

  try {
    const b = await getBoss();

    if (options.repeatEvery) {
      await b.schedule(queue, options.repeatEvery, data, {
        singletonKey: options.singletonKey ?? queue,
      });
      return `scheduled:${queue}`;
    }

    const jobId = await b.send(queue, data, {
      singletonKey: options.singletonKey,
      startAfter: options.startAfter,
    });

    return jobId;
  } catch (err) {
    console.error(`[JobOrchestrator] Failed to schedule job ${queue}:`, err);
    return null;
  }
}

export async function triggerJob(queue: QueueName, data: Record<string, unknown> = {}): Promise<string | null> {
  return scheduleJob(queue, data);
}

export async function registerWorker(
  queue: QueueName,
  handler: (job: { data: Record<string, unknown> }) => Promise<void>
): Promise<void> {
  try {
    const b = await getBoss();
    await b.work(queue, { teamSize: 2, teamConcurrency: 1 }, async (job) => {
      console.log(`[JobOrchestrator] Processing job: ${queue} (${job.id})`);
      try {
        await handler({ data: (job.data as Record<string, unknown>) ?? {} });
        console.log(`[JobOrchestrator] Completed job: ${queue} (${job.id})`);
      } catch (err) {
        console.error(`[JobOrchestrator] Job failed: ${queue} (${job.id}):`, err);
        throw err;
      }
    });
    console.log(`[JobOrchestrator] Worker registered for queue: ${queue}`);
  } catch (err) {
    console.error(`[JobOrchestrator] Failed to register worker for ${queue}:`, err);
  }
}

export async function getJobStats(): Promise<{
  initialized: boolean;
  queues: { name: string; active: number; completed: number; failed: number }[];
}> {
  if (!initialized || !boss) {
    return { initialized: false, queues: [] };
  }

  try {
    const queueNames = Object.values(QUEUES);
    const stats = await Promise.all(
      queueNames.map(async (name) => {
        try {
          const active = await (boss! as any).getJobCountByName?.(name, "active") ?? 0;
          const completed = await (boss! as any).getJobCountByName?.(name, "completed") ?? 0;
          const failed = await (boss! as any).getJobCountByName?.(name, "failed") ?? 0;
          return { name, active: active ?? 0, completed: completed ?? 0, failed: failed ?? 0 };
        } catch {
          return { name, active: 0, completed: 0, failed: 0 };
        }
      })
    );

    return { initialized: true, queues: stats };
  } catch {
    return { initialized: true, queues: [] };
  }
}

export async function stopJobOrchestrator(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
    initialized = false;
    console.log("[JobOrchestrator] pg-boss stopped");
  }
}
