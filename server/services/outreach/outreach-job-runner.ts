/**
 * OUTREACH JOB RUNNER — Persistent Job Locking
 *
 * Prevents concurrent outreach runs via DB-backed exclusive locks.
 * A job key can only have one active running lock at a time.
 * If a lock exists and is fresh (< LOCK_TIMEOUT_MINUTES), skip the run.
 * If a lock is stale (> LOCK_TIMEOUT_MINUTES), it is recovered and overwritten.
 */

import { db } from "../../db";
import { outreachJobs } from "../../../shared/schema";
import { eq, sql } from "drizzle-orm";

const LOCK_TIMEOUT_MINUTES = 15; // locks older than this are considered stale
const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

export interface JobLockResult {
  acquired: boolean;
  reason?: string;
  jobId?: string;
}

/**
 * Attempt to acquire an exclusive job lock for the given job key.
 * Returns { acquired: true } if the lock was obtained.
 * Returns { acquired: false, reason } if another process holds a fresh lock.
 */
export async function acquireJobLock(jobKey: string, jobType: string): Promise<JobLockResult> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - LOCK_TIMEOUT_MINUTES * 60 * 1000);

  try {
    // Check if a job record exists
    const existing = await db.select()
      .from(outreachJobs)
      .where(eq(outreachJobs.jobKey, jobKey))
      .limit(1);

    if (existing.length === 0) {
      // First run — insert a new job record with running status
      await db.insert(outreachJobs).values({
        jobKey,
        jobType,
        status: "running",
        lockedBy: WORKER_ID,
        startedAt: now,
        lastRunAt: now,
        runCount: 1,
      });
      console.log(`[JobRunner] Acquired lock for ${jobKey} (new job)`);
      return { acquired: true, jobId: jobKey };
    }

    const job = existing[0];

    // If running and lock is fresh — skip
    if (job.status === "running" && job.startedAt && job.startedAt > staleThreshold) {
      const age = Math.round((now.getTime() - job.startedAt.getTime()) / 1000);
      console.log(`[JobRunner] Lock held for ${jobKey} by ${job.lockedBy} (${age}s ago) — skipping run`);
      return { acquired: false, reason: `Lock held since ${job.startedAt.toISOString()} by ${job.lockedBy}` };
    }

    // Lock is idle, completed, failed, or stale — acquire it
    if (job.status === "running" && job.startedAt && job.startedAt <= staleThreshold) {
      console.warn(`[JobRunner] Stale lock detected for ${jobKey} (held since ${job.startedAt.toISOString()}) — recovering`);
    }

    await db.update(outreachJobs)
      .set({
        status: "running",
        lockedBy: WORKER_ID,
        startedAt: now,
        lastRunAt: now,
        runCount: (job.runCount ?? 0) + 1,
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(outreachJobs.jobKey, jobKey));

    console.log(`[JobRunner] Acquired lock for ${jobKey}`);
    return { acquired: true, jobId: jobKey };

  } catch (err: any) {
    console.error(`[JobRunner] Failed to acquire lock for ${jobKey}:`, err.message);
    return { acquired: false, reason: `Lock acquisition error: ${err.message}` };
  }
}

/**
 * Release the job lock after completion or failure.
 */
export async function releaseJobLock(jobKey: string, outcome: "completed" | "failed", errorMessage?: string): Promise<void> {
  const now = new Date();
  try {
    await db.update(outreachJobs)
      .set({
        status: outcome,
        completedAt: now,
        lastRunAt: now,
        errorMessage: errorMessage?.slice(0, 500) ?? null,
        updatedAt: now,
      })
      .where(eq(outreachJobs.jobKey, jobKey));
    console.log(`[JobRunner] Released lock for ${jobKey} — ${outcome}`);
  } catch (err: any) {
    console.error(`[JobRunner] Failed to release lock for ${jobKey}:`, err.message);
  }
}

/**
 * Run a job with automatic lock acquisition, execution, and release.
 * If the lock cannot be acquired, the job is silently skipped.
 *
 * Usage:
 *   await runLockedJob("outreach.send", "send_pipeline", async () => {
 *     await processPendingOutreach();
 *   });
 */
export async function runLockedJob(
  jobKey: string,
  jobType: string,
  fn: () => Promise<void>
): Promise<void> {
  const lock = await acquireJobLock(jobKey, jobType);
  if (!lock.acquired) {
    console.log(`[JobRunner] Skipping ${jobKey} — ${lock.reason}`);
    return;
  }

  try {
    await fn();
    await releaseJobLock(jobKey, "completed");
  } catch (err: any) {
    console.error(`[JobRunner] Job ${jobKey} failed:`, err.message);
    await releaseJobLock(jobKey, "failed", err.message);
  }
}
