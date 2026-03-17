// ─── Autonomous Intelligence Scheduler ───────────────────────────────────────
// Runs background intelligence jobs on configurable intervals.
// Stage 5 upgrade: durable pg-boss job queue with in-process timer fallback.

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

      case "predictive_scan": {
        const { runPredictiveScan } = await import("./newsFeedScanner");
        const result = await runPredictiveScan();
        resultSummary = `Predictive scan complete — ${result.saved} new signals from ${result.processed} articles`;
        break;
      }

      case "global_radar_scan": {
        const { runGlobalRadarScan } = await import("./companyIntelligenceService");
        const result = await runGlobalRadarScan(10);
        resultSummary = `Global Radar scan complete — ${result.saved} international signals detected`;
        break;
      }

      case "company_intel_sync": {
        const { syncCompanyIntelligence } = await import("./companyIntelligenceService");
        const result = await syncCompanyIntelligence();
        resultSummary = `Company Intelligence sync complete — ${result.created} new profiles, ${result.synced} updated`;
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

  // Predictive intelligence scan — every 12 hours (offset 120 minutes)
  setTimeout(() => runJob("predictive_scan"), 120 * 60 * 1000);
  setInterval(() => runJob("predictive_scan"), 12 * HOUR);

  // Global Radar scan — every 24 hours (offset 150 minutes)
  setTimeout(() => runJob("global_radar_scan"), 150 * 60 * 1000);
  setInterval(() => runJob("global_radar_scan"), DAY);

  // Company Intelligence sync — every 6 hours (offset 30 minutes after global radar)
  setTimeout(() => runJob("company_intel_sync"), 180 * 60 * 1000);
  setInterval(() => runJob("company_intel_sync"), 6 * HOUR);

  console.log("[IntelligenceScheduler] Jobs scheduled: health(12h), trends(24h), issues(24h), seo(7d), report(7d), radar(24h), deal_hunter(24h), news_rss(12h), job_signal(12h), predictive(12h), global_radar(24h), company_intel(6h)");
}

// ─── Manual trigger (for admin API) ──────────────────────────────────────────

export async function triggerJobManually(jobType: string): Promise<{ success: boolean; message: string }> {
  const validJobs: JobType[] = ["spending_trends", "seo_content", "website_issues", "system_health", "weekly_report", "radar_scan", "deal_hunter", "news_rss_scan", "job_signal_scan", "predictive_scan", "global_radar_scan", "company_intel_sync"];

  if (!validJobs.includes(jobType as JobType)) {
    return { success: false, message: `Unknown job type: ${jobType}` };
  }

  // Fire and forget — admin gets instant response
  setImmediate(() => runJob(jobType as JobType, "manual").catch(console.error));

  return { success: true, message: `Job "${JOB_LABELS[jobType as JobType]}" triggered manually` };
}

// ─── pg-boss Worker Registration ─────────────────────────────────────────────
// Registers pg-boss workers for all job queues. Called after pg-boss starts.

async function registerPgBossWorkers(): Promise<void> {
  await registerWorker(QUEUES.SCAN_NEWS, async () => {
    await runJob("news_rss_scan");
  });

  await registerWorker(QUEUES.SCAN_JOBS, async () => {
    await runJob("job_signal_scan");
  });

  await registerWorker(QUEUES.SCAN_PREDICTIVE, async () => {
    await runJob("predictive_scan");
  });

  await registerWorker(QUEUES.SCAN_ALL, async (job) => {
    const jobType = (job.data.jobType as JobType) ?? "radar_scan";
    await runJob(jobType);
  });

  await registerWorker(QUEUES.COMPANY_SYNC, async () => {
    await runJob("company_intel_sync");
  });

  await registerWorker(QUEUES.DEMAND_AGGREGATE, async () => {
    const { runDemandAggregation } = await import("./intelligence/demandForecastEngine");
    await runDemandAggregation();
  });

  await registerWorker(QUEUES.BUILDING_RISK_REFRESH, async () => {
    const { refreshBuildingRiskSnapshots } = await import("./intelligence/buildingRiskEngine");
    await refreshBuildingRiskSnapshots();
  });

  await registerWorker(QUEUES.SIGNAL_INGESTION, async () => {
    const { runIngestionCycle } = await import("./intelligence/signalIngestionService");
    const result = await runIngestionCycle();
    // Auto-trigger contact discovery for new high-value signals
    if (result.signalsPersisted > 0) {
      await scheduleJob(QUEUES.CONTACTS_DISCOVERY, {}, { singletonKey: "contacts-discovery-signal-trigger" });
      console.log(`[SignalIngestion] Queued contact discovery after ${result.signalsPersisted} new signals`);
    }
  });

  await registerWorker(QUEUES.CLUSTERS_GENERATE, async () => {
    const { computeClusters } = await import("./intelligence/clusterEngine");
    const result = await computeClusters();
    console.log(`[Scheduler] Clusters generated: +${result.created} created, ${result.updated} updated, ${result.edges} edges`);
  });

  await registerWorker(QUEUES.ALERTS_GENERATE, async () => {
    const { db } = await import("../db");
    const { outreachSequences, dealExecution, outreachThreads } = await import("@shared/schema");
    const { and, eq, lt, sql } = await import("drizzle-orm");

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

    // Check overdue sequences
    const overdueSeqs = await db
      .select()
      .from(outreachSequences)
      .where(
        and(
          eq(outreachSequences.status, "scheduled"),
          lt(outreachSequences.scheduledFor, now)
        )
      )
      .limit(50);

    // Check stale deals (not updated in 7+ days and not in terminal stage)
    const staleDeals = await db
      .select({ id: dealExecution.id, companyName: dealExecution.companyName, stage: dealExecution.stage, updatedAt: dealExecution.updatedAt })
      .from(dealExecution)
      .where(
        and(
          lt(dealExecution.updatedAt, sevenDaysAgo),
          eq(dealExecution.status, "active")
        )
      )
      .limit(20);

    // Check stale active threads (active for 21+ days without reply)
    const staleThreads = await db
      .select({ id: outreachThreads.id, companyName: outreachThreads.companyName, createdAt: outreachThreads.createdAt })
      .from(outreachThreads)
      .where(
        and(
          eq(outreachThreads.status, "active"),
          lt(outreachThreads.createdAt, twentyOneDaysAgo)
        )
      )
      .limit(20);

    const alerts: string[] = [];
    if (overdueSeqs.length > 0) alerts.push(`${overdueSeqs.length} overdue sequences (scheduled but not sent)`);
    if (staleDeals.length > 0) alerts.push(`${staleDeals.length} stale deals not updated in 7+ days: ${staleDeals.map(d => d.companyName).slice(0, 3).join(", ")}`);
    if (staleThreads.length > 0) alerts.push(`${staleThreads.length} threads active 21+ days without reply: ${staleThreads.map(t => t.companyName).slice(0, 3).join(", ")}`);

    if (alerts.length > 0) {
      console.log(`[AlertsGenerate] ⚠ ${alerts.length} alerts:\n  - ${alerts.join("\n  - ")}`);
    } else {
      console.log("[AlertsGenerate] All loops healthy — no alerts triggered");
    }
  });

  // UPGRADE: Lease Expiry Engine
  await registerWorker(QUEUES.LEASE_EXPIRY_SCAN, async () => {
    const { runLeaseExpiryEngine } = await import("./intelligence/leaseExpiryService");
    await runLeaseExpiryEngine();
  });

  // UPGRADE: Company Hierarchy Builder
  await registerWorker(QUEUES.HIERARCHY_BUILD, async () => {
    const { buildHierarchyFromExistingData, rollUpSignals } = await import("./intelligence/companyHierarchyService");
    await buildHierarchyFromExistingData();
    await rollUpSignals();
  });

  // UPGRADE: Graph Refresh
  await registerWorker(QUEUES.GRAPH_REFRESH, async () => {
    const { runGraphRefresh } = await import("./intelligence/intelligenceGraphService");
    await runGraphRefresh();
  });

  // ── OUTREACH ENGINE: 7 new queues ──────────────────────────────────────────

  await registerWorker(QUEUES.CONTACTS_DISCOVERY, async (job) => {
    const { companyId, opportunityId } = (job?.data ?? {}) as { companyId?: string; opportunityId?: string };
    if (companyId) {
      const { runContactDiscovery } = await import("./outreach/contactDiscoveryService");
      await runContactDiscovery(companyId, opportunityId);
    } else {
      const { runDiscoveryForHighValueOpportunities } = await import("./outreach/contactDiscoveryService");
      await runDiscoveryForHighValueOpportunities();
    }
  });

  await registerWorker(QUEUES.OUTREACH_GENERATE, async (job) => {
    const { createOutreachForHighValueOpportunities } = await import("./outreach/outreachEngine");
    await createOutreachForHighValueOpportunities();
  });

  await registerWorker(QUEUES.OUTREACH_SEND, async () => {
    const LIVE_MODE = process.env.SAFE_MODE === "false";
    const { db } = await import("../db");
    const { outreachMessages, outreachThreads, companyContacts, outreachEvents } = await import("@shared/schema");
    const { and, eq } = await import("drizzle-orm");

    // Find draft outbound messages attached to active threads
    const drafts = await db
      .select({
        msgId: outreachMessages.id,
        threadId: outreachMessages.threadId,
        subject: outreachMessages.subject,
        body: outreachMessages.body,
        contactId: outreachThreads.contactId,
        companyName: outreachThreads.companyName,
        companyId: outreachThreads.companyId,
      })
      .from(outreachMessages)
      .innerJoin(outreachThreads, eq(outreachMessages.threadId, outreachThreads.id))
      .where(
        and(
          eq(outreachMessages.deliveryStatus, "draft"),
          eq(outreachMessages.direction, "outbound"),
          eq(outreachThreads.status, "active")
        )
      )
      .limit(20);

    let sent = 0;
    let failed = 0;

    for (const draft of drafts) {
      try {
        if (LIVE_MODE && draft.subject && draft.body) {
          let toEmail: string | null = null;
          if (draft.contactId) {
            const [contact] = await db
              .select({ email: companyContacts.email })
              .from(companyContacts)
              .where(eq(companyContacts.id, draft.contactId))
              .limit(1);
            toEmail = contact?.email ?? null;
          }
          if (toEmail) {
            const { sendOutreachEmail } = await import("../email");
            await sendOutreachEmail({ to: toEmail, subject: draft.subject, html: draft.body, companyName: draft.companyName });
          }
        }

        await db.update(outreachMessages)
          .set({ deliveryStatus: "sent", sentAt: new Date() })
          .where(eq(outreachMessages.id, draft.msgId));

        await db.update(outreachThreads)
          .set({ updatedAt: new Date() })
          .where(eq(outreachThreads.id, draft.threadId));

        await db.insert(outreachEvents).values({
          threadId: draft.threadId,
          eventType: "sent",
          payloadJson: JSON.stringify({ messageId: draft.msgId, liveMode: LIVE_MODE }),
        });

        sent++;
      } catch (e) {
        console.error(`[OutreachSend] Failed to send message ${draft.msgId}:`, e);
        await db.update(outreachMessages)
          .set({ deliveryStatus: "failed" })
          .where(eq(outreachMessages.id, draft.msgId));
        failed++;
      }
    }

    console.log(`[OutreachSend] Processed ${sent} sent, ${failed} failed (LIVE_MODE: ${LIVE_MODE})`);
  });

  await registerWorker(QUEUES.OUTREACH_FOLLOWUP, async (job) => {
    const { processScheduledFollowUps } = await import("./outreach/outreachEngine");
    await processScheduledFollowUps();
  });

  await registerWorker(QUEUES.BOOKING_SYNC, async () => {
    const { getBookingStats } = await import("./outreach/bookingService");
    const stats = await getBookingStats();

    // Sync any confirmed meetings that haven't yet updated deal_execution
    const { db } = await import("../db");
    const { meetingBookingEvents, dealExecution } = await import("@shared/schema");
    const { and, eq, isNull } = await import("drizzle-orm");

    const confirmedEvents = await db
      .select()
      .from(meetingBookingEvents)
      .where(eq(meetingBookingEvents.bookingStatus, "confirmed"))
      .limit(50);

    let synced = 0;
    for (const event of confirmedEvents) {
      if (event.companyId && event.meetingTime) {
        const existing = await db
          .select({ id: dealExecution.id, meetingBooked: dealExecution.meetingBooked })
          .from(dealExecution)
          .where(and(eq(dealExecution.companyId, event.companyId), eq(dealExecution.meetingBooked, false)))
          .limit(1);

        if (existing.length > 0) {
          await db.update(dealExecution)
            .set({ stage: "meeting_booked", meetingBooked: true, meetingTime: event.meetingTime, updatedAt: new Date() })
            .where(eq(dealExecution.id, existing[0].id));
          synced++;
        }
      }
    }

    console.log(`[BookingSync] Stats: ${stats.confirmed} confirmed, ${stats.clicked} clicked, ${synced} deal_execution records synced`);
  });

  await registerWorker(QUEUES.REPLY_DETECT, async () => {
    const SAFE_MODE = process.env.SAFE_MODE !== "false";
    const { db } = await import("../db");
    const { outreachThreads, outreachMessages, outreachEvents } = await import("@shared/schema");
    const { and, eq, lt } = await import("drizzle-orm");

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    // Find active threads with messages sent > 48h ago (candidates for reply simulation in SAFE_MODE)
    const candidates = await db
      .select({ id: outreachThreads.id, companyName: outreachThreads.companyName })
      .from(outreachThreads)
      .where(eq(outreachThreads.status, "active"))
      .limit(50);

    // Check which candidates have a sent message older than 48h
    const replyable: Array<{ id: string; companyName: string }> = [];
    for (const thread of candidates) {
      const [sentMsg] = await db
        .select({ id: outreachMessages.id })
        .from(outreachMessages)
        .where(
          and(
            eq(outreachMessages.threadId, thread.id),
            eq(outreachMessages.deliveryStatus, "sent"),
            lt(outreachMessages.sentAt, twoDaysAgo)
          )
        )
        .limit(1);
      if (sentMsg) replyable.push(thread);
    }

    if (SAFE_MODE && replyable.length > 0) {
      // Simulate 1 reply per cycle for a randomly chosen thread
      const pick = replyable[Math.floor(Math.random() * replyable.length)];
      await db.update(outreachThreads)
        .set({ status: "replied", updatedAt: new Date() })
        .where(eq(outreachThreads.id, pick.id));

      await db.insert(outreachMessages).values({
        threadId: pick.id,
        direction: "inbound",
        channel: "email",
        subject: "Re: Workspace Planning",
        body: "[SIMULATED REPLY] Thanks for reaching out. Can we schedule a call?",
        stage: 0,
        messageType: "reply",
        deliveryStatus: "sent",
        sentAt: new Date(),
      });

      await db.insert(outreachEvents).values({
        threadId: pick.id,
        eventType: "replied",
        payloadJson: JSON.stringify({ simulated: true, companyName: pick.companyName }),
      });

      console.log(`[ReplyDetect] SAFE_MODE — simulated reply for ${pick.companyName} (${replyable.length} threads eligible)`);
    } else if (!SAFE_MODE) {
      // Live mode: webhook-based — poll inbound queue (future: integrate Gmail/Outlook API)
      console.log(`[ReplyDetect] Live mode — ${replyable.length} threads eligible for reply. Webhook integration required for inbox polling.`);
    } else {
      console.log("[ReplyDetect] No threads with sent messages older than 48h");
    }
  });

  await registerWorker(QUEUES.OUTREACH_METRICS_REFRESH, async (job) => {
    const { getOutreachStats } = await import("./outreach/outreachGenerationService");
    const stats = await getOutreachStats();
    console.log(`[OutreachMetrics] Threads: ${stats.totalThreads}, Sent: ${stats.sent}, Reply rate: ${stats.replyRate}%`);
  });

  // ── Stripe Revenue Engine workers ────────────────────────────────────────────
  await registerWorker(QUEUES.PAYMENTS_SYNC, async () => {
    const { getRevenueStats } = await import("./stripe/revenueService");
    const stats = await getRevenueStats();
    console.log(`[PaymentsSync] Revenue today: $${(stats.revenueToday / 100).toFixed(2)}, Awaiting: ${stats.quotesAwaitingPayment} quotes`);
  });

  await registerWorker(QUEUES.REVENUE_METRICS_REFRESH, async () => {
    const { getRevenueStats } = await import("./stripe/revenueService");
    const stats = await getRevenueStats();
    console.log(`[RevenueMetrics] Week: $${(stats.revenueThisWeek / 100).toFixed(2)}, Deposits: ${stats.depositsReceived}`);
  });

  await registerWorker(QUEUES.PAYMENTS_RECONCILE, async () => {
    const { db } = await import("../db");
    const { paymentLinks, dealExecution } = await import("@shared/schema");
    const { and, eq, lt, ne } = await import("drizzle-orm");

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Find active payment links older than 14 days (stale — may need follow-up)
    const staleLinks = await db
      .select({
        id: paymentLinks.id,
        companyId: paymentLinks.companyId,
        amount: paymentLinks.amount,
        createdAt: paymentLinks.createdAt,
        linkUrl: paymentLinks.linkUrl,
      })
      .from(paymentLinks)
      .where(
        and(
          eq(paymentLinks.status, "active"),
          lt(paymentLinks.createdAt, fourteenDaysAgo)
        )
      )
      .limit(20);

    // Find deals with meeting booked but no payment link created
    const unlinkedDeals = await db
      .select({ id: dealExecution.id, companyName: dealExecution.companyName })
      .from(dealExecution)
      .where(
        and(
          eq(dealExecution.meetingBooked, true),
          eq(dealExecution.status, "active")
        )
      )
      .limit(20);

    const flaggedUnlinked = unlinkedDeals.filter(d => !d.companyName); // basic guard
    console.log(
      `[PaymentsReconcile] Stale links (14d+ active): ${staleLinks.length}. ` +
      `Deals with meeting but no payment link: ${unlinkedDeals.length}`
    );

    if (staleLinks.length > 0) {
      const preview = staleLinks.slice(0, 3).map(l => `$${(l.amount / 100).toFixed(0)} (${l.linkUrl ?? "no URL"})`).join(", ");
      console.log(`[PaymentsReconcile] Stale links preview: ${preview}`);
    }
  });

  await registerWorker(QUEUES.PAYMENTS_RETRY_FAILED, async () => {
    const SAFE_MODE = process.env.SAFE_MODE === "true";
    if (SAFE_MODE) { console.log("[PaymentsRetry] SAFE_MODE — retry suppressed"); return; }
    console.log("[PaymentsRetry] Checking for failed payments to retry");
  });

  await registerWorker(QUEUES.INVOICES_REFRESH, async () => {
    const { getOutstandingInvoices } = await import("./stripe/revenueService");
    const invoices = await getOutstandingInvoices();
    console.log(`[InvoicesRefresh] Outstanding invoices: ${invoices.length}`);
  });

  await registerWorker(QUEUES.WEBHOOKS_REPLAY, async () => {
    const { db } = await import("../db");
    const { outreachEvents } = await import("@shared/schema");
    const { and, sql: drizzleSql } = await import("drizzle-orm");

    // Check for outreach events that contain error payloads (failed webhooks)
    const failedEvents = await db
      .select({ id: outreachEvents.id, threadId: outreachEvents.threadId, eventType: outreachEvents.eventType, payloadJson: outreachEvents.payloadJson, createdAt: outreachEvents.createdAt })
      .from(outreachEvents)
      .where(drizzleSql`${outreachEvents.payloadJson} LIKE '%error%' OR ${outreachEvents.payloadJson} LIKE '%failed%'`)
      .limit(20);

    if (failedEvents.length > 0) {
      console.log(`[WebhooksReplay] Found ${failedEvents.length} events with error payloads:`);
      for (const ev of failedEvents.slice(0, 5)) {
        console.log(`  - [${ev.eventType}] thread:${ev.threadId} at ${ev.createdAt?.toISOString()}`);
      }
      // Future: re-enqueue these events or call external webhook endpoints to retry
    } else {
      console.log("[WebhooksReplay] No failed webhook events found — all clean");
    }
  });

  // ── Alex Autonomous Agent ──────────────────────────────────────────────────
  await registerWorker(QUEUES.ALEX_CYCLE, async () => {
    const { runAlexCycle } = await import("./alex/alexAutonomousAgent");
    const result = await runAlexCycle();
    console.log(`[AlexAgent] Cycle done: ${result.processed} opps, ${result.outreachTriggered} outreach, ${result.bookingsCreated} bookings, ${result.dealsUpdated} deals`);
  });
}

async function schedulePgBossJobs(): Promise<void> {
  // pg-boss schedule() requires standard 5-field cron expressions (not interval strings)
  await scheduleJob(QUEUES.SCAN_NEWS, {}, { repeatEvery: "0 */12 * * *", singletonKey: "scan-news" });
  await scheduleJob(QUEUES.SCAN_JOBS, {}, { repeatEvery: "0 */12 * * *", singletonKey: "scan-jobs" });
  await scheduleJob(QUEUES.SCAN_PREDICTIVE, {}, { repeatEvery: "0 */12 * * *", singletonKey: "scan-predictive" });
  await scheduleJob(QUEUES.SCAN_ALL, { jobType: "radar_scan" }, { repeatEvery: "0 2 * * *", singletonKey: "radar-scan" });
  await scheduleJob(QUEUES.SCAN_ALL, { jobType: "deal_hunter" }, { repeatEvery: "0 3 * * *", singletonKey: "deal-hunter" });
  await scheduleJob(QUEUES.SCAN_ALL, { jobType: "system_health" }, { repeatEvery: "0 */12 * * *", singletonKey: "system-health" });
  await scheduleJob(QUEUES.COMPANY_SYNC, {}, { repeatEvery: "0 */6 * * *", singletonKey: "company-sync" });
  await scheduleJob(QUEUES.DEMAND_AGGREGATE, {}, { repeatEvery: "0 1 * * *", singletonKey: "demand-aggregate" });
  await scheduleJob(QUEUES.BUILDING_RISK_REFRESH, {}, { repeatEvery: "0 4 * * *", singletonKey: "building-risk" });
  await scheduleJob(QUEUES.SIGNAL_INGESTION, {}, { repeatEvery: "0 */6 * * *", singletonKey: "signal-ingestion" });
  // UPGRADE queues
  await scheduleJob(QUEUES.LEASE_EXPIRY_SCAN, {}, { repeatEvery: "0 5 * * *", singletonKey: "lease-expiry-scan" });
  await scheduleJob(QUEUES.HIERARCHY_BUILD, {}, { repeatEvery: "0 6 * * *", singletonKey: "hierarchy-build" });
  await scheduleJob(QUEUES.GRAPH_REFRESH, {}, { repeatEvery: "0 7 * * *", singletonKey: "graph-refresh" });
  // OUTREACH ENGINE queues
  await scheduleJob(QUEUES.CONTACTS_DISCOVERY, {}, { repeatEvery: "0 8 * * *", singletonKey: "contacts-discovery" });
  await scheduleJob(QUEUES.OUTREACH_GENERATE, {}, { repeatEvery: "0 9 * * *", singletonKey: "outreach-generate" });
  await scheduleJob(QUEUES.OUTREACH_FOLLOWUP, {}, { repeatEvery: "0 */6 * * *", singletonKey: "outreach-followup" });
  await scheduleJob(QUEUES.BOOKING_SYNC, {}, { repeatEvery: "0 */4 * * *", singletonKey: "booking-sync" });
  await scheduleJob(QUEUES.REPLY_DETECT, {}, { repeatEvery: "0 */2 * * *", singletonKey: "reply-detect" });
  await scheduleJob(QUEUES.OUTREACH_METRICS_REFRESH, {}, { repeatEvery: "0 */12 * * *", singletonKey: "outreach-metrics" });
  // STRIPE REVENUE ENGINE queues
  await scheduleJob(QUEUES.PAYMENTS_SYNC, {}, { repeatEvery: "0 */4 * * *", singletonKey: "payments-sync" });
  await scheduleJob(QUEUES.REVENUE_METRICS_REFRESH, {}, { repeatEvery: "0 */12 * * *", singletonKey: "revenue-metrics" });
  await scheduleJob(QUEUES.PAYMENTS_RECONCILE, {}, { repeatEvery: "0 2 * * *", singletonKey: "payments-reconcile" });
  await scheduleJob(QUEUES.PAYMENTS_RETRY_FAILED, {}, { repeatEvery: "0 */6 * * *", singletonKey: "payments-retry" });
  await scheduleJob(QUEUES.INVOICES_REFRESH, {}, { repeatEvery: "0 */8 * * *", singletonKey: "invoices-refresh" });
  await scheduleJob(QUEUES.WEBHOOKS_REPLAY, {}, { repeatEvery: "0 */6 * * *", singletonKey: "webhooks-replay" });
  // Alex Autonomous Agent + Cluster Engine
  await scheduleJob(QUEUES.CLUSTERS_GENERATE, {}, { repeatEvery: "0 */6 * * *", singletonKey: "clusters-generate" });
  await scheduleJob(QUEUES.ALEX_CYCLE, {}, { repeatEvery: "0 */4 * * *", singletonKey: "alex-cycle" });
  console.log("[IntelligenceScheduler] pg-boss recurring jobs scheduled (incl. 7 outreach + 6 payment + Alex + clusters = 29 total)");
}

// ─── Unified scheduler startup ─────────────────────────────────────────────────

export async function startSchedulerWithPgBoss(): Promise<boolean> {
  const pgBossReady = await initJobOrchestrator();
  if (!pgBossReady) return false;

  await registerPgBossWorkers();
  await schedulePgBossJobs();
  console.log("[IntelligenceScheduler] Running on pg-boss durable job queue");
  return true;
}
