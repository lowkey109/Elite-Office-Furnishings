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

let _started = false;

export function startIntelligenceScheduler(): void {
  if (_started) return;
  _started = true;

  console.log("[Scheduler] STARTED");

  // staggered execution
  setTimeout(() => runJob("system_health"), 30_000);
  setTimeout(() => runJob("deal_hunter"), 60_000);

  setInterval(() => runJob("system_health"), 12 * 60 * 60 * 1000);
  setInterval(() => runJob("deal_hunter"), 24 * 60 * 60 * 1000);
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

  console.log("[Scheduler] pg-boss ACTIVE");

  return true;
}