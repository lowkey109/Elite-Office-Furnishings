// server/services/intelligence/partnerNetwork.ts
// Partner Network — Opportunity Routing Engine
// Routes relocation/workspace opportunities to appropriate partners based on
// location, project type, partner type, capability, and performance.
//
// Nexora integration:
// - runNexoraPartnerRoutingStep(): one function you can call inside your Nexora cycle
// - idempotency guard: avoids re-routing the same sourceId/sourceType repeatedly

import { storage } from "../../storage";
import { db } from "../../db";
import { and, eq, sql as drizzleSql } from "drizzle-orm";

import type {
  Partner,
  PartnerOpportunity,
  InsertPartnerOpportunity,
  InsertPartnerReferral,
  InsertRevenueShare,
} from "@shared/schema";

// ✅ Update these imports to match your actual schema export names
import {
  partnerOpportunities,
  intelligenceSignals,
  officeMovRadar,
  // relocationSignals, // if you have this table, uncomment and use below
} from "../../../shared/schema";

// ─── Partner Type → Project Type Mapping ──────────────────────────────────────
const PARTNER_TYPE_AFFINITY: Record<string, string[]> = {
  broker: ["relocation", "expansion", "new_office"],
  tenant_rep: ["relocation", "expansion", "new_office"],
  architect: ["refit", "expansion", "new_office"],
  designer: ["refit", "expansion", "new_office", "relocation"],
  builder: ["refit", "expansion", "relocation"],
  furniture_supplier: ["refit", "expansion", "relocation", "new_office"],
  mover: ["relocation"],
  finance_partner: ["relocation", "expansion", "refit", "new_office"],
  technology_partner: ["refit", "expansion", "new_office"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function inferProjectType(signalType: string): "relocation" | "expansion" | "refit" | "new_office" {
  const s = (signalType || "").toLowerCase();
  if (s.includes("new_office") || s.includes("new office")) return "new_office";
  if (s.includes("expand") || s.includes("expan")) return "expansion";
  if (s.includes("refit") || s.includes("refurb") || s.includes("fitout") || s.includes("fit-out")) return "refit";
  if (s.includes("move") || s.includes("reloc")) return "relocation";
  return "relocation";
}

function parseProjectValueLabel(label?: string | null, fallback = 80000): number {
  if (!label) return fallback;
  const nums = label.replace(/,/g, "").match(/\d+/g);
  if (!nums?.length) return fallback;
  const n = parseInt(nums[0], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Idempotency check: if *any* partnerOpportunity exists for (sourceType, sourceId),
 * then this source has already been routed.
 */
async function isAlreadyRouted(sourceType: string, sourceId?: string | null): Promise<boolean> {
  if (!sourceId) return false;

  const [existing] = await db
    .select()
    .from(partnerOpportunities)
    .where(and(eq(partnerOpportunities.sourceType as any, sourceType as any), eq(partnerOpportunities.sourceId, sourceId)))
    .limit(1);

  return !!existing;
}

// ─── Score Partner Fit for an Opportunity ─────────────────────────────────────
export function scorePartnerFit(
  partner: Partner,
  opportunity: {
    city?: string | null;
    projectType?: string | null;
    industry?: string | null;
    estimatedProjectValue?: number | null;
  }
): number {
  let score = 0;

  // Location match (40 pts)
  if (partner.serviceRegions && opportunity.city) {
    const city = opportunity.city.toLowerCase();
    const regionMatch = partner.serviceRegions.some((r) => {
      const rr = (r || "").toLowerCase();
      return rr.includes(city) || city.includes(rr);
    });
    if (regionMatch) score += 40;
    else score += 10; // fallback
  } else {
    score += 20; // broadly eligible
  }

  // Project type affinity (30 pts)
  if (opportunity.projectType && partner.partnerType) {
    const affinityTypes = PARTNER_TYPE_AFFINITY[partner.partnerType] ?? [];
    if (affinityTypes.includes(opportunity.projectType)) score += 30;
  }

  // Industry specialty match (15 pts)
  if (partner.industrySpecialties && opportunity.industry) {
    const ind = opportunity.industry.toLowerCase();
    const match = partner.industrySpecialties.some((s) => {
      const ss = (s || "").toLowerCase();
      return ss.includes(ind) || ind.includes(ss);
    });
    if (match) score += 15;
  }

  // Partner performance bonus (15 pts max)
  const winRate =
    (partner.totalOpportunitiesReceived ?? 0) > 0
      ? (partner.totalProjectsWon ?? 0) / (partner.totalOpportunitiesReceived ?? 1)
      : 0.5;

  score += Math.round(winRate * 15);

  return Math.min(score, 100);
}

// ─── Route Opportunity to Matching Partners ───────────────────────────────────
export async function routeOpportunityToPartners(
  opportunityData: {
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
  },
  partnerTypeFilter?: string[]
): Promise<{ routed: number; opportunities: PartnerOpportunity[] }> {
  const allPartners = await storage.getPartners();
  const activePartners = allPartners.filter((p) => p.activeStatus === "active");

  const eligible = activePartners.filter((p) => {
    if (partnerTypeFilter?.length) return partnerTypeFilter.includes(p.partnerType);
    return true;
  });

  const scored = eligible
    .map((p) => ({ partner: p, score: scorePartnerFit(p, opportunityData) }))
    .filter((x) => x.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const created: PartnerOpportunity[] = [];

  for (const { partner, score } of scored) {
    const record: InsertPartnerOpportunity = {
      partnerId: partner.id,
      opportunityTitle: opportunityData.opportunityTitle,
      companyName: opportunityData.companyName ?? null,
      city: opportunityData.city ?? null,
      industry: opportunityData.industry ?? null,
      projectType: opportunityData.projectType ?? null,
      officeSizeSqm: opportunityData.officeSizeSqm ? Number(String(opportunityData.officeSizeSqm).replace(/[^0-9.-]/g, "")) || null : null,
      staffCount: opportunityData.staffCount ? Number(String(opportunityData.staffCount).replace(/[^0-9.-]/g, "")) || null : null,
      estimatedProjectValue: opportunityData.estimatedProjectValue ?? null,
      relocationScore: opportunityData.relocationScore ?? score,
      sourceType: opportunityData.sourceType ?? "manual",
      sourceId: opportunityData.sourceId ?? null,
      routingReason:
        opportunityData.routingReason ??
        `Fit score ${score}/100 — ${partner.partnerType} in ${partner.city ?? "AU"}`,
      status: "invited",
      role: "referral",
      commissionRate: 5.0,
      notes: null,
    };

    const saved = await storage.createPartnerOpportunity(record);
    created.push(saved);

    // Update partner stats
    await storage.incrementPartnerStats(partner.id, "totalOpportunitiesReceived");

    // Create graph edges for partner relationship (non-critical)
    try {
      const { onPartnerLinked } = await import("./intelligenceGraphService");
      await onPartnerLinked({
        companyId: opportunityData.sourceId ?? `company:${opportunityData.companyName ?? "unknown"}`,
        companyName: opportunityData.companyName ?? "Unknown Company",
        partnerId: partner.id,
        partnerName: partner.companyName,
        partnerType: partner.partnerType,
        opportunityId: saved.id,
        opportunityTitle: opportunityData.opportunityTitle,
      });
    } catch {
      // ignore graph failures
    }
  }

  return { routed: created.length, opportunities: created };
}

// ─── Auto-Route from High-Score Intelligence Signals ─────────────────────────
export async function autoRouteHighScoreSignals(): Promise<{ routed: number }> {
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
    .limit(25);

  let totalRouted = 0;

  for (const s of signals) {
    // idempotency by sourceId
    const already = await isAlreadyRouted("intelligence_signal", s.id);
    if (already) continue;

    try {
      const result = await routeOpportunityToPartners({
        opportunityTitle: `${s.companyName} — Intelligence Signal (${s.signalType})`,
        companyName: s.companyName,
        city: s.city ?? undefined,
        industry: s.industry ?? undefined,
        projectType: inferProjectType(s.signalType),
        estimatedProjectValue: 80000,
        relocationScore: s.relocationProbability ?? 60,
        sourceType: "intelligence_signal",
        sourceId: s.id,
        routingReason: `Auto-routed from intelligence signal — confidence ${s.confidenceScore}%`,
      });

      totalRouted += result.routed;
    } catch {
      // continue
    }
  }

  return { routed: totalRouted };
}

// ─── Auto-Route from Radar Signal ─────────────────────────────────────────────
export async function autoRouteRadarSignals(): Promise<{ routed: number }> {
  // If your radar table/columns differ, adjust below
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const radars = await db
    .select()
    .from(officeMovRadar)
    .where(drizzleSql`${officeMovRadar.createdAt} > ${dayAgo}`)
    .limit(25);

  let totalRouted = 0;

  for (const r of radars) {
    const already = await isAlreadyRouted("radar", r.id);
    if (already) continue;

    try {
      const projectValue = parseProjectValueLabel(r.estimatedProjectValue, 80000);
      const projectType = inferProjectType(r.signalType);

      const result = await routeOpportunityToPartners({
        opportunityTitle: `${r.companyName} — ${
          projectType === "relocation"
            ? "Office Relocation"
            : projectType === "expansion"
              ? "Office Expansion"
              : projectType === "refit"
                ? "Office Refit"
                : "New Office Setup"
        }`,
        companyName: r.companyName,
        city: r.city,
        industry: r.industry ?? undefined,
        projectType,
        officeSizeSqm: r.estimatedOfficeSizeSqm != null ? String(r.estimatedOfficeSizeSqm) : undefined,
        staffCount: r.estimatedHeadcount != null ? String(r.estimatedHeadcount) : undefined,
        estimatedProjectValue: projectValue,
        relocationScore: r.radarScore ?? 60,
        sourceType: "radar",
        sourceId: r.id,
        routingReason: `Office Move Radar signal — score ${r.radarScore}/100`,
      });

      totalRouted += result.routed;
    } catch {
      // continue
    }
  }

  return { routed: totalRouted };
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
  const fee = data.projectValue ? Math.round((data.projectValue * pct) / 100) : undefined;

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

  const active = partners.filter((p) => p.activeStatus === "active");
  const pending = partners.filter((p) => p.activeStatus === "pending");
  const totalRouted = opportunities.length;
  const totalWon = partners.reduce((s, p) => s + (p.totalProjectsWon ?? 0), 0);
  const totalRevenue = partners.reduce((s, p) => s + (p.totalRevenueGenerated ?? 0), 0);
  const conversionRate = totalRouted > 0 ? Math.round((totalWon / totalRouted) * 100) : 0;

  const breakdown: Record<string, number> = {};
  for (const p of partners) breakdown[p.partnerType] = (breakdown[p.partnerType] ?? 0) + 1;

  const topPerformers = [...partners]
    .sort((a, b) => (b.totalProjectsWon ?? 0) - (a.totalProjectsWon ?? 0))
    .slice(0, 5)
    .map((p) => ({
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

// ─────────────────────────────────────────────────────────────────────────────
// Nexora hook: call this from your Nexora orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export async function runNexoraPartnerRoutingStep(): Promise<{
  ok: boolean;
  routedSignals: number;
  routedRadar: number;
}> {
  // You can gate this behind env flags if you want:
  // if (process.env.NEXORA_PARTNER_ROUTING !== "true") return { ok: true, routedSignals: 0, routedRadar: 0 };

  const [sig, radar] = await Promise.all([
    autoRouteHighScoreSignals(),
    autoRouteRadarSignals(),
  ]);

  return {
    ok: true,
    routedSignals: sig.routed,
    routedRadar: radar.routed,
  };
}