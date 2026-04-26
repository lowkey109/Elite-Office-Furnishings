/**
 * Partner Scoring + Tier Assignment Service
 * Calculates partner_score, assigns tiers, and detects inactive partners.
 */

import { db } from "../db";
import { partners, partnerReferrals, partnerCommissions } from "@shared/schema";
import { eq, desc, count, sum, and, gte, lte, isNotNull, sql } from "drizzle-orm";

// ─── Tier Thresholds ──────────────────────────────────────────────────────────
const TIER_THRESHOLDS = {
  tier3: { minScore: 75, minReferrals: 10, minRevenue: 100000 }, // Strategic
  tier2: { minScore: 40, minReferrals: 3,  minRevenue: 25000  }, // Preferred
  tier1: { minScore: 0,  minReferrals: 0,  minRevenue: 0      }, // Default
};

// ─── Score Calculation ─────────────────────────────────────────────────────────
export interface PartnerScoreBreakdown {
  partnerId: string;
  referralCount: number;
  wonCount: number;
  conversionRate: number;
  totalRevenue: number;
  avgDealValue: number;
  recencyDays: number;
  consistencyBonus: number;
  rawScore: number;
  tier: "tier1" | "tier2" | "tier3";
}

export async function calculatePartnerScore(partnerId: string): Promise<PartnerScoreBreakdown> {
  const [referralRows, commissionRows] = await Promise.all([
    db.select().from(partnerReferrals).where(eq(partnerReferrals.partnerId, partnerId)),
    db.select().from(partnerCommissions).where(eq(partnerCommissions.partnerId, partnerId)),
  ]);

  const referralCount = referralRows.length;
  const wonCount = commissionRows.length;
  const conversionRate = referralCount > 0 ? wonCount / referralCount : 0;
  const totalRevenue = commissionRows.reduce((s, c) => s + (c.dealValue || 0), 0);
  const avgDealValue = wonCount > 0 ? totalRevenue / wonCount : 0;

  // Recency — days since last referral
  const lastReferral = referralRows.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
  const recencyDays = lastReferral
    ? Math.floor((Date.now() - new Date(lastReferral.createdAt ?? 0).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Consistency bonus — referrals spread over multiple months
  const months = new Set(referralRows.map(r => new Date(r.createdAt ?? 0).toISOString().slice(0, 7)));
  const consistencyBonus = Math.min(months.size * 5, 25);

  // Score formula (0-100)
  let score = 0;
  score += Math.min(referralCount * 3, 30);       // Volume: up to 30 pts
  score += Math.min(conversionRate * 100 * 0.3, 30); // Conversion: up to 30 pts
  score += Math.min(totalRevenue / 10000, 15);      // Revenue: up to 15 pts
  score += consistencyBonus;                        // Consistency: up to 25 pts

  // Recency decay
  if (recencyDays > 90) score = Math.max(score - 20, 0);
  else if (recencyDays > 30) score = Math.max(score - 10, 0);

  const rawScore = Math.round(score);

  // Assign tier
  let tier: "tier1" | "tier2" | "tier3" = "tier1";
  if (rawScore >= TIER_THRESHOLDS.tier3.minScore && referralCount >= TIER_THRESHOLDS.tier3.minReferrals && totalRevenue >= TIER_THRESHOLDS.tier3.minRevenue) {
    tier = "tier3";
  } else if (rawScore >= TIER_THRESHOLDS.tier2.minScore && referralCount >= TIER_THRESHOLDS.tier2.minReferrals && totalRevenue >= TIER_THRESHOLDS.tier2.minRevenue) {
    tier = "tier2";
  }

  return { partnerId, referralCount, wonCount, conversionRate, totalRevenue, avgDealValue, recencyDays, consistencyBonus, rawScore, tier };
}

// ─── Update Partner Score in DB ───────────────────────────────────────────────
export async function syncPartnerScore(partnerId: string): Promise<PartnerScoreBreakdown> {
  const breakdown = await calculatePartnerScore(partnerId);

  // Find last referral date
  const [lastRef] = await db.select({ createdAt: partnerReferrals.createdAt })
    .from(partnerReferrals)
    .where(eq(partnerReferrals.partnerId, partnerId))
    .orderBy(desc(partnerReferrals.createdAt))
    .limit(1);

  await db.update(partners).set({
    partnerScore: breakdown.rawScore,
    partnerTier: breakdown.tier,
    referralCount: breakdown.referralCount,
    conversionRate: breakdown.conversionRate,
    lastReferralAt: lastRef?.createdAt || null,
    lastActivityAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(partners.id, partnerId));

  return breakdown;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
export async function getPartnerLeaderboard(filters?: {
  city?: string;
  tier?: string;
  minScore?: number;
}): Promise<Array<{ partner: any; score: PartnerScoreBreakdown }>> {
  const allPartners = await db.select().from(partners).where(eq(partners.agreementStatus, "signed"));

  let results: Array<{ partner: any; score: PartnerScoreBreakdown }> = [];

  for (const p of allPartners) {
    const score = await calculatePartnerScore(p.id);
    if (filters?.city && p.city && !p.city.toLowerCase().includes(filters.city.toLowerCase())) continue;
    if (filters?.tier && score.tier !== filters.tier) continue;
    if (filters?.minScore && score.rawScore < filters.minScore) continue;
    results.push({ partner: p, score });
  }

  return results.sort((a, b) => b.score.rawScore - a.score.rawScore);
}

// ─── Inactive Partner Detection ───────────────────────────────────────────────
const MS_48H  = 48  * 60 * 60 * 1000;
const MS_14D  = 14  * 24 * 60 * 60 * 1000;

export async function detectNudgeTargets(): Promise<{ nudge48h: any[]; reengagement14d: any[] }> {
  const now = Date.now();

  const activePartners = await db.select().from(partners).where(
    and(eq(partners.agreementStatus, "signed"), eq(partners.activeStatus, "active"))
  );

  const allReferrals = await db.select({
    partnerId: partnerReferrals.partnerId,
    createdAt: partnerReferrals.createdAt,
  }).from(partnerReferrals);

  const referralsByPartner = new Map<string, Date>();
  for (const r of allReferrals) {
    const existing = referralsByPartner.get(r.partnerId!);
    if (!existing || new Date(r.createdAt ?? 0) > existing) {
      referralsByPartner.set(r.partnerId!, new Date(r.createdAt ?? 0));
    }
  }

  const nudge48h: any[] = [];
  const reengagement14d: any[] = [];

  for (const p of activePartners) {
    const signedAt = p.agreementSignedAt ? new Date(p.agreementSignedAt).getTime() : null;
    const lastRef = referralsByPartner.get(p.id);

    if (!lastRef && signedAt) {
      const hoursSinceSigned = (now - signedAt) / (1000 * 60 * 60);
      if (hoursSinceSigned >= 48 && hoursSinceSigned < 72) {
        nudge48h.push(p);
      }
    }

    const lastActivity = lastRef || (p.agreementSignedAt ? new Date(p.agreementSignedAt) : null);
    if (lastActivity && (now - lastActivity.getTime()) >= MS_14D) {
      reengagement14d.push(p);
    }
  }

  return { nudge48h, reengagement14d };
}

export const TIER_LABELS: Record<string, { label: string; color: string; commission: string }> = {
  tier1: { label: "Tier 1",    color: "text-white/50",                    commission: "7.5%" },
  tier2: { label: "Tier 2 — Preferred",  color: "text-[hsl(43,78%,52%)]", commission: "7.5% + priority routing" },
  tier3: { label: "Tier 3 — Strategic",  color: "text-emerald-400",        commission: "7.5% + strategic access" },
};
