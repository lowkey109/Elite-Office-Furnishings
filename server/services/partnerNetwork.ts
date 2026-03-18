// Partner Network — Opportunity Routing Engine
// Routes relocation/workspace opportunities to appropriate partners based on
// location, project type, partner type, capability, and performance.

import { storage } from "../storage";
import type { Partner, PartnerOpportunity, InsertPartnerOpportunity, InsertPartnerReferral, InsertRevenueShare } from "@shared/schema";

// ─── Partner Type → Project Type Mapping ──────────────────────────────────────
const PARTNER_TYPE_AFFINITY: Record<string, string[]> = {
  broker:             ["relocation", "expansion", "new_office"],
  tenant_rep:         ["relocation", "expansion", "new_office"],
  architect:          ["refit", "expansion", "new_office"],
  designer:           ["refit", "expansion", "new_office", "relocation"],
  builder:            ["refit", "expansion", "relocation"],
  furniture_supplier: ["refit", "expansion", "relocation", "new_office"],
  mover:              ["relocation"],
  finance_partner:    ["relocation", "expansion", "refit", "new_office"],
  technology_partner: ["refit", "expansion", "new_office"],
};

// ─── Score Partner Fit for an Opportunity ─────────────────────────────────────
export function scorePartnerFit(partner: Partner, opportunity: {
  city?: string | null;
  projectType?: string | null;
  industry?: string | null;
  estimatedProjectValue?: number | null;
}): number {
  let score = 0;

  // Location match (40 pts)
  if (partner.serviceRegions && opportunity.city) {
    const city = opportunity.city.toLowerCase();
    const regionMatch = partner.serviceRegions.some(r => r.toLowerCase().includes(city) || city.includes(r.toLowerCase()));
    if (regionMatch) score += 40;
    else {
      // State-level fallback — all major cities are somewhat viable
      score += 10;
    }
  } else {
    score += 20; // no region specified = broadly eligible
  }

  // Project type affinity (30 pts)
  if (opportunity.projectType && partner.partnerType) {
    const affinityTypes = PARTNER_TYPE_AFFINITY[partner.partnerType] ?? [];
    if (affinityTypes.includes(opportunity.projectType)) score += 30;
  }

  // Industry specialty match (15 pts)
  if (partner.industrySpecialties && opportunity.industry) {
    const ind = opportunity.industry.toLowerCase();
    const match = partner.industrySpecialties.some(s => s.toLowerCase().includes(ind) || ind.includes(s.toLowerCase()));
    if (match) score += 15;
  }

  // Partner performance bonus (15 pts max)
  const winRate = (partner.totalOpportunitiesReceived ?? 0) > 0
    ? ((partner.totalProjectsWon ?? 0) / (partner.totalOpportunitiesReceived ?? 1))
    : 0.5;
  score += Math.round(winRate * 15);

  return Math.min(score, 100);
}

// ─── Route Opportunity to Matching Partners ───────────────────────────────────
export async function routeOpportunityToPartners(opportunityData: {
  opportunityTitle: string;
  companyName?: string;
  city?: string;
  industry?: string;
  projectType?: string;
  officeSizeSqm?: string;
  staffCount?: string;
  estimatedProjectValue?: number;
  relocationScore?: number;
  sourceType?: string;
  sourceId?: string;
  routingReason?: string;
}, partnerTypeFilter?: string[]): Promise<{ routed: number; opportunities: PartnerOpportunity[] }> {
  const allPartners = await storage.getPartners();
  const activePartners = allPartners.filter(p => p.activeStatus === "active");

  const eligible = activePartners.filter(p => {
    if (partnerTypeFilter && partnerTypeFilter.length > 0) {
      return partnerTypeFilter.includes(p.partnerType);
    }
    return true;
  });

  const scored = eligible
    .map(p => ({ partner: p, score: scorePartnerFit(p, opportunityData) }))
    .filter(x => x.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // max 5 partners per opportunity

  const created: PartnerOpportunity[] = [];
  for (const { partner, score } of scored) {
    const record: InsertPartnerOpportunity = {
      partnerId: partner.id,
      opportunityTitle: opportunityData.opportunityTitle,
      companyName: opportunityData.companyName ?? null,
      city: opportunityData.city ?? null,
      industry: opportunityData.industry ?? null,
      projectType: opportunityData.projectType ?? null,
      officeSizeSqm: opportunityData.officeSizeSqm ?? null,
      staffCount: opportunityData.staffCount ?? null,
      estimatedProjectValue: opportunityData.estimatedProjectValue ?? null,
      relocationScore: opportunityData.relocationScore ?? score,
      sourceType: opportunityData.sourceType ?? "manual",
      sourceId: opportunityData.sourceId ?? null,
      routingReason: opportunityData.routingReason ?? `Fit score ${score}/100 — ${partner.partnerType} in ${partner.city ?? "AU"}`,
      status: "invited",
      role: "referral",
      commissionRate: 5.0,
      notes: null,
    };
    const saved = await storage.createPartnerOpportunity(record);
    created.push(saved);

    // Update partner stats
    await storage.incrementPartnerStats(partner.id, "totalOpportunitiesReceived");

    // Create graph edges for partner relationship
    try {
      const { onPartnerLinked } = await import("./intelligence/intelligenceGraphService");
      await onPartnerLinked({
        companyId: opportunityData.sourceId ?? `company:${opportunityData.companyName ?? "unknown"}`,
        companyName: opportunityData.companyName ?? "Unknown Company",
        partnerId: partner.id,
        partnerName: partner.companyName,
        partnerType: partner.partnerType,
        opportunityId: saved.id,
        opportunityTitle: opportunityData.opportunityTitle,
      });
    } catch (e) {
      // Graph edges are non-critical — don't fail the routing if graph fails
    }
  }

  return { routed: created.length, opportunities: created };
}

// ─── Auto-Route from High-Score Intelligence Signals ─────────────────────────
export async function autoRouteHighScoreSignals(): Promise<{ routed: number }> {
  const { db } = await import("../db");
  const { intelligenceSignals } = await import("../../shared/schema");
  const { and, eq, sql: drizzleSql } = await import("drizzle-orm");

  // Find high-confidence signals from the last 24 hours that haven't been routed
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const signals = await db
    .select()
    .from(intelligenceSignals)
    .where(
      and(
        drizzleSql`${intelligenceSignals.createdAt} > ${dayAgo}`,
        drizzleSql`${intelligenceSignals.confidenceScore} >= 70`,
        drizzleSql`${intelligenceSignals.relocationProbability} >= 60`
      )
    )
    .limit(10);

  let totalRouted = 0;
  for (const signal of signals) {
    try {
      const result = await routeOpportunityToPartners({
        opportunityTitle: `${signal.companyName} — Intelligence Signal (${signal.signalType})`,
        companyName: signal.companyName,
        city: signal.city ?? undefined,
        industry: signal.industry ?? undefined,
        projectType: "relocation",
        estimatedProjectValue: 80000,
        relocationScore: signal.relocationProbability ?? 60,
        sourceType: "intelligence_signal",
        sourceId: signal.id,
        routingReason: `Auto-routed from intelligence signal — confidence ${signal.confidenceScore}%`,
      });
      totalRouted += result.routed;
    } catch (e) {
      // Non-critical — continue with next signal
    }
  }

  return { routed: totalRouted };
}

// ─── Auto-Route from Radar Signal ─────────────────────────────────────────────
export async function routeRadarToPartners(radar: {
  id: string;
  companyName: string;
  city: string;
  industry?: string | null;
  estimatedHeadcount?: string | null;
  estimatedOfficeSizeSqm?: string | null;
  estimatedProjectValue?: string | null;
  radarScore: number;
  signalType: string;
}): Promise<{ routed: number }> {
  const projectValue = radar.estimatedProjectValue
    ? parseInt(radar.estimatedProjectValue.replace(/[^0-9]/g, "")) || 80000
    : 80000;

  const projectType = radar.signalType.includes("move") || radar.signalType.includes("reloc") ? "relocation"
    : radar.signalType.includes("expand") ? "expansion"
    : radar.signalType.includes("refit") || radar.signalType.includes("refurb") ? "refit"
    : "relocation";

  const result = await routeOpportunityToPartners({
    opportunityTitle: `${radar.companyName} — ${projectType === "relocation" ? "Office Relocation" : projectType === "expansion" ? "Office Expansion" : "Office Refit"}`,
    companyName: radar.companyName,
    city: radar.city,
    industry: radar.industry ?? undefined,
    projectType,
    officeSizeSqm: radar.estimatedOfficeSizeSqm ?? undefined,
    staffCount: radar.estimatedHeadcount ?? undefined,
    estimatedProjectValue: projectValue,
    relocationScore: radar.radarScore,
    sourceType: "radar",
    sourceId: radar.id,
    routingReason: `Office Move Radar signal — score ${radar.radarScore}/100`,
  });

  return { routed: result.routed };
}

// ─── Auto-Route from Relocation Signal ────────────────────────────────────────
export async function routeRelocationSignalToPartners(signal: {
  id: string;
  companyName: string;
  city: string;
  industry?: string | null;
  officeSizeSqm?: number | null;
  estimatedHeadcount?: number | null;
  estimatedProjectValue?: number | null;
  relocationProbability: number;
  signalType: string;
}): Promise<{ routed: number }> {
  const projectType = signal.signalType.includes("expan") ? "expansion"
    : signal.signalType.includes("permit") || signal.signalType.includes("refit") ? "refit"
    : signal.signalType.includes("new_office") ? "new_office"
    : "relocation";

  const result = await routeOpportunityToPartners({
    opportunityTitle: `${signal.companyName} — Relocation Intelligence Alert`,
    companyName: signal.companyName,
    city: signal.city,
    industry: signal.industry ?? undefined,
    projectType,
    officeSizeSqm: signal.officeSizeSqm ? String(signal.officeSizeSqm) : undefined,
    staffCount: signal.estimatedHeadcount ? String(signal.estimatedHeadcount) : undefined,
    estimatedProjectValue: signal.estimatedProjectValue ?? undefined,
    relocationScore: signal.relocationProbability,
    sourceType: "relocation_signal",
    sourceId: signal.id,
    routingReason: `Relocation probability ${signal.relocationProbability}% — ${signal.signalType}`,
  });

  return { routed: result.routed };
}

// ─── Create Referral Record ────────────────────────────────────────────────────
export async function createReferralRecord(data: {
  partnerId: string;
  opportunityId?: string;
  clientName?: string;
  clientCompany?: string;
  projectValue?: number;
  commissionPercent?: number;
}): Promise<void> {
  const pct = data.commissionPercent ?? 5;
  const fee = data.projectValue ? Math.round(data.projectValue * pct / 100) : undefined;

  const record: InsertPartnerReferral = {
    partnerId: data.partnerId,
    opportunityId: data.opportunityId ?? null,
    clientName: data.clientName ?? null,
    clientCompany: data.clientCompany ?? null,
    projectValue: data.projectValue ?? null,
    referralFee: fee ?? null,
    commissionPercent: pct,
    status: "invited",
    conversionResult: "pending",
    notes: null,
  };
  await storage.createPartnerReferral(record);
}

// ─── Network Summary ───────────────────────────────────────────────────────────
export async function getNetworkSummary(): Promise<{
  totalPartners: number;
  activePartners: number;
  pendingPartners: number;
  totalOpportunitiesRouted: number;
  totalProjectsWon: number;
  totalNetworkRevenue: number;
  conversionRate: number;
  partnerTypeBreakdown: Record<string, number>;
  topPerformers: Array<{ id: string; companyName: string; type: string; won: number; revenue: number }>;
}> {
  const [partners, opportunities] = await Promise.all([
    storage.getPartners(),
    storage.getPartnerOpportunities(),
  ]);

  const active = partners.filter(p => p.activeStatus === "active");
  const pending = partners.filter(p => p.activeStatus === "pending");
  const totalRouted = opportunities.length;
  const totalWon = partners.reduce((s, p) => s + (p.totalProjectsWon ?? 0), 0);
  const totalRevenue = partners.reduce((s, p) => s + (p.totalRevenueGenerated ?? 0), 0);
  const conversionRate = totalRouted > 0 ? Math.round((totalWon / totalRouted) * 100) : 0;

  const breakdown: Record<string, number> = {};
  for (const p of partners) {
    breakdown[p.partnerType] = (breakdown[p.partnerType] ?? 0) + 1;
  }

  const topPerformers = [...partners]
    .sort((a, b) => (b.totalProjectsWon ?? 0) - (a.totalProjectsWon ?? 0))
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      companyName: p.companyName,
      type: p.partnerType,
      won: p.totalProjectsWon ?? 0,
      revenue: p.totalRevenueGenerated ?? 0,
    }));

  return {
    totalPartners: partners.length,
    activePartners: active.length,
    pendingPartners: pending.length,
    totalOpportunitiesRouted: totalRouted,
    totalProjectsWon: totalWon,
    totalNetworkRevenue: totalRevenue,
    conversionRate,
    partnerTypeBreakdown: breakdown,
    topPerformers,
  };
}
