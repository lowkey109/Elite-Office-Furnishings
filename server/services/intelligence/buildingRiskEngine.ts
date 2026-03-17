// ─── Building Risk Engine ─────────────────────────────────────────────────────
// Computes and persists building-level vacancy risk snapshots.

import { db } from "../../db";
import {
  buildingSignals,
  buildingRiskSnapshots,
  InsertBuildingRiskSnapshot,
} from "@shared/schema";
import { sql, desc } from "drizzle-orm";

interface BuildingRiskInput {
  buildingName: string;
  buildingAddress?: string;
  suburb?: string;
  city: string;
  state?: string;
  lat?: number;
  lng?: number;
}

export type RiskTier = "critical" | "high" | "medium" | "low";

function scoreToTier(score: number): RiskTier {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export async function computeBuildingRisk(building: BuildingRiskInput): Promise<{
  vacancyRiskScore: number;
  tenantTurnoverRate: number;
  riskTier: RiskTier;
}> {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  const signals = await db
    .select()
    .from(buildingSignals)
    .where(
      sql`lower(${buildingSignals.city}) = ${building.city.toLowerCase()} AND ${buildingSignals.createdAt} > ${thirtyDaysAgo}`
    )
    .limit(100);

  const relevantSignals = signals.filter(
    (s) =>
      s.buildingName?.toLowerCase().includes(building.buildingName.toLowerCase()) ||
      building.buildingName.toLowerCase().includes((s.buildingName ?? "").toLowerCase())
  );

  const totalSignals = relevantSignals.length;
  const moveSignals = relevantSignals.filter((s) =>
    ["move_out", "sublease", "vacancy", "tenant_exit"].includes(s.signalType)
  ).length;

  const tenantTurnoverRate = totalSignals > 0 ? (moveSignals / Math.max(1, totalSignals)) * 100 : 0;
  const vacancyRiskScore = Math.min(100, moveSignals * 15 + totalSignals * 5);
  const riskTier = scoreToTier(vacancyRiskScore);

  return { vacancyRiskScore, tenantTurnoverRate, riskTier };
}

export async function snapshotBuildingRisk(building: BuildingRiskInput): Promise<string | null> {
  const risk = await computeBuildingRisk(building);
  const snapshotDate = new Date().toISOString().split("T")[0];

  const values: InsertBuildingRiskSnapshot = {
    buildingName: building.buildingName,
    buildingAddress: building.buildingAddress,
    suburb: building.suburb,
    city: building.city,
    state: building.state,
    lat: building.lat,
    lng: building.lng,
    vacancyRiskScore: risk.vacancyRiskScore,
    tenantTurnoverRate: risk.tenantTurnoverRate,
    activeSignalCount: 0,
    tenantCount: 0,
    riskTier: risk.riskTier,
    snapshotDate,
  };

  const [inserted] = await db
    .insert(buildingRiskSnapshots)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: buildingRiskSnapshots.id });

  return inserted?.id ?? null;
}

export async function getHighRiskBuildings(limit = 10): Promise<typeof buildingRiskSnapshots.$inferSelect[]> {
  return db
    .select()
    .from(buildingRiskSnapshots)
    .where(sql`${buildingRiskSnapshots.riskTier} IN ('critical', 'high')`)
    .orderBy(desc(buildingRiskSnapshots.vacancyRiskScore))
    .limit(limit);
}

export async function refreshBuildingRiskSnapshots(): Promise<{ processed: number }> {
  const cities = ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra"];
  const buildings = await db.select().from(buildingSignals).limit(200);

  const uniqueBuildings = new Map<string, BuildingRiskInput>();
  for (const sig of buildings) {
    if (!sig.buildingName) continue;
    const key = `${sig.buildingName}|${sig.city}`;
    if (!uniqueBuildings.has(key)) {
      uniqueBuildings.set(key, {
        buildingName: sig.buildingName,
        buildingAddress: sig.address ?? undefined,
        suburb: sig.suburb ?? undefined,
        city: sig.city,
        state: sig.state ?? undefined,
      });
    }
  }

  let processed = 0;
  for (const building of uniqueBuildings.values()) {
    await snapshotBuildingRisk(building);
    processed++;
  }

  console.log(`[BuildingRiskEngine] Refreshed ${processed} building risk snapshots`);
  return { processed };
}
