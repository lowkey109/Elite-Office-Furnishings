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

      // Auto-route high-confidence signals to partner network
      try {
        const { autoRouteHighScoreSignals } = await import("./partnerNetwork");
        const partnerResult = await autoRouteHighScoreSignals();
        if (partnerResult.routed > 0) {
          console.log(`[SignalIngestion] Auto-routed ${partnerResult.routed} signals to partner network`);
        }
      } catch (e) {
        // Non-critical — partner routing failure should not block signal ingestion
      }
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
    // ── SAFETY GATE: acquire persistent job lock before processing ──
    // If a lock is already held by another run, this worker silently exits.
    // This prevents concurrent scheduler triggers from duplicating sends.
    const { runLockedJob } = await import("./outreach/outreach-job-runner");
    await runLockedJob("outreach.send", "send_pipeline", async () => {
      const { db } = await import("../db");
      const { outreachMessages, outreachThreads, outreachEvents } = await import("@shared/schema");
      const { and, eq } = await import("drizzle-orm");
      const { resolveProspectEmail } = await import("./outreach/prospectEmailResolver");
      const { sendOutreachSafely } = await import("./outreach/outreach-gateway");

      // Find draft outbound messages attached to active threads
      // Skip any that are already locked/sending/sent — they are mid-flight
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
        .limit(5); // conservative batch — gateway has its own rate limiting

      let sent = 0;
      let blocked = 0;
      let failed = 0;
      let suppressed = 0;
      let deduplicated = 0;

      for (const draft of drafts) {
        try {
          // STEP 1: Resolve prospect email — NEVER fallback to internal addresses
          const resolved = await resolveProspectEmail({
            companyId: draft.companyId,
            contactId: draft.contactId ?? null,
          });

          if (!resolved.resolvedEmail || resolved.sourceType === "blocked") {
            const reason = resolved.blockingReason ?? "No valid external prospect email found";
            console.warn(`[OutreachSend] BLOCKED — ${draft.companyName}: ${reason}`);

            await db.update(outreachMessages)
              .set({ deliveryStatus: "blocked", blockingReason: reason, emailSourceType: "blocked", updatedAt: new Date() })
              .where(eq(outreachMessages.id, draft.msgId));

            await db.update(outreachThreads)
              .set({ contactReadiness: "NEEDS_CONTACT", updatedAt: new Date() })
              .where(eq(outreachThreads.id, draft.threadId));

            await db.insert(outreachEvents).values({
              threadId: draft.threadId,
              eventType: "blocked",
              payloadJson: JSON.stringify({ messageId: draft.msgId, reason }),
            });

            blocked++;
            continue;
          }

          const toEmail = resolved.resolvedEmail;

          // STEP 2: Route through safety gateway — ALL checks run inside
          // Gateway handles: suppression, dedup, cooldown, rate limits, safe mode, locking, audit
          const result = await sendOutreachSafely({
            messageId: draft.msgId,
            companyName: draft.companyName,
            recipientEmail: toEmail,
            subject: draft.subject ?? `Partnership Opportunity — ${draft.companyName}`,
            html: draft.body,
            campaignKey: "supplier-outreach",
            stage: 0,
          });

          if (result.sent) {
            await db.update(outreachThreads)
              .set({ contactReadiness: "READY_TO_CONTACT", resolvedEmail: toEmail, resolvedEmailSource: resolved.sourceType, updatedAt: new Date() })
              .where(eq(outreachThreads.id, draft.threadId));

            await db.insert(outreachEvents).values({
              threadId: draft.threadId,
              eventType: "sent",
              payloadJson: JSON.stringify({ messageId: draft.msgId, recipientEmail: toEmail, sourceType: resolved.sourceType }),
            });
            sent++;
          } else if (result.suppressed) {
            suppressed++;
          } else if (result.deduplicated) {
            deduplicated++;
          } else {
            blocked++;
          }

        } catch (e) {
          console.error(`[OutreachSend] Unexpected error for message ${draft.msgId}:`, e);
          await db.update(outreachMessages)
            .set({ deliveryStatus: "failed", lastError: (e as any)?.message?.slice(0, 500) ?? "Unknown error", updatedAt: new Date() })
            .where(eq(outreachMessages.id, draft.msgId));
          failed++;
        }
      }

      console.log(`[OutreachSend] Cycle done — sent:${sent} blocked:${blocked} suppressed:${suppressed} dedup:${deduplicated} failed:${failed}`);
    });
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

  // ── Nexora Autonomous Loop ─────────────────────────────────────────────────
  await registerWorker(QUEUES.NEXORA_LOOP, async () => {
    const { runNexoraCycle } = await import("./nexoraLoop");
    const result = await runNexoraCycle("auto");
    if (result.skipped) {
      console.log("[NexoraLoop] Scheduled run skipped — already running");
    } else {
      console.log(`[NexoraLoop] Scheduled cycle done: ${result.processed} processed, ${result.outreachRuns} outreach`);
    }
  });

  // ── Lead Engine Scrapers ───────────────────────────────────────────────────
  await registerWorker(QUEUES.LEAD_SCRAPE_LINKEDIN, async () => {
    const { runLinkedInScraper } = await import("./leadEngine");
    const result = await runLinkedInScraper();
    console.log(`[LeadScraper] LinkedIn complete: ${result.added} added, ${result.skipped} skipped`);
  });
  await registerWorker(QUEUES.LEAD_SCRAPE_MAPS, async () => {
    const { runMapsScraper } = await import("./leadEngine");
    const result = await runMapsScraper();
    console.log(`[LeadScraper] Maps complete: ${result.added} added, ${result.skipped} skipped`);
  });

  // ── Daily Deal Engine ──────────────────────────────────────────────────────
  // Runs every day: score opportunities → route to partners → trigger outreach
  await registerWorker(QUEUES.DAILY_DEAL_ENGINE, async () => {
    console.log("[DailyDealEngine] Starting daily revenue loop cycle...");
    const { db: ddb } = await import("../db");
    const { intelligenceSignals, partnerOpportunities, outreachThreads } = await import("@shared/schema");
    const { sql: dSql, and, gte, eq, ne } = await import("drizzle-orm");

    // 1. Score & pull new high-quality intelligence signals as opportunities
    const newOpps = await ddb.select().from(intelligenceSignals)
      .where(
        and(
          gte(intelligenceSignals.opportunityScore, 40),
          gte(intelligenceSignals.relocationProbability, 30),
          ne(intelligenceSignals.status, "converted"),
          ne(intelligenceSignals.status, "archived"),
        )
      )
      .limit(50);

    console.log(`[DailyDealEngine] Found ${newOpps.length} scoreable signals`);

    // 2. Route high-score ones to partner network
    let routed = 0;
    const { routeOpportunityToPartners } = await import("./partnerNetwork");
    const highScoreOpps = newOpps.filter(o => (o.opportunityScore ?? 0) >= 70 && (o.relocationProbability ?? 0) >= 60);
    for (const opp of highScoreOpps.slice(0, 10)) {
      try {
        const result = await routeOpportunityToPartners({
          opportunityTitle: `${opp.companyName} — Daily Engine Routing`,
          companyName: opp.companyName,
          city: opp.city ?? "Sydney",
          estimatedProjectValue: 80000,
          sourceType: "daily_deal_engine",
          sourceId: opp.id,
        });
        routed += result.routed;
      } catch (e) { /* non-critical */ }
    }

    // 3. Trigger outreach for any signal without an existing outreach thread
    const existingThreads = await ddb.select({ companyId: outreachThreads.companyId }).from(outreachThreads);
    const threadsWithCompany = new Set(existingThreads.map(t => t.companyId).filter(Boolean));
    const needsOutreach = newOpps.filter(o => (o.opportunityScore ?? 0) >= 55 && !threadsWithCompany.has(o.id));

    let outreachCreated = 0;
    const { createOutreachThread } = await import("./outreach/outreachEngine");
    for (const opp of needsOutreach.slice(0, 15)) {
      try {
        await createOutreachThread({
          companyId: opp.id,
          companyName: opp.companyName,
          city: opp.city,
          opportunityScore: Math.round(opp.opportunityScore ?? 0),
          relocationProbability: Math.round(opp.relocationProbability ?? 0),
          signals: [opp.signalType ?? "daily_scan"],
        });
        outreachCreated++;
      } catch (e) { /* non-critical */ }
    }

    console.log(`[DailyDealEngine] Done — opps: ${newOpps.length}, routed: ${routed}, outreach: ${outreachCreated}`);
  });

  // ── Dead Loop Detection ────────────────────────────────────────────────────
  // Finds stalled deals > 48h and re-triggers outreach or escalates
  await registerWorker(QUEUES.DEAD_LOOP_DETECT, async () => {
    console.log("[DeadLoopDetect] Scanning for stalled opportunities...");
    const { db: ddb } = await import("../db");
    const { dealExecution, outreachThreads } = await import("@shared/schema");
    const { and, eq, lte, or, isNull } = await import("drizzle-orm");
    const { sql: dSql } = await import("drizzle-orm");

    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Find deals stuck in early stages for > 48h
    const stalledDeals = await ddb.select().from(dealExecution)
      .where(
        and(
          or(
            eq(dealExecution.stage, "new"),
            eq(dealExecution.stage, "contacted"),
            eq(dealExecution.stage, "engaged")
          ),
          lte(dealExecution.updatedAt, cutoff48h)
        )
      )
      .limit(30);

    console.log(`[DeadLoopDetect] Found ${stalledDeals.length} stalled deals`);

    let reactivated = 0;
    let escalated = 0;

    for (const deal of stalledDeals) {
      try {
        // Update the deal with a re-trigger note
        await ddb.update(dealExecution)
          .set({
            lastAction: `Dead loop detected — re-triggered at ${new Date().toISOString()}`,
            nextAction: deal.stage === "new" ? "Create outreach thread" : "Send follow-up message",
            updatedAt: new Date(),
            status: "re-triggered",
          })
          .where(eq(dealExecution.id, deal.id));

        // If deal has an outreach thread — find and trigger a follow-up
        if (deal.companyId) {
          const [thread] = await ddb.select().from(outreachThreads)
            .where(eq(outreachThreads.companyId, deal.companyId))
            .limit(1);

          if (thread && ["active", "pending"].includes(thread.status)) {
            // Queue a follow-up by setting thread to active if paused
            await ddb.update(outreachThreads)
              .set({ status: "active", updatedAt: new Date() })
              .where(eq(outreachThreads.id, thread.id));
            reactivated++;
          } else if (!thread) {
            // No thread — escalate to human
            await ddb.update(dealExecution)
              .set({
                assignedTo: "human",
                lastAction: "Dead loop escalation — no outreach thread found",
                nextAction: "Human team: create outreach or call direct",
                updatedAt: new Date(),
              })
              .where(eq(dealExecution.id, deal.id));
            escalated++;
          }
        }
      } catch (e) { /* non-critical per deal */ }
    }

    console.log(`[DeadLoopDetect] Done — stalled: ${stalledDeals.length}, reactivated: ${reactivated}, escalated: ${escalated}`);
  });

  // ── Follow-Up Scheduler (durable) ─────────────────────────────────────────
  // Processes overdue follow-up email sequences through pg-boss (no timers)
  await registerWorker(QUEUES.FOLLOWUPS_SEND, async () => {
    const { runFollowUpScheduler } = await import("./followUpScheduler");
    await runFollowUpScheduler();
  });

  // ── Proposal Auto-Send ────────────────────────────────────────────────────
  // Finds meeting_booked deals without proposals and auto-generates them
  await registerWorker(QUEUES.PROPOSAL_AUTO_SEND, async () => {
    console.log("[ProposalAutoSend] Finding meeting_booked deals without proposals...");
    const { db: ddb } = await import("../db");
    const { dealExecution, proposals: propsTable, quotes } = await import("@shared/schema");
    const { eq, and, notExists } = await import("drizzle-orm");

    const meetingBookedDeals = await ddb.select().from(dealExecution)
      .where(eq(dealExecution.stage, "meeting_booked"))
      .limit(20);

    let generated = 0;
    for (const deal of meetingBookedDeals) {
      try {
        // Check if a proposal already exists for this deal (by companyName or opportunityId)
        const { or } = await import("drizzle-orm");
        const existingProps = await ddb.select({ id: propsTable.id })
          .from(propsTable)
          .where(or(
            deal.companyId ? eq(propsTable.opportunityId, deal.companyId) : undefined,
            eq(propsTable.companyName, deal.companyName ?? ""),
          ))
          .limit(1);
        if (existingProps.length > 0) continue;

        // Find a matching quote for this company
        const [quote] = await ddb.select({ id: quotes.id })
          .from(quotes)
          .where(eq(quotes.companyName, deal.companyName ?? ""))
          .limit(1);

        if (quote) {
          const { proposalService } = await import("../services/dealClosing/proposalService");
          await proposalService.generateFromQuote(quote.id, {
            opportunityId: deal.companyId ?? undefined,
            title: `Proposal — ${deal.companyName}`,
          });
          // Advance deal to proposal_sent
          await ddb.update(dealExecution)
            .set({
              stage: "proposal_sent",
              lastAction: "Auto-proposal generated post-meeting",
              nextAction: "Follow up on proposal acceptance",
              updatedAt: new Date(),
            })
            .where(eq(dealExecution.id, deal.id));
          generated++;
        } else {
          // No quote found — create a placeholder deal note
          await ddb.update(dealExecution)
            .set({
              lastAction: "Auto-proposal: No quote found — create manually",
              nextAction: "Create quote, then auto-proposal will run",
              updatedAt: new Date(),
            })
            .where(eq(dealExecution.id, deal.id));
        }
      } catch (e) { /* non-critical per deal */ }
    }
    console.log(`[ProposalAutoSend] Done — meeting_booked deals: ${meetingBookedDeals.length}, proposals generated: ${generated}`);
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
  await scheduleJob(QUEUES.FOLLOWUPS_SEND, {}, { repeatEvery: "0 * * * *", singletonKey: "followups-send" });
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
  // Revenue Loop Engine — high-frequency live mode
  await scheduleJob(QUEUES.DAILY_DEAL_ENGINE, {}, { repeatEvery: "*/15 * * * *", singletonKey: "daily-deal-engine" });
  await scheduleJob(QUEUES.DEAD_LOOP_DETECT, {}, { repeatEvery: "0 */2 * * *", singletonKey: "dead-loop-detect" });
  await scheduleJob(QUEUES.PROPOSAL_AUTO_SEND, {}, { repeatEvery: "0 10 * * *", singletonKey: "proposal-auto-send" });
  // Outreach retry — every 30 minutes
  await scheduleJob(QUEUES.OUTREACH_FOLLOWUP, {}, { repeatEvery: "*/30 * * * *", singletonKey: "outreach-retry-30m" });
  // Lead Engine scrapers — every 6 hours
  await scheduleJob(QUEUES.LEAD_SCRAPE_LINKEDIN, {}, { repeatEvery: "0 */6 * * *", singletonKey: "lead-scrape-linkedin" });
  await scheduleJob(QUEUES.LEAD_SCRAPE_MAPS, {}, { repeatEvery: "0 */6 * * *", singletonKey: "lead-scrape-maps" });
  // Nexora Autonomous Loop — every 30 minutes
  await scheduleJob(QUEUES.NEXORA_LOOP, {}, { repeatEvery: "*/30 * * * *", singletonKey: "nexora-loop" });
  console.log("[IntelligenceScheduler] pg-boss recurring jobs scheduled (incl. 7 outreach + 6 payment + Alex + clusters + 3 revenue-loop + 2 lead scrapers + nexora-loop = 36 total — deal engine: 15min, dead loop: 2h, nexora: 30min, scrapers: 6h)");
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
