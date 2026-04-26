// ─── Demand Forecast Engine ───────────────────────────────────────────────────
// Aggregates suburb-level demand from intelligence signals and radar data.

import { db } from "../../db";
import {
  officeMovRadar,
  dealHunterSignals,
  intelligenceSignals,
  suburbDemandSnapshots,
  InsertSuburbDemandSnapshot,
} from "@shared/schema";
import { sql, eq, gte, desc } from "drizzle-orm";

export type DemandTier = "hot" | "high" | "medium" | "low";

function scoreToTier(score: number): DemandTier {
  if (score >= 75) return "hot";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

interface SuburbSignalAggregate {
  suburb: string;
  city: string;
  state?: string;
  signalCount: number;
  companyCount: number;
  totalProjectValue: number;
  relocationsIn: number;
  relocationsOut: number;
}

export async function aggregateSuburbDemand(city: string): Promise<SuburbSignalAggregate[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const radarRows = await db
    .select({
      city: officeMovRadar.city,
      state: officeMovRadar.state,
      companyName: officeMovRadar.companyName,
      signalType: officeMovRadar.signalType,
      estimatedProjectValue: officeMovRadar.estimatedProjectValue,
    })
    .from(officeMovRadar)
    .where(
      sql`lower(${officeMovRadar.city}) = ${city.toLowerCase()} AND ${officeMovRadar.dateDetected} > ${thirtyDaysAgo}`
    )
    .limit(500);

  const suburbMap = new Map<string, SuburbSignalAggregate>();

  for (const row of radarRows) {
    const suburb = row.city;
    const existing = suburbMap.get(suburb) ?? {
      suburb,
      city: row.city,
      state: row.state ?? undefined,
      signalCount: 0,
      companyCount: 0,
      totalProjectValue: 0,
      relocationsIn: 0,
      relocationsOut: 0,
    };

    existing.signalCount++;
    existing.companyCount++;
    if (row.estimatedProjectValue) {
      existing.totalProjectValue += Number(row.estimatedProjectValue) || 0;
    }
    if (["office_move", "new_lease", "tenant_move_in"].includes(row.signalType)) {
      existing.relocationsIn++;
    }

    suburbMap.set(suburb, existing);
  }

  return Array.from(suburbMap.values());
}

export async function snapshotSuburbDemand(city: string): Promise<{ processed: number }> {
  const aggregates = await aggregateSuburbDemand(city);
  const snapshotDate = new Date().toISOString().split("T")[0];
  let processed = 0;

  for (const agg of aggregates) {
    const maxSignals = Math.max(...aggregates.map((a) => a.signalCount), 1);
    const demandScore = Math.min(
      100,
      (agg.signalCount / maxSignals) * 60 +
        (agg.relocationsIn / Math.max(1, agg.signalCount)) * 25 +
        (agg.companyCount / Math.max(1, agg.signalCount)) * 15
    );

    const values: InsertSuburbDemandSnapshot = {
      suburb: agg.suburb,
      city: agg.city,
      state: agg.state,
      demandScore,
      activeCompanies: agg.companyCount,
      recentSignals: agg.signalCount,
      relocationInflow: agg.relocationsIn,
      relocationOutflow: agg.relocationsOut,
      averageProjectValue:
        agg.companyCount > 0 ? agg.totalProjectValue / agg.companyCount : 0,
      demandTier: scoreToTier(demandScore),
      snapshotDate,
    };

    await db.insert(suburbDemandSnapshots).values(values).onConflictDoNothing();
    processed++;
  }

  console.log(`[DemandForecastEngine] Snapshotted ${processed} suburbs for ${city}`);
  return { processed };
}

export async function runDemandAggregation(): Promise<{ totalSuburbs: number }> {
  const cities = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra"];
  let totalSuburbs = 0;

  for (const city of cities) {
    const result = await snapshotSuburbDemand(city);
    totalSuburbs += result.processed;
  }

  return { totalSuburbs };
}

export async function getTopDemandSuburbs(limit = 10): Promise<typeof suburbDemandSnapshots.$inferSelect[]> {
  return db
    .select()
    .from(suburbDemandSnapshots)
    .where(sql`${suburbDemandSnapshots.demandTier} IN ('hot', 'high')`)
    .orderBy(desc(suburbDemandSnapshots.demandScore))
    .limit(limit);
}
