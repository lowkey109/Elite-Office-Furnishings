// ─── Autonomous Intelligence Scheduler ───────────────────────────────────────
// PRODUCTION UPGRADE: Real data only, no synthetic blocking, hardened execution

import { storage } from "../storage";
import {
  initJobOrchestrator,
  registerWorker,
  scheduleJob,
  QUEUES,
} from "./jobOrchestrator";

import {
  analyzeSpendingTrends,
  generateSEOBlogArticle,
  detectWebsiteIssues,
  runSystemHealthCheck,
  generateWeeklyBusinessReport,
} from "./intelligenceEngine";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type JobType =
  | "spending_trends"
  | "seo_content"
  | "website_issues"
  | "system_health"
  | "weekly_report"
  | "radar_scan"
  | "deal_hunter"
  | "news_rss_scan"
  | "job_signal_scan"
  | "predictive_scan"
  | "global_radar_scan"
  | "company_intel_sync";

const JOB_LABELS: Record<JobType, string> = {
  spending_trends: "Spending Trend Analysis",
  seo_content: "SEO Blog Article Generation",
  website_issues: "Website Issue Detection",
  system_health: "System Health Check",
  weekly_report: "Weekly Business Report",
  radar_scan: "Office Move Radar Scan",
  deal_hunter: "AI Deal Hunter Scan",
  news_rss_scan: "News Feed Real Signal Scan",
  job_signal_scan: "Job Posting Signal Scan",
  predictive_scan: "Predictive Intelligence Scan",
  global_radar_scan: "Global Radar Detection Scan",
  company_intel_sync: "Company Intelligence Sync",
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function runJob(
  jobType: JobType,
  triggeredBy: "scheduler" | "manual" = "scheduler"
): Promise<void> {
  const startedAt = new Date();
  const startMs = Date.now();

  const job = await storage.createScheduledJob({
    jobType,
    status: "running",
    triggeredBy,
    startedAt,
    result: null,
    error: null,
    durationMs: null,
    completedAt: null,
  });

  console.log(`[Scheduler] START: ${jobType}`);

  try {
    let resultSummary = "";

    switch (jobType) {
      case "spending_trends":
        await analyzeSpendingTrends();
        resultSummary = "Spending trends complete";
        break;

      case "seo_content":
        await generateSEOBlogArticle();
        resultSummary = "SEO content generated";
        break;

      case "website_issues":
        await detectWebsiteIssues();
        resultSummary = "Website issues scanned";
        break;

      case "system_health": {
        const report = await runSystemHealthCheck();
        resultSummary = report.summary;
        break;
      }

      case "weekly_report":
        await generateWeeklyBusinessReport();
        resultSummary = "Weekly report generated";
        break;

      // ─── REAL RADAR ───────────────────────────────────────
      case "radar_scan": {
        const { runFullRadarScan } = await import("./newsFeedScanner");
        const result = await runFullRadarScan();

        resultSummary = `Radar: ${result.saved} signals from ${result.processed}`;
        break;
      }

      // ─── 🔥 DEAL HUNTER FIX (KEY PART) ───────────────────
      case "deal_hunter": {
        console.log("[DealHunter] RUNNING REAL ENGINE");

        const { runDealHunterScan } = await import("./dealHunter");

        const result = await runDealHunterScan(20);

        console.log("[DealHunter] RESULT:", result);

        resultSummary = `DealHunter: ${result.created} created | ${result.deduplicated} deduped`;
        break;
      }

      case "news_rss_scan": {
        const { runNewsFeedScan } = await import("./newsFeedScanner");
        const result = await runNewsFeedScan();
        resultSummary = `News: ${result.saved}`;
        break;
      }

      case "job_signal_scan": {
        const { runJobSignalScan } = await import("./newsFeedScanner");
        const result = await runJobSignalScan();
        resultSummary = `Jobs: ${result.saved}`;
        break;
      }

      case "predictive_scan": {
        const { runPredictiveScan } = await import("./newsFeedScanner");
        const result = await runPredictiveScan();
        resultSummary = `Predictive: ${result.saved}`;
        break;
      }

      case "global_radar_scan": {
        const { runGlobalRadarScan } = await import("./companyIntelligenceService");
        const result = await runGlobalRadarScan(10);
        resultSummary = `Global: ${result.saved}`;
        break;
      }

      case "company_intel_sync": {
        const { syncCompanyIntelligence } = await import("./companyIntelligenceService");
        const result = await syncCompanyIntelligence();
        resultSummary = `Company sync: ${result.created}`;
        break;
      }
    }

    await storage.updateScheduledJob(job.id, {
      status: "completed",
      completedAt: new Date(),
      durationMs: Date.now() - startMs,
      result: resultSummary,
    });

    console.log(`[Scheduler] DONE: ${jobType}`);
  } catch (err: any) {
    console.error(`[Scheduler] FAIL: ${jobType}`, err);

    await storage.updateScheduledJob(job.id, {
      status: "failed",
      completedAt: new Date(),
      durationMs: Date.now() - startMs,
      error: err.message || "Unknown error",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// START SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────

// ─── SELF-SCHEDULING DISABLED ────────────────────────────────────────────────
// startIntelligenceScheduler() previously ran its own setInterval timers for
// deal_hunter and system_health, creating a parallel orchestration path that
// bypassed NexoraOrchestrator. Those timers are removed.
// Jobs are now triggered only by:
//   1. NexoraOrchestrator (via runIntelligenceSubTasks) — primary path
//   2. pg-boss (startSchedulerWithPgBoss) — durable backup
//   3. Manual admin trigger (triggerJobManually) — explicit override
// This function is kept as a no-op for backward compatibility only.
let _started = false;

export function startIntelligenceScheduler(): void {
  if (_started) return;
  _started = true;
  console.log("[Scheduler] Intelligence scheduler subordinated to NexoraOrchestrator — no independent timers started");
}

// ─── NEXORA SUB-TASK RUNNER ───────────────────────────────────────────────────
// Called by NexoraOrchestrator as part of each engine run to execute
// intelligence scanning jobs. This is the authorised path for job execution.

const _lastRunAt: Partial<Record<JobType, number>> = {};

export async function runIntelligenceSubTasks(opts: {
  dealHunterMinIntervalMs?: number;
  systemHealthMinIntervalMs?: number;
  radarMinIntervalMs?: number;
} = {}): Promise<{ triggered: string[] }> {
  // ENABLE_SCANNERS guards scanner sub-tasks (deal_hunter, radar_scan).
  // system_health is always allowed as it doesn't hit external APIs.
  const scannersEnabled = process.env.ENABLE_SCANNERS === "true";

  if (!scannersEnabled) {
    console.log("[Scheduler] Scanners disabled (ENABLE_SCANNERS != true) — skipping deal_hunter and radar_scan sub-tasks");
  }

  const now = Date.now();
  const triggered: string[] = [];

  const dealHunterInterval = opts.dealHunterMinIntervalMs ?? 6 * 60 * 60 * 1000; // 6h
  const systemHealthInterval = opts.systemHealthMinIntervalMs ?? 12 * 60 * 60 * 1000; // 12h
  const radarInterval = opts.radarMinIntervalMs ?? 4 * 60 * 60 * 1000; // 4h

  if (scannersEnabled && (!_lastRunAt.deal_hunter || now - _lastRunAt.deal_hunter > dealHunterInterval)) {
    _lastRunAt.deal_hunter = now;
    setImmediate(() => runJob("deal_hunter"));
    triggered.push("deal_hunter");
  }

  if (!_lastRunAt.system_health || now - _lastRunAt.system_health > systemHealthInterval) {
    _lastRunAt.system_health = now;
    setImmediate(() => runJob("system_health"));
    triggered.push("system_health");
  }

  if (scannersEnabled && (!_lastRunAt.radar_scan || now - _lastRunAt.radar_scan > radarInterval)) {
    _lastRunAt.radar_scan = now;
    setImmediate(() => runJob("radar_scan"));
    triggered.push("radar_scan");
  }

  if (triggered.length > 0) {
    console.log(`[Scheduler] NexoraOrchestrator triggered sub-tasks: ${triggered.join(", ")}`);
  }

  return { triggered };
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL TRIGGER
// ─────────────────────────────────────────────────────────────────────────────

export async function triggerJobManually(jobType: string) {
  const valid: JobType[] = [
    "spending_trends",
    "seo_content",
    "website_issues",
    "system_health",
    "weekly_report",
    "radar_scan",
    "deal_hunter",
    "news_rss_scan",
    "job_signal_scan",
    "predictive_scan",
    "global_radar_scan",
    "company_intel_sync",
  ];

  if (!valid.includes(jobType as JobType)) {
    return { success: false, message: "Invalid job" };
  }

  setImmediate(() => runJob(jobType as JobType));

  return { success: true, message: "Triggered" };
}

// ─────────────────────────────────────────────────────────────────────────────
// PG BOSS
// ─────────────────────────────────────────────────────────────────────────────

export async function startSchedulerWithPgBoss(): Promise<boolean> {
  const ready = await initJobOrchestrator();
  if (!ready) return false;

  await registerWorker(QUEUES.SCAN_ALL, async (job) => {
    const jobType = (job.data.jobType as JobType) ?? "deal_hunter";
    await runJob(jobType);
  });

  await scheduleJob(
    QUEUES.SCAN_ALL,
    { jobType: "deal_hunter" },
    { repeatEvery: "0 */6 * * *" } // every 6 hours
  );

  // ── Nexora push retry workers ──────────────────────────────────────────────
  // When pushToPipeline or pushToRadar throw, the orchestrator schedules a
  // pg-boss job (2-min delay) so pg-boss handles retry with exponential backoff
  // (retryLimit: 3, retryBackoff: true already set in getBoss()).

  await registerWorker(QUEUES.NEXORA_PUSH_PIPELINE_RETRY, async (job) => {
    const signalId = job.data.signalId as string;
    const sourceType = (job.data.sourceType as "deal" | "radar") ?? "deal";
    if (!signalId) return;
    try {
      const { pushDealHunterToPipeline } = await import("./intelligence/dealHunter");
      await pushDealHunterToPipeline(signalId);
      console.log(`[PushRetry] pipeline push succeeded for ${signalId} (${sourceType})`);
    } catch (err) {
      console.error(`[PushRetry] pipeline retry failed for ${signalId}:`, err);
      throw err; // re-throw so pg-boss triggers its own retryLimit
    }
  });

  await registerWorker(QUEUES.NEXORA_PUSH_RADAR_RETRY, async (job) => {
    const signalId = job.data.signalId as string;
    const sourceType = (job.data.sourceType as "deal" | "radar") ?? "deal";
    if (!signalId) return;
    try {
      const { pushDealHunterToRadar } = await import("./intelligence/dealHunter");
      await pushDealHunterToRadar(signalId);
      console.log(`[PushRetry] radar push succeeded for ${signalId} (${sourceType})`);
    } catch (err) {
      console.error(`[PushRetry] radar retry failed for ${signalId}:`, err);
      throw err; // re-throw so pg-boss triggers its own retryLimit
    }
  });

  console.log("[Scheduler] pg-boss ACTIVE — push retry workers registered");

  return true;
}