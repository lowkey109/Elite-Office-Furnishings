/**
 * Cluster Engine (Stage 1.5)
 * Detects growth clusters, relocation clusters, high-risk buildings,
 * and industry density clusters from real intelligence data.
 * Creates CLUSTER_MEMBER edges in the graph.
 */

import { db } from "../../db";
import {
  intelligenceSignals,
  officeMovRadar,
  companyBuildingEdges,
  suburbDemandSnapshots,
  buildingRiskSnapshots,
  clusters,
  intelligenceGraphEdges,
} from "@shared/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

type ClusterType = "growth" | "relocation" | "high_risk_building" | "industry_density";

interface CityGroup {
  city: string;
  signals: Array<{ companyName: string; id: string; signalType: string }>;
  relocations: number;
  industries: Record<string, number>;
  avgScore: number;
}

async function upsertClusterEdge(
  clusterId: string,
  entityId: string,
  entityName: string
): Promise<void> {
  const existing = await db
    .select()
    .from(intelligenceGraphEdges)
    .where(
      and(
        eq(intelligenceGraphEdges.sourceId, clusterId),
        eq(intelligenceGraphEdges.targetId, entityId),
        eq(intelligenceGraphEdges.edgeType, "cluster_member")
      )
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(intelligenceGraphEdges).values({
      sourceType: "cluster",
      sourceId: clusterId,
      sourceName: `cluster:${clusterId}`,
      targetType: "company",
      targetId: entityId,
      targetName: entityName,
      edgeType: "cluster_member",
      weight: 1.0,
    });
  }
}

export async function computeClusters(): Promise<{
  created: number;
  updated: number;
  edges: number;
}> {
  let created = 0;
  let updated = 0;
  let edges = 0;

  // ── 1. Growth + Relocation clusters (by city) ──────────────────────────────
  const signals = await db
    .select()
    .from(intelligenceSignals)
    .where(sql`${intelligenceSignals.status} = 'active' AND ${intelligenceSignals.opportunityScore} >= 40`)
    .orderBy(desc(intelligenceSignals.opportunityScore))
    .limit(500);

  const cityMap: Record<string, CityGroup> = {};
  for (const sig of signals) {
    const city = sig.city ?? "Unknown";
    if (!cityMap[city]) {
      cityMap[city] = { city, signals: [], relocations: 0, industries: {}, avgScore: 0 };
    }
    cityMap[city].signals.push({ companyName: sig.companyName, id: sig.id, signalType: sig.signalType });
    if (sig.signalType?.includes("relocation") || sig.relocationProbability > 60) {
      cityMap[city].relocations++;
    }
    if (sig.industry) {
      cityMap[city].industries[sig.industry] = (cityMap[city].industries[sig.industry] ?? 0) + 1;
    }
    cityMap[city].avgScore += sig.opportunityScore;
  }

  for (const [city, group] of Object.entries(cityMap)) {
    if (group.signals.length < 3) continue;
    group.avgScore = group.avgScore / group.signals.length;

    const topIndustry = Object.entries(group.industries).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
    const clusterType: ClusterType = group.relocations >= 3 ? "relocation" : "growth";
    const clusterScore = Math.min(100, group.avgScore * 0.7 + group.signals.length * 1.5);
    const entityIds = group.signals.map((s) => s.id);

    // Check existing
    const [existing] = await db
      .select()
      .from(clusters)
      .where(and(eq(clusters.city, city), eq(clusters.type, clusterType)))
      .limit(1);

    let clusterId: string;
    if (existing) {
      await db
        .update(clusters)
        .set({
          clusterScore,
          entityCount: group.signals.length,
          entityIds,
          topIndustry,
          relocationsDetected: group.relocations,
          growthSignals: group.signals.length,
          updatedAt: new Date(),
        })
        .where(eq(clusters.id, existing.id));
      clusterId = existing.id;
      updated++;
    } else {
      const [row] = await db
        .insert(clusters)
        .values({
          type: clusterType,
          region: city,
          city,
          clusterScore,
          entityCount: group.signals.length,
          entityIds,
          topIndustry,
          relocationsDetected: group.relocations,
          growthSignals: group.signals.length,
        })
        .returning();
      clusterId = row.id;
      created++;
    }

    // Create CLUSTER_MEMBER edges
    for (const sig of group.signals.slice(0, 20)) {
      await upsertClusterEdge(clusterId, `company:${sig.companyName}`, sig.companyName);
      edges++;
    }
  }

  // ── 2. Industry Density clusters (by industry across all cities) ────────────
  const radar = await db
    .select()
    .from(officeMovRadar)
    .where(sql`${officeMovRadar.status} = 'New'`)
    .limit(500);

  const industryMap: Record<string, { count: number; cities: Record<string, number>; companies: string[] }> = {};
  for (const r of radar) {
    const industry = r.industry ?? "General";
    if (!industryMap[industry]) {
      industryMap[industry] = { count: 0, cities: {}, companies: [] };
    }
    industryMap[industry].count++;
    industryMap[industry].cities[r.city ?? "Unknown"] = (industryMap[industry].cities[r.city ?? "Unknown"] ?? 0) + 1;
    industryMap[industry].companies.push(r.companyName);
  }

  for (const [industry, group] of Object.entries(industryMap)) {
    if (group.count < 5) continue;
    const topCity = Object.entries(group.cities).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "Australia";
    const clusterScore = Math.min(100, group.count * 3);

    const [existing] = await db
      .select()
      .from(clusters)
      .where(and(eq(clusters.type, "industry_density"), eq(clusters.region, industry)))
      .limit(1);

    let clusterId: string;
    if (existing) {
      await db
        .update(clusters)
        .set({ clusterScore, entityCount: group.count, updatedAt: new Date() })
        .where(eq(clusters.id, existing.id));
      clusterId = existing.id;
      updated++;
    } else {
      const [row] = await db
        .insert(clusters)
        .values({
          type: "industry_density",
          region: industry,
          city: topCity,
          clusterScore,
          entityCount: group.count,
          entityIds: group.companies.slice(0, 50),
          topIndustry: industry,
        })
        .returning();
      clusterId = row.id;
      created++;
    }

    for (const company of group.companies.slice(0, 15)) {
      await upsertClusterEdge(clusterId, `company:${company}`, company);
      edges++;
    }
  }

  // ── 3. High-Risk Building clusters ─────────────────────────────────────────
  const riskBuildings = await db
    .select()
    .from(buildingRiskSnapshots)
    .where(sql`${buildingRiskSnapshots.vacancyRiskScore} >= 60`)
    .limit(50);

  for (const bldg of riskBuildings) {
    const region = `${bldg.buildingName} (${bldg.city})`;
    const [existing] = await db
      .select()
      .from(clusters)
      .where(and(eq(clusters.type, "high_risk_building"), eq(clusters.region, region)))
      .limit(1);

    if (existing) {
      await db
        .update(clusters)
        .set({ clusterScore: bldg.vacancyRiskScore, updatedAt: new Date() })
        .where(eq(clusters.id, existing.id));
      updated++;
    } else {
      await db.insert(clusters).values({
        type: "high_risk_building",
        region,
        city: bldg.city,
        clusterScore: bldg.vacancyRiskScore,
        entityCount: bldg.tenantCount ?? 0,
        vacancyRisk: (bldg.vacancyRiskScore ?? 0) / 100,
        entityIds: [],
      });
      created++;
    }
  }

  console.log(`[ClusterEngine] Complete: ${created} created, ${updated} updated, ${edges} CLUSTER_MEMBER edges`);
  return { created, updated, edges };
}

export async function getClusterStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  topClusters: Array<{ id: string; type: string; region: string; score: number; entityCount: number }>;
}> {
  const all = await db.select().from(clusters).orderBy(desc(clusters.clusterScore)).limit(200);
  const byType: Record<string, number> = {};
  for (const c of all) {
    byType[c.type] = (byType[c.type] ?? 0) + 1;
  }
  return {
    total: all.length,
    byType,
    topClusters: all.slice(0, 10).map((c) => ({
      id: c.id,
      type: c.type,
      region: c.region,
      score: c.clusterScore ?? 0,
      entityCount: c.entityCount ?? 0,
    })),
  };
}

export async function getClustersForMap(): Promise<Array<{
  id: string;
  type: string;
  city: string;
  region: string;
  clusterScore: number;
  entityCount: number;
  topIndustry?: string;
}>> {
  const all = await db
    .select()
    .from(clusters)
    .where(sql`${clusters.clusterScore} >= 20`)
    .orderBy(desc(clusters.clusterScore))
    .limit(100);

  return all.map((c) => ({
    id: c.id,
    type: c.type,
    city: c.city ?? c.region,
    region: c.region,
    clusterScore: c.clusterScore ?? 0,
    entityCount: c.entityCount ?? 0,
    topIndustry: c.topIndustry ?? undefined,
  }));
}
