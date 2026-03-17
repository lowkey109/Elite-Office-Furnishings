/**
 * UPGRADE 5 — Global Intelligence Graph
 * Builds a relationship graph connecting:
 * company → building → suburb → zone → signals
 * company → subsidiary (hierarchy)
 * Exposes graph queries for the intelligence engine.
 */

import { db } from "../../db";
import { storage } from "../../storage";
import {
  intelligenceGraphEdges,
  companyHierarchyNodes,
  companyRelationships,
  suburbDemandSnapshots,
  companyZoneScores,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

const SAFE_MODE = process.env.SAFE_MODE === "true";

type EdgeType =
  | "located_in"
  | "generates_signal"
  | "in_suburb"
  | "in_zone"
  | "subsidiary_of"
  | "competes_with"
  | "expiring_lease";

async function upsertEdge(
  sourceType: string, sourceId: string, sourceName: string,
  targetType: string, targetId: string, targetName: string,
  edgeType: EdgeType, weight = 1.0, metadata?: Record<string, unknown>
): Promise<void> {
  const existing = await db
    .select()
    .from(intelligenceGraphEdges)
    .where(and(
      eq(intelligenceGraphEdges.sourceId, sourceId),
      eq(intelligenceGraphEdges.targetId, targetId),
      eq(intelligenceGraphEdges.edgeType, edgeType)
    ))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(intelligenceGraphEdges)
      .set({ weight, updatedAt: new Date() })
      .where(eq(intelligenceGraphEdges.id, existing[0].id));
  } else {
    await db.insert(intelligenceGraphEdges).values({
      sourceType, sourceId, sourceName,
      targetType, targetId, targetName,
      edgeType, weight,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  }
}

export async function buildGraphEdges(): Promise<{ edges: number }> {
  if (SAFE_MODE) {
    console.log("[IntelligenceGraph] SAFE_MODE — skipping graph build");
    return { edges: 0 };
  }

  console.log("[IntelligenceGraph] Building intelligence graph edges...");
  let edges = 0;

  // 1. Company → Building edges (from building signals)
  const buildingSignals = await storage.getBuildingSignals();
  for (const sig of buildingSignals) {
    if (!sig.observedCompany || !sig.buildingName) continue;
    await upsertEdge(
      "company", sig.id, sig.observedCompany,
      "building", `building:${sig.buildingName}`, sig.buildingName,
      "located_in", 0.8,
      { city: sig.city, address: sig.address }
    );
    edges++;
  }

  // 2. Company → Suburb edges (from company intelligence)
  const companies = await storage.getCompanyIntelligenceRecords({});
  for (const co of companies) {
    if (!co.city) continue;
    await upsertEdge(
      "company", co.id, co.companyName,
      "suburb", `suburb:${co.city}`, co.city,
      "in_suburb", Math.min(1.0, (co.confidenceScore ?? 50) / 100),
      { industry: co.industry, moveProbability: co.moveProbability }
    );
    edges++;
  }

  // 3. Suburb → Zone edges (from suburb demand snapshots)
  const suburbs = await db.select().from(suburbDemandSnapshots).limit(200);
  for (const sub of suburbs) {
    const zoneId = `zone:${sub.city}:${sub.demandTier}`;
    await upsertEdge(
      "suburb", `suburb:${sub.suburb ?? sub.city}`, sub.suburb ?? sub.city,
      "zone", zoneId, `${sub.city} ${sub.demandTier} zone`,
      "in_zone", Math.min(1.0, (sub.demandScore ?? 50) / 100),
      { demandTier: sub.demandTier, demandScore: sub.demandScore }
    );
    edges++;
  }

  // 4. Company → Signal edges (from office move radar)
  const radar = await storage.getOfficeMovRadarRecords({});
  for (const r of radar) {
    await upsertEdge(
      "company", `company:${r.companyName}`, r.companyName,
      "signal", r.id, `${r.signalType} signal`,
      "generates_signal", Math.min(1.0, (r.radarScore ?? 50) / 100),
      { signalType: r.signalType, city: r.city }
    );
    edges++;
  }

  // 5. Company hierarchy (subsidiary_of) edges
  const hierarchyRels = await db.select().from(companyRelationships)
    .where(eq(companyRelationships.relationshipType, "subsidiary_of"))
    .limit(200);

  for (const rel of hierarchyRels) {
    await upsertEdge(
      rel.fromEntityType, rel.fromEntityId, rel.fromEntityName,
      rel.toEntityType, rel.toEntityId, rel.toEntityName,
      "subsidiary_of", rel.strength / 100
    );
    edges++;
  }

  console.log(`[IntelligenceGraph] Built ${edges} graph edges`);
  return { edges };
}

export async function getCompanyGraph(companyName: string, depth = 2): Promise<{
  nodes: { id: string; name: string; type: string; properties?: Record<string, unknown> }[];
  edges: typeof intelligenceGraphEdges.$inferSelect[];
}> {
  const outgoing = await db
    .select()
    .from(intelligenceGraphEdges)
    .where(eq(intelligenceGraphEdges.sourceName, companyName))
    .limit(50);

  const incoming = await db
    .select()
    .from(intelligenceGraphEdges)
    .where(eq(intelligenceGraphEdges.targetName, companyName))
    .limit(50);

  const allEdges = [...outgoing, ...incoming];
  const nodeIds = new Set<string>();
  const nodes: { id: string; name: string; type: string }[] = [];

  for (const edge of allEdges) {
    if (!nodeIds.has(edge.sourceId)) {
      nodeIds.add(edge.sourceId);
      nodes.push({ id: edge.sourceId, name: edge.sourceName, type: edge.sourceType });
    }
    if (!nodeIds.has(edge.targetId)) {
      nodeIds.add(edge.targetId);
      nodes.push({ id: edge.targetId, name: edge.targetName, type: edge.targetType });
    }
  }

  return { nodes, edges: allEdges };
}

export async function getSuburbGraph(city: string): Promise<{
  nodes: { id: string; name: string; type: string }[];
  edges: typeof intelligenceGraphEdges.$inferSelect[];
  stats: { companyCount: number; signalCount: number; topZone: string | null };
}> {
  const cityEdges = await db
    .select()
    .from(intelligenceGraphEdges)
    .where(eq(intelligenceGraphEdges.targetName, city))
    .limit(100);

  const zoneEdges = await db
    .select()
    .from(intelligenceGraphEdges)
    .where(and(
      eq(intelligenceGraphEdges.sourceType, "suburb"),
      eq(intelligenceGraphEdges.edgeType, "in_zone")
    ))
    .limit(50);

  const allEdges = [...cityEdges, ...zoneEdges];
  const nodeMap = new Map<string, { id: string; name: string; type: string }>();

  for (const edge of allEdges) {
    nodeMap.set(edge.sourceId, { id: edge.sourceId, name: edge.sourceName, type: edge.sourceType });
    nodeMap.set(edge.targetId, { id: edge.targetId, name: edge.targetName, type: edge.targetType });
  }

  const companyEdges = cityEdges.filter(e => e.sourceType === "company");
  const signalEdges = allEdges.filter(e => e.targetType === "signal");
  const zoneNodes = zoneEdges.map(e => e.targetName);
  const topZone = zoneNodes.length > 0 ? zoneNodes[0] : null;

  return {
    nodes: Array.from(nodeMap.values()),
    edges: allEdges,
    stats: {
      companyCount: companyEdges.length,
      signalCount: signalEdges.length,
      topZone,
    },
  };
}

export async function getGraphStats(): Promise<{
  totalEdges: number;
  edgesByType: Record<string, number>;
  topConnectedCompanies: { name: string; connections: number }[];
}> {
  const allEdges = await db.select().from(intelligenceGraphEdges).limit(2000);

  const edgesByType: Record<string, number> = {};
  const companyCounts: Record<string, number> = {};

  for (const edge of allEdges) {
    edgesByType[edge.edgeType] = (edgesByType[edge.edgeType] ?? 0) + 1;
    if (edge.sourceType === "company") {
      companyCounts[edge.sourceName] = (companyCounts[edge.sourceName] ?? 0) + 1;
    }
  }

  const topConnectedCompanies = Object.entries(companyCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, connections]) => ({ name, connections }));

  return {
    totalEdges: allEdges.length,
    edgesByType,
    topConnectedCompanies,
  };
}

export async function runGraphRefresh(): Promise<void> {
  const { edges } = await buildGraphEdges();
  const stats = await getGraphStats();
  console.log(`[IntelligenceGraph] Refresh complete: ${edges} edges built, ${stats.totalEdges} total in graph`);
}
