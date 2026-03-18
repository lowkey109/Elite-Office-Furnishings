/**
 * Intelligence AI — ACTIVE EXECUTION
 *
 * Real work: Calls existing RSS/job signal scanners → writes new signals to DB.
 * Measures before/after officeMovRadar count so delta is auditable.
 * If all external fetches fail → returns "skipped" with reasons.
 */

import { db } from "../../../db";
import { ingestedLeads, officeMovRadar, companyIntelligence, dealHunterSignals, dealIntelligenceRecords } from "../../../../shared/schema";
import { desc, count, eq, sql } from "drizzle-orm";
import type { DepartmentResult } from "../companyOrchestrator";

export async function runIntelligenceAI(): Promise<DepartmentResult> {
  const start = Date.now();
  const actions: string[] = [];
  const blockers: string[] = [];
  const recordsUpdated: string[] = [];

  // ── Before state ──────────────────────────────────────────────────────────────
  const [beforeRadar] = await db.select({ n: count() }).from(officeMovRadar);
  const [beforeLeads] = await db.select({ n: count() }).from(ingestedLeads);
  const before = {
    officeMovRadarRows: beforeRadar.n,
    ingestedLeadsRows: beforeLeads.n,
  };

  let newsFeedSaved = 0;
  let jobSignalSaved = 0;
  let newsFeedError: string | null = null;
  let jobSignalError: string | null = null;

  // ── Action 1: Run News Feed Scan (RSS → officeMovRadar) ───────────────────────
  try {
    const { runNewsFeedScan } = await import("../../newsFeedScanner");
    const result = await runNewsFeedScan();
    newsFeedSaved = result.saved;
    if (result.saved > 0) {
      actions.push(`News feed scan: ${result.saved} new signals saved from ${result.processed} articles processed`);
      recordsUpdated.push(`office_mov_radar: +${result.saved} rows inserted from RSS feed scan`);
    } else {
      actions.push(`News feed scan ran: ${result.processed} articles checked, 0 new signals (all already seen or below threshold)`);
    }
  } catch (err: any) {
    newsFeedError = err.message;
    blockers.push(`News feed scanner error: ${err.message}`);
  }

  // ── Action 2: Run Job Signal Scan (hiring signals → officeMovRadar) ───────────
  try {
    const { runJobSignalScan } = await import("../../newsFeedScanner");
    const result = await runJobSignalScan();
    jobSignalSaved = result.saved;
    if (result.saved > 0) {
      actions.push(`Job signal scan: ${result.saved} new hiring signals saved from ${result.processed} job postings`);
      recordsUpdated.push(`office_mov_radar: +${result.saved} rows inserted from job signal scan`);
    } else {
      actions.push(`Job signal scan ran: ${result.processed} postings checked, 0 new signals`);
    }
  } catch (err: any) {
    jobSignalError = err.message;
    blockers.push(`Job signal scanner error: ${err.message}`);
  }

  // ── After state ───────────────────────────────────────────────────────────────
  const [afterRadar] = await db.select({ n: count() }).from(officeMovRadar);
  const [afterLeads] = await db.select({ n: count() }).from(ingestedLeads);

  const highScoreLeads = await db.select({ n: count() }).from(ingestedLeads)
    .where(sql`${ingestedLeads.score} >= 75`);
  const activeRadar = await db.select({ n: count() }).from(officeMovRadar)
    .where(sql`${officeMovRadar.status} IN ('active', 'new', 'New')`);
  const enriched = await db.select({ n: count() }).from(companyIntelligence)
    .where(sql`${companyIntelligence.confidenceScore} >= 70`);
  const activeDealSignals = await db.select({ n: count() }).from(dealHunterSignals)
    .where(sql`${dealHunterSignals.status} IN ('active', 'new')`);

  const totalNewSignals = newsFeedSaved + jobSignalSaved;
  const after = {
    officeMovRadarRows: afterRadar.n,
    ingestedLeadsRows: afterLeads.n,
  };

  // Determine status
  const bothFailed = !!newsFeedError && !!jobSignalError;
  const status = bothFailed ? "blocked"
    : totalNewSignals > 0 ? "completed"
    : blockers.length > 0 ? "partial"
    : "completed";

  return {
    department: "Intelligence",
    status,
    actionsTaken: actions,
    blockers,
    recordsUpdated,
    before,
    after,
    executionMs: Date.now() - start,
    metrics: {
      newSignalsSaved: totalNewSignals,
      newsFeedSaved,
      jobSignalSaved,
      totalRadarRows: afterRadar.n,
      radarDelta: afterRadar.n - beforeRadar.n,
      totalIngestedLeads: afterLeads.n,
      highScoreLeads: highScoreLeads[0].n,
      activeRadarSignals: activeRadar[0].n,
      enrichedCompanies: enriched[0].n,
      activeDealSignals: activeDealSignals[0].n,
    },
    recommendations: [
      totalNewSignals > 0 ? `${totalNewSignals} new signals in radar — SalesAI should create deal records` : "No new signals — scanners ran but found only known companies",
      !!newsFeedError ? "News feed scanner failing — check network/RSS URLs" : "News feed scanner operational",
      !!jobSignalError ? "Job signal scanner failing — check source URLs" : "Job signal scanner operational",
    ],
  };
}
