// ─── Autonomous Intelligence Scheduler ───────────────────────────────────────
// Runs background intelligence jobs on configurable intervals.
// Follows the same pattern as followUpScheduler.ts

import { storage } from "../storage";
import {
  analyzeSpendingTrends,
  generateSEOBlogArticle,
  detectWebsiteIssues,
  runSystemHealthCheck,
  generateWeeklyBusinessReport,
} from "./intelligenceEngine";

// ─── Job registry ─────────────────────────────────────────────────────────────

type JobType =
  | "spending_trends"
  | "seo_content"
  | "website_issues"
  | "system_health"
  | "weekly_report"
  | "radar_scan"
  | "deal_hunter"
  | "news_rss_scan"
  | "job_signal_scan";

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
};

// ─── Job runner ───────────────────────────────────────────────────────────────

async function runJob(jobType: JobType, triggeredBy: "scheduler" | "manual" = "scheduler"): Promise<void> {
  const startedAt = new Date();
  const startMs = Date.now();

  // Create job record
  const job = await storage.createScheduledJob({
    jobType,
    status: "running",
    triggeredBy,
    startedAt,
    result: null,
    error: null,
  });

  console.log(`[IntelligenceScheduler] Starting job: ${JOB_LABELS[jobType]} (${job.id})`);

  try {
    let resultSummary = "";

    switch (jobType) {
      case "spending_trends":
        await analyzeSpendingTrends();
        resultSummary = "Spending trend analysis completed";
        break;

      case "seo_content":
        await generateSEOBlogArticle();
        resultSummary = "SEO blog article generated and saved as draft";
        break;

      case "website_issues":
        await detectWebsiteIssues();
        resultSummary = "Website issue detection audit completed";
        break;

      case "system_health": {
        const report = await runSystemHealthCheck();
        resultSummary = report.summary;
        break;
      }

      case "weekly_report":
        await generateWeeklyBusinessReport();
        resultSummary = "Weekly business intelligence report generated";
        break;

      case "radar_scan": {
        const { runOfficeMovRadarScan } = await import("./officeMovRadarService");
        const saved = await runOfficeMovRadarScan({ count: 6 });
        resultSummary = `Office Move Radar scan complete — ${saved.length} new opportunities detected`;
        break;
      }

      case "deal_hunter": {
        const { runDealHunterScan } = await import("./dealHunter");
        const result = await runDealHunterScan(8);
        resultSummary = `AI Deal Hunter scan complete — ${result.created} signals discovered, ${result.deduplicated} deduplicated`;
        break;
      }

      case "news_rss_scan": {
        const { runNewsFeedScan } = await import("./newsFeedScanner");
        const result = await runNewsFeedScan();
        resultSummary = `News RSS scan complete — ${result.saved} new signals from ${result.processed} articles`;
        break;
      }

      case "job_signal_scan": {
        const { runJobSignalScan } = await import("./newsFeedScanner");
        const result = await runJobSignalScan();
        resultSummary = `Job signal scan complete — ${result.saved} new signals from ${result.processed} articles`;
        break;
      }
    }

    await storage.updateScheduledJob(job.id, {
      status: "completed",
      completedAt: new Date(),
      durationMs: Date.now() - startMs,
      result: resultSummary,
    });

    console.log(`[IntelligenceScheduler] Completed: ${JOB_LABELS[jobType]} in ${Date.now() - startMs}ms`);
  } catch (err: any) {
    console.error(`[IntelligenceScheduler] Failed: ${JOB_LABELS[jobType]}`, err.message);

    await storage.updateScheduledJob(job.id, {
      status: "failed",
      completedAt: new Date(),
      durationMs: Date.now() - startMs,
      error: err.message || "Unknown error",
    });
  }
}

// ─── Schedule state ───────────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

let _started = false;

// ─── Public API ───────────────────────────────────────────────────────────────

export function startIntelligenceScheduler(): void {
  if (_started) return;
  _started = true;

  console.log("[IntelligenceScheduler] Starting autonomous intelligence scheduler");

  // System health check — every 12 hours
  setTimeout(() => runJob("system_health"), 30_000);
  setInterval(() => runJob("system_health"), 12 * HOUR);

  // Spending trend analysis — every 24 hours
  setTimeout(() => runJob("spending_trends"), 5 * 60 * 1000);
  setInterval(() => runJob("spending_trends"), DAY);

  // Website issue detection — every 24 hours (offset 10 minutes)
  setTimeout(() => runJob("website_issues"), 10 * 60 * 1000);
  setInterval(() => runJob("website_issues"), DAY);

  // SEO content generation — every 7 days
  setTimeout(() => runJob("seo_content"), 15 * 60 * 1000);
  setInterval(() => runJob("seo_content"), WEEK);

  // Weekly business report — every 7 days (offset 20 minutes)
  setTimeout(() => runJob("weekly_report"), 20 * 60 * 1000);
  setInterval(() => runJob("weekly_report"), WEEK);

  // Office Move Radar scan — every 24 hours (offset 35 minutes to stagger)
  setTimeout(() => runJob("radar_scan"), 35 * 60 * 1000);
  setInterval(() => runJob("radar_scan"), DAY);

  // AI Deal Hunter scan — every 24 hours (offset 45 minutes to stagger)
  setTimeout(() => runJob("deal_hunter"), 45 * 60 * 1000);
  setInterval(() => runJob("deal_hunter"), DAY);

  // News RSS real signal scan — every 12 hours (offset 60 minutes)
  setTimeout(() => runJob("news_rss_scan"), 60 * 60 * 1000);
  setInterval(() => runJob("news_rss_scan"), 12 * HOUR);

  // Job posting signal scan — every 12 hours (offset 90 minutes)
  setTimeout(() => runJob("job_signal_scan"), 90 * 60 * 1000);
  setInterval(() => runJob("job_signal_scan"), 12 * HOUR);

  console.log("[IntelligenceScheduler] Jobs scheduled: health(12h), trends(24h), issues(24h), seo(7d), report(7d), radar(24h), deal_hunter(24h), news_rss(12h), job_signal(12h)");
}

// ─── Manual trigger (for admin API) ──────────────────────────────────────────

export async function triggerJobManually(jobType: string): Promise<{ success: boolean; message: string }> {
  const validJobs: JobType[] = ["spending_trends", "seo_content", "website_issues", "system_health", "weekly_report", "radar_scan", "deal_hunter", "news_rss_scan", "job_signal_scan"];

  if (!validJobs.includes(jobType as JobType)) {
    return { success: false, message: `Unknown job type: ${jobType}` };
  }

  // Fire and forget — admin gets instant response
  setImmediate(() => runJob(jobType as JobType, "manual").catch(console.error));

  return { success: true, message: `Job "${JOB_LABELS[jobType as JobType]}" triggered manually` };
}
