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
      metadata: metadata && typeof metadata === "object"
        ? (metadata as Record<string, unknown>)
        : metadata == null
          ? null
          : { value: String(metadata) },
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

// ─── Graph Query Engine (Stage 1.4) ──────────────────────────────────────────

export interface GraphNode {
  entityType: string;
  entityId: string;
  entityName: string;
  weight: number;
  edgeType: string;
}

export async function getNeighbors(
  entityType: string,
  entityId: string,
  depth = 1
): Promise<GraphNode[]> {
  const visited = new Set<string>();
  let frontier: GraphNode[] = [];

  const directEdges = await db
    .select()
    .from(intelligenceGraphEdges)
    .where(
      and(
        eq(intelligenceGraphEdges.sourceType, entityType),
        eq(intelligenceGraphEdges.sourceId, entityId)
      )
    )
    .limit(100);

  frontier = directEdges.map((e) => ({
    entityType: e.targetType,
    entityId: e.targetId,
    entityName: e.targetName,
    weight: e.weight,
    edgeType: e.edgeType,
  }));

  visited.add(`${entityType}:${entityId}`);

  if (depth > 1) {
    const secondDegree: GraphNode[] = [];
    for (const node of frontier) {
      const key = `${node.entityType}:${node.entityId}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const next = await db
        .select()
        .from(intelligenceGraphEdges)
        .where(
          and(
            eq(intelligenceGraphEdges.sourceType, node.entityType),
            eq(intelligenceGraphEdges.sourceId, node.entityId)
          )
        )
        .limit(50);
      for (const e of next) {
        const nkey = `${e.targetType}:${e.targetId}`;
        if (!visited.has(nkey)) {
          secondDegree.push({
            entityType: e.targetType,
            entityId: e.targetId,
            entityName: e.targetName,
            weight: e.weight * 0.5,
            edgeType: e.edgeType,
          });
        }
      }
    }
    frontier = [...frontier, ...secondDegree];
  }

  return frontier;
}

export async function getSecondDegreeConnections(
  entityType: string,
  entityId: string
): Promise<GraphNode[]> {
  return getNeighbors(entityType, entityId, 2);
}

export async function getCompanyNetwork(companyId: string): Promise<{
  direct: GraphNode[];
  secondDegree: GraphNode[];
  connectionCount: number;
  networkStrength: number;
}> {
  const direct = await getNeighbors("company", companyId, 1);
  const secondDegree = (await getNeighbors("company", companyId, 2)).filter(
    (n) => !direct.some((d) => d.entityId === n.entityId)
  );
  const networkStrength = Math.min(100, direct.length * 10 + secondDegree.length * 3);
  return { direct, secondDegree, connectionCount: direct.length + secondDegree.length, networkStrength };
}

export async function getConnectedOpportunities(companyId: string): Promise<GraphNode[]> {
  const neighbors = await getNeighbors("company", companyId, 2);
  return neighbors.filter((n) => n.entityType === "opportunity" || n.entityType === "signal");
}

export async function getCompaniesInSameBuilding(buildingId: string): Promise<GraphNode[]> {
  const edges = await db
    .select()
    .from(intelligenceGraphEdges)
    .where(
      and(
        eq(intelligenceGraphEdges.targetId, buildingId),
        eq(intelligenceGraphEdges.edgeType, "located_in")
      )
    )
    .limit(100);
  return edges.map((e) => ({
    entityType: e.sourceType,
    entityId: e.sourceId,
    entityName: e.sourceName,
    weight: e.weight,
    edgeType: e.edgeType,
  }));
}

export async function getCompaniesInSameSuburb(suburb: string): Promise<GraphNode[]> {
  const edges = await db
    .select()
    .from(intelligenceGraphEdges)
    .where(
      and(
        eq(intelligenceGraphEdges.targetId, `suburb:${suburb}`),
        eq(intelligenceGraphEdges.edgeType, "in_suburb")
      )
    )
    .limit(100);
  return edges.map((e) => ({
    entityType: e.sourceType,
    entityId: e.sourceId,
    entityName: e.sourceName,
    weight: e.weight,
    edgeType: e.edgeType,
  }));
}

export async function getCompaniesInSameIndustry(industry: string): Promise<GraphNode[]> {
  const edges = await db
    .select()
    .from(intelligenceGraphEdges)
    .where(eq(intelligenceGraphEdges.targetId, `industry:${industry}`))
    .limit(100);
  return edges.map((e) => ({
    entityType: e.sourceType,
    entityId: e.sourceId,
    entityName: e.sourceName,
    weight: e.weight,
    edgeType: e.edgeType,
  }));
}

export async function getGraphPaths(
  entityType: string,
  entityId: string,
  maxDepth = 2
): Promise<{ path: GraphNode[]; depth: number }[]> {
  const paths: { path: GraphNode[]; depth: number }[] = [];

  async function traverse(
    currentType: string,
    currentId: string,
    currentPath: GraphNode[],
    depth: number
  ) {
    if (depth >= maxDepth) return;
    const edges = await db
      .select()
      .from(intelligenceGraphEdges)
      .where(
        and(
          eq(intelligenceGraphEdges.sourceType, currentType),
          eq(intelligenceGraphEdges.sourceId, currentId)
        )
      )
      .limit(20);
    for (const edge of edges) {
      const node: GraphNode = {
        entityType: edge.targetType,
        entityId: edge.targetId,
        entityName: edge.targetName,
        weight: edge.weight,
        edgeType: edge.edgeType,
      };
      const newPath = [...currentPath, node];
      paths.push({ path: newPath, depth: depth + 1 });
      if (depth + 1 < maxDepth) {
        await traverse(edge.targetType, edge.targetId, newPath, depth + 1);
      }
    }
  }

  await traverse(entityType, entityId, [], 0);
  return paths.slice(0, 100);
}

// ─── Event Hook: upsert single edge from system events ───────────────────────

export async function onSignalCreated(params: {
  companyName: string;
  signalId: string;
  city?: string;
}): Promise<void> {
  await upsertEdge(
    "company", `company:${params.companyName}`, params.companyName,
    "signal", params.signalId, "signal",
    "generates_signal", 0.8, { city: params.city }
  );
}

export async function onTenantCreated(params: {
  companyId: string;
  companyName: string;
  buildingId: string;
  buildingName: string;
  suburb?: string;
}): Promise<void> {
  await upsertEdge(
    "company", params.companyId, params.companyName,
    "building", params.buildingId, params.buildingName,
    "located_in", 0.95, {}
  );
  if (params.suburb) {
    await upsertEdge(
      "building", params.buildingId, params.buildingName,
      "suburb", `suburb:${params.suburb}`, params.suburb,
      "in_suburb", 1.0, {}
    );
  }
}

export async function onOpportunityCreated(params: {
  companyId: string;
  companyName: string;
  opportunityId: string;
}): Promise<void> {
  await upsertEdge(
    "company", params.companyId, params.companyName,
    "opportunity", params.opportunityId, "opportunity",
    "generates_signal", 0.9, {}
  );
}

// ─── Graph-derived network strength for a company ────────────────────────────

export async function onPartnerLinked(params: {
  companyId: string;
  companyName: string;
  partnerId: string;
  partnerName: string;
  partnerType: string;
  opportunityId?: string;
  opportunityTitle?: string;
}): Promise<void> {
  // Company → Partner edge
  await upsertEdge(
    "company", params.companyId, params.companyName,
    "partner", params.partnerId, params.partnerName,
    "generates_signal" as EdgeType, 0.85,
    { partnerType: params.partnerType, role: "partner_routing" }
  );

  // Opportunity → Partner edge (if opportunityId provided)
  if (params.opportunityId) {
    await upsertEdge(
      "opportunity", params.opportunityId, params.opportunityTitle ?? "opportunity",
      "partner", params.partnerId, params.partnerName,
      "generates_signal" as EdgeType, 0.9,
      { partnerType: params.partnerType }
    );
  }
}

export async function getNetworkStrength(companyId: string): Promise<number> {
  const { networkStrength } = await getCompanyNetwork(companyId);
  return networkStrength;
}
