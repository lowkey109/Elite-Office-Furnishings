/**
 * UPGRADE 2 — Company Hierarchy System
 * Builds parent/subsidiary relationships from existing company intelligence data.
 * Rolls up signals from subsidiaries to parent company.
 */

import { db } from "../../db";
import { storage } from "../../storage";
import {
  companyHierarchyNodes,
  companyRelationships,
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const SAFE_MODE = process.env.SAFE_MODE === "true";

// Known Australian corporate group patterns (subsidiary indicators)
const SUBSIDIARY_PATTERNS = [
  { parent: "Deloitte", subsidiaries: ["Deloitte Australia", "Deloitte Digital", "Deloitte Access"] },
  { parent: "PwC", subsidiaries: ["PricewaterhouseCoopers", "PwC Australia", "Strategy&"] },
  { parent: "KPMG", subsidiaries: ["KPMG Australia", "KPMG Advisory"] },
  { parent: "EY", subsidiaries: ["Ernst & Young", "EY Australia", "Parthenon-EY"] },
  { parent: "Accenture", subsidiaries: ["Accenture Australia", "Accenture Interactive", "Avanade"] },
  { parent: "Woolworths", subsidiaries: ["Woolworths Group", "Big W", "BWS", "Dan Murphy's", "Countdown"] },
  { parent: "Wesfarmers", subsidiaries: ["Bunnings", "Kmart", "Target", "Officeworks", "Catch"] },
  { parent: "Commonwealth Bank", subsidiaries: ["CBA", "CommBank", "Bankwest", "Colonial First State"] },
  { parent: "ANZ", subsidiaries: ["ANZ Banking Group", "ANZ Bank"] },
  { parent: "NAB", subsidiaries: ["National Australia Bank", "MLC", "JB Were"] },
  { parent: "Westpac", subsidiaries: ["Westpac Banking", "St.George", "BankSA", "Bank of Melbourne"] },
  { parent: "Telstra", subsidiaries: ["Telstra Business", "Telstra Health", "Belong"] },
  { parent: "Optus", subsidiaries: ["Singtel Optus", "Optus Business", "Optus Home"] },
  { parent: "BHP", subsidiaries: ["BHP Group", "BHP Billiton", "BHP Minerals"] },
  { parent: "Rio Tinto", subsidiaries: ["Rio Tinto Australia", "Rio Tinto Minerals"] },
];

function normalizeCompanyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function findParentMatch(companyName: string): string | null {
  const normalized = normalizeCompanyName(companyName);
  for (const group of SUBSIDIARY_PATTERNS) {
    const parentNorm = normalizeCompanyName(group.parent);
    if (normalized === parentNorm) return null; // IS the parent
    for (const sub of group.subsidiaries) {
      if (normalized.includes(normalizeCompanyName(sub)) || normalizeCompanyName(sub).includes(normalized)) {
        return group.parent;
      }
    }
  }
  return null;
}

export async function buildHierarchyFromExistingData(): Promise<{ nodes: number; relationships: number }> {
  if (SAFE_MODE) {
    console.log("[CompanyHierarchy] SAFE_MODE — skipping hierarchy build");
    return { nodes: 0, relationships: 0 };
  }

  console.log("[CompanyHierarchy] Building hierarchy from existing company data...");

  const companies = await storage.getCompanyIntelligenceRecords({});
  let nodesCreated = 0;
  let relationshipsCreated = 0;

  // Step 1: Create hierarchy nodes for all companies
  for (const company of companies) {
    const normalizedName = normalizeCompanyName(company.companyName);

    // Check if node already exists
    const existing = await db
      .select()
      .from(companyHierarchyNodes)
      .where(eq(companyHierarchyNodes.normalizedName, normalizedName))
      .limit(1);

    if (existing.length > 0) {
      // Update aggregated stats
      await db
        .update(companyHierarchyNodes)
        .set({
          aggregatedSignalCount: company.radarSignalCount ?? 0,
          aggregatedConfidenceScore: company.confidenceScore ?? 0,
          updatedAt: new Date(),
        })
        .where(eq(companyHierarchyNodes.normalizedName, normalizedName));
    } else {
      const parentName = findParentMatch(company.companyName);
      await db.insert(companyHierarchyNodes).values({
        companyName: company.companyName,
        normalizedName,
        companyIntelligenceId: company.id,
        nodeType: parentName ? "subsidiary" : "standalone",
        industry: company.industry ?? null,
        city: company.city ?? null,
        state: company.state ?? null,
        country: company.country ?? "Australia",
        employeeEstimate: (company as any).employeeCount ? parseInt((company as any).employeeCount) : null,
        aggregatedSignalCount: company.radarSignalCount ?? 0,
        aggregatedConfidenceScore: company.confidenceScore ?? 0,
        dataSource: "company_intelligence",
      });
      nodesCreated++;
    }
  }

  // Step 2: Build parent→subsidiary relationships
  const allNodes = await db.select().from(companyHierarchyNodes).limit(500);
  const nodesByNorm = new Map(allNodes.map(n => [n.normalizedName, n]));

  for (const node of allNodes) {
    const parentName = findParentMatch(node.companyName);
    if (!parentName) continue;

    const parentNorm = normalizeCompanyName(parentName);
    const parentNode = nodesByNorm.get(parentNorm);

    // Check if relationship already exists
    const existingRel = await db
      .select()
      .from(companyRelationships)
      .where(and(
        eq(companyRelationships.fromEntityId, node.id),
        eq(companyRelationships.relationshipType, "subsidiary_of")
      ))
      .limit(1);

    if (existingRel.length === 0) {
      await db.insert(companyRelationships).values({
        fromEntityType: "company",
        fromEntityId: node.id,
        fromEntityName: node.companyName,
        toEntityType: "company",
        toEntityId: parentNode?.id ?? `parent:${parentName}`,
        toEntityName: parentName,
        relationshipType: "subsidiary_of",
        strength: 90,
        notes: `Pattern-matched subsidiary`,
      });
      relationshipsCreated++;

      // Update node type
      await db
        .update(companyHierarchyNodes)
        .set({ nodeType: "subsidiary", parentId: parentNode?.id ?? null })
        .where(eq(companyHierarchyNodes.id, node.id));
    }
  }

  console.log(`[CompanyHierarchy] Built: ${nodesCreated} nodes, ${relationshipsCreated} relationships`);
  return { nodes: nodesCreated, relationships: relationshipsCreated };
}

export async function rollUpSignals(): Promise<{ rolled: number }> {
  console.log("[CompanyHierarchy] Rolling up signals to parent companies...");

  // Get all subsidiary nodes with parent IDs
  const subsidiaries = await db
    .select()
    .from(companyHierarchyNodes)
    .where(eq(companyHierarchyNodes.nodeType, "subsidiary"))
    .limit(200);

  let rolled = 0;
  for (const sub of subsidiaries) {
    if (!sub.parentId) continue;

    // Aggregate to parent
    const parent = await db
      .select()
      .from(companyHierarchyNodes)
      .where(eq(companyHierarchyNodes.id, sub.parentId))
      .limit(1);

    if (parent.length === 0) continue;

    const p = parent[0];
    await db
      .update(companyHierarchyNodes)
      .set({
        aggregatedSignalCount: (p.aggregatedSignalCount ?? 0) + (sub.aggregatedSignalCount ?? 0),
        aggregatedConfidenceScore: Math.max(p.aggregatedConfidenceScore ?? 0, sub.aggregatedConfidenceScore ?? 0),
        aggregatedOpportunityValue: (p.aggregatedOpportunityValue ?? 0) + (sub.aggregatedOpportunityValue ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(companyHierarchyNodes.id, sub.parentId));

    rolled++;
  }

  console.log(`[CompanyHierarchy] Rolled up ${rolled} subsidiary signals`);
  return { rolled };
}

export async function getCompanyHierarchy(companyName: string): Promise<{
  node: typeof companyHierarchyNodes.$inferSelect | null;
  parent: typeof companyHierarchyNodes.$inferSelect | null;
  subsidiaries: typeof companyHierarchyNodes.$inferSelect[];
  relationships: typeof companyRelationships.$inferSelect[];
}> {
  const normalizedName = normalizeCompanyName(companyName);
  const nodes = await db
    .select()
    .from(companyHierarchyNodes)
    .where(eq(companyHierarchyNodes.normalizedName, normalizedName))
    .limit(1);

  if (nodes.length === 0) return { node: null, parent: null, subsidiaries: [], relationships: [] };

  const node = nodes[0];
  const [parentArr, subsidiaryArr, rels] = await Promise.all([
    node.parentId
      ? db.select().from(companyHierarchyNodes).where(eq(companyHierarchyNodes.id, node.parentId)).limit(1)
      : Promise.resolve([]),
    db.select().from(companyHierarchyNodes).where(eq(companyHierarchyNodes.parentId, node.id)).limit(20),
    db.select().from(companyRelationships).where(eq(companyRelationships.fromEntityId, node.id)).limit(20),
  ]);

  return {
    node,
    parent: parentArr[0] ?? null,
    subsidiaries: subsidiaryArr,
    relationships: rels,
  };
}

export async function getTopHierarchyClusters(limit = 10): Promise<typeof companyHierarchyNodes.$inferSelect[]> {
  return db
    .select()
    .from(companyHierarchyNodes)
    .orderBy(desc(companyHierarchyNodes.aggregatedSignalCount))
    .limit(limit);
}

export async function getSubsidiaryMap(): Promise<{
  parentName: string;
  nodeType: string;
  city: string | null;
  aggregatedSignalCount: number;
  subsidiaryCount: number;
}[]> {
  const parents = await db
    .select()
    .from(companyHierarchyNodes)
    .where(eq(companyHierarchyNodes.nodeType, "parent"))
    .orderBy(desc(companyHierarchyNodes.aggregatedSignalCount))
    .limit(50);

  const results = await Promise.all(
    parents.map(async (p) => {
      const subs = await db
        .select()
        .from(companyHierarchyNodes)
        .where(eq(companyHierarchyNodes.parentId, p.id));
      return {
        parentName: p.companyName,
        nodeType: p.nodeType,
        city: p.city,
        aggregatedSignalCount: p.aggregatedSignalCount ?? 0,
        subsidiaryCount: subs.length,
      };
    })
  );

  return results;
}
