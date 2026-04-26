/**
 * UPGRADE 1 — Tenant Lease Expiry Engine
 * Infers lease expiry dates from existing company/radar data,
 * generates relocation predictions, and surfaces opportunities.
 */

import { db } from "../../db";
import { storage } from "../../storage";
import {
  leaseRecords,
  leaseExpiryPredictions,
  officeMovRadar,
} from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";

const SAFE_MODE = process.env.SAFE_MODE === "true";

// Australian commercial lease terms: typically 3, 5, or 7 years
const DEFAULT_LEASE_TERMS = [3, 5, 7];

// Signal types that strongly indicate a lease expiry scenario
const LEASE_SIGNAL_TYPES = new Set([
  "lease_activity",
  "office_search",
  "sublease",
  "building_move_signal",
  "new_office_signal",
  "coworking_exit",
  "facilities_hiring",
  "office_relocation",
]);

function inferLeaseExpiry(signalDate: string | null, termYears = 5): { expiryYear: number; quarter: string } {
  const base = signalDate ? new Date(signalDate) : new Date();
  // If company is actively searching, their lease likely expires within 12–24 months
  const expiryDate = new Date(base.getFullYear() + 1, base.getMonth(), 1);
  const month = expiryDate.getMonth();
  const quarter = month < 3 ? "Q1" : month < 6 ? "Q2" : month < 9 ? "Q3" : "Q4";
  return { expiryYear: expiryDate.getFullYear(), quarter };
}

function scoreLeasePrediction(radarScore: number, signalCount: number, moveProbability: number): number {
  const base = Math.round((radarScore * 0.4) + (Math.min(signalCount, 10) * 3) + (moveProbability * 0.3));
  return Math.min(100, Math.max(0, base));
}

function urgencyFromScore(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export async function scanLeaseExpirySignals(): Promise<{ processed: number; created: number; updated: number }> {
  console.log("[LeaseExpiry] Scanning for lease expiry signals...");

  const [companies, radarRecords] = await Promise.all([
    storage.getCompanyIntelligenceRecords({}),
    storage.getOfficeMovRadarRecords({}),
  ]);

  let created = 0;
  let updated = 0;

  // Process radar records that indicate lease activity
  const leaseRadar = radarRecords.filter(r =>
    LEASE_SIGNAL_TYPES.has(r.signalType) ||
    (r.confidenceLevel === "high" && (r.radarScore ?? 0) > 50)
  );

  for (const radar of leaseRadar) {
    if (!radar.city) continue;

    // Check if we already have a lease record for this company
    const existing = await db
      .select()
      .from(leaseRecords)
      .where(and(
        eq(leaseRecords.companyName, radar.companyName),
        eq(leaseRecords.city, radar.city)
      ))
      .limit(1);

    const { expiryYear, quarter } = inferLeaseExpiry(radar.dateDetected ? radar.dateDetected.toISOString() : null);
    const score = scoreLeasePrediction(radar.radarScore ?? 50, 1, 60);

    if (existing.length === 0) {
      await db.insert(leaseRecords).values({
        companyName: radar.companyName,
        city: radar.city,
        state: radar.state ?? null,
        suburb: null,
        leaseExpiryDate: `${expiryYear}-${quarter}`,
        leaseStatus: "expiring_soon",
        dataSource: "inferred",
        confidenceScore: score,
        notes: `Inferred from radar signal: ${radar.signalType}`,
      });
      created++;
    }
  }

  // Process company intelligence profiles with high move probability
  const highMoveProb = companies.filter(c => (c.moveProbability ?? 0) >= 60);
  for (const company of highMoveProb) {
    if (!company.city) continue;

    const existing = await db
      .select()
      .from(leaseRecords)
      .where(and(
        eq(leaseRecords.companyName, company.companyName),
        eq(leaseRecords.city, company.city)
      ))
      .limit(1);

    if (existing.length === 0) {
      const { expiryYear, quarter } = inferLeaseExpiry(company.latestSignalDate ? company.latestSignalDate.toISOString() : null);
      const score = scoreLeasePrediction(company.confidenceScore ?? 50, company.radarSignalCount ?? 0, company.moveProbability ?? 60);

      await db.insert(leaseRecords).values({
        companyName: company.companyName,
        companyIntelligenceId: company.id,
        city: company.city,
        state: company.state ?? null,
        leaseExpiryDate: `${expiryYear}-${quarter}`,
        leaseStatus: "expiring_soon",
        dataSource: "inferred",
        confidenceScore: score,
        notes: `Inferred from company intelligence: move probability ${company.moveProbability}%`,
      });
      created++;
    }
  }

  console.log(`[LeaseExpiry] Scan complete: ${created} created, ${updated} updated`);
  return { processed: leaseRadar.length + highMoveProb.length, created, updated };
}

export async function predictLeaseExpiry(): Promise<{ predictions: number }> {
  console.log("[LeaseExpiry] Generating expiry predictions...");

  const records = await db
    .select()
    .from(leaseRecords)
    .where(eq(leaseRecords.leaseStatus, "expiring_soon"))
    .limit(100);

  let predictions = 0;
  for (const record of records) {
    const existing = await db
      .select()
      .from(leaseExpiryPredictions)
      .where(eq(leaseExpiryPredictions.companyName, record.companyName))
      .limit(1);

    if (existing.length > 0) continue;

    const expParts = (record.leaseExpiryDate ?? "").split("-");
    const expiryYear = expParts[0] ? parseInt(expParts[0]) : new Date().getFullYear() + 1;
    const quarter = expParts[1] ?? "Q2";

    const relocationProb = Math.min(100, (record.confidenceScore ?? 50) + 10);
    const oppScore = record.confidenceScore ?? 50;
    const estValue = (record.estimatedSqm ?? 200) * 800; // ~$800/sqm fit-out estimate

    await db.insert(leaseExpiryPredictions).values({
      leaseRecordId: record.id,
      companyName: record.companyName,
      city: record.city,
      predictedExpiryYear: expiryYear,
      predictedExpiryQuarter: quarter,
      relocationProbability: relocationProb,
      opportunityScore: oppScore,
      urgencyTier: urgencyFromScore(oppScore),
      estimatedProjectValue: estValue,
      signalCount: 1,
      reasoningSummary: `Lease expiry predicted ${quarter} ${expiryYear}. Relocation probability: ${relocationProb}%.`,
      status: "open",
    });
    predictions++;
  }

  console.log(`[LeaseExpiry] Generated ${predictions} predictions`);
  return { predictions };
}

export async function getLeaseExpiryOpportunities(limit = 20): Promise<{
  id: string;
  companyName: string;
  city: string;
  predictedExpiryYear: number | null;
  predictedExpiryQuarter: string | null;
  relocationProbability: number;
  opportunityScore: number;
  urgencyTier: string;
  estimatedProjectValue: number | null;
  reasoningSummary: string | null;
  status: string;
}[]> {
  const results = await db
    .select()
    .from(leaseExpiryPredictions)
    .where(eq(leaseExpiryPredictions.status, "open"))
    .orderBy(desc(leaseExpiryPredictions.opportunityScore))
    .limit(limit);

  // If no predictions yet, fall back to radar records with lease signals
  if (results.length === 0) {
    const radar = await storage.getOfficeMovRadarRecords({});
    const leaseRadar = radar
      .filter(r => LEASE_SIGNAL_TYPES.has(r.signalType))
      .slice(0, limit);

    return leaseRadar.map(r => {
      const { expiryYear, quarter } = inferLeaseExpiry(r.dateDetected ? r.dateDetected.toISOString() : null);
      return {
        id: r.id,
        companyName: r.companyName,
        city: r.city ?? "",
        predictedExpiryYear: expiryYear,
        predictedExpiryQuarter: quarter,
        relocationProbability: Math.min(100, (r.radarScore ?? 50) + 15),
        opportunityScore: r.radarScore ?? 50,
        urgencyTier: urgencyFromScore(r.radarScore ?? 50),
        estimatedProjectValue: parseInt(String(r.estimatedProjectValue ?? "0").replace(/[^0-9]/g, "")) || null,
        reasoningSummary: `Signal type: ${r.signalType?.replace(/_/g, " ")}.`,
        status: "open",
      };
    });
  }

  return results.map(r => ({
    id: r.id,
    companyName: r.companyName,
    city: r.city,
    predictedExpiryYear: r.predictedExpiryYear,
    predictedExpiryQuarter: r.predictedExpiryQuarter,
    relocationProbability: r.relocationProbability,
    opportunityScore: r.opportunityScore,
    urgencyTier: r.urgencyTier,
    estimatedProjectValue: r.estimatedProjectValue,
    reasoningSummary: r.reasoningSummary,
    status: r.status,
  }));
}

export async function runLeaseExpiryEngine(): Promise<void> {
  if (SAFE_MODE) {
    console.log("[LeaseExpiry] SAFE_MODE — skipping live scan");
    return;
  }
  const scan = await scanLeaseExpirySignals();
  const predict = await predictLeaseExpiry();
  console.log(`[LeaseExpiry] Engine run complete: ${scan.created} records, ${predict.predictions} predictions`);
}
