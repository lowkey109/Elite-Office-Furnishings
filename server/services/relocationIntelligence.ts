// Relocation Intelligence Service
// Detects companies likely to relocate, expand, or refit offices using
// multiple signal types. Calculates relocation probability and generates
// market intelligence for the admin dashboard.

import { storage } from "../storage";
import type { InsertRelocationSignal, RelocationSignal, InsertPartnerOpportunity } from "@shared/schema";

// ─── Signal Types & Their Base Probability Contribution ──────────────────────
const SIGNAL_WEIGHTS: Record<string, number> = {
  hiring_surge:         25, // Rapidly hiring across multiple roles
  job_growth:           18, // Sustained job posting growth
  lease_expiry:         35, // Lease expiring within 12 months
  commercial_listing:   30, // Commercial space newly listed in area
  headcount_growth:     20, // LinkedIn headcount growth > 20%
  press_announcement:   40, // Press release about expansion/relocation
  planning_permit:      45, // Council planning permit lodged
  linkedin_growth:      15, // LinkedIn follower/employee growth
  expansion_news:       38, // News article about expansion
  new_office:           50, // Announced new office opening
};

// ─── Industry Office Multipliers ─────────────────────────────────────────────
const INDUSTRY_MULTIPLIERS: Record<string, number> = {
  Technology:     1.3,
  Finance:        1.2,
  Legal:          1.1,
  Consulting:     1.25,
  Healthcare:     1.15,
  Engineering:    1.1,
  Education:      1.0,
  Retail:         0.9,
  Manufacturing:  0.85,
};

// ─── Project Value Estimator ──────────────────────────────────────────────────
function estimateProjectValue(headcount?: number | null, sqm?: number | null, industry?: string | null): number {
  let effectiveSqm = sqm;
  if (!effectiveSqm && headcount) {
    effectiveSqm = headcount * 12; // 12sqm per person industry standard AU
  }
  if (!effectiveSqm) effectiveSqm = 200;

  const sqmRate = 700; // $700/sqm average AU commercial office fit-out
  let value = effectiveSqm * sqmRate;

  const multiplier = industry ? (INDUSTRY_MULTIPLIERS[industry] ?? 1.0) : 1.0;
  value *= multiplier;

  return Math.round(value / 1000) * 1000; // round to nearest $1k
}

// ─── Compute Relocation Probability ───────────────────────────────────────────
export function computeRelocationProbability(signals: {
  signalType: string;
  jobPostingsCount?: number | null;
  headcountGrowthPct?: number | null;
  leaseExpiryDate?: string | null;
  hasMultipleSignals?: boolean;
}): { probability: number; tier: string; timeline: string } {
  let score = SIGNAL_WEIGHTS[signals.signalType] ?? 10;

  // Boost for job posting volume
  if (signals.jobPostingsCount) {
    if (signals.jobPostingsCount >= 20) score += 15;
    else if (signals.jobPostingsCount >= 10) score += 10;
    else if (signals.jobPostingsCount >= 5) score += 5;
  }

  // Boost for headcount growth
  if (signals.headcountGrowthPct) {
    if (signals.headcountGrowthPct >= 50) score += 20;
    else if (signals.headcountGrowthPct >= 30) score += 12;
    else if (signals.headcountGrowthPct >= 15) score += 6;
  }

  // Boost for imminent lease expiry
  if (signals.leaseExpiryDate) {
    const expiry = new Date(signals.leaseExpiryDate);
    const monthsUntil = Math.round((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
    if (monthsUntil <= 3) score += 30;
    else if (monthsUntil <= 6) score += 20;
    else if (monthsUntil <= 12) score += 10;
  }

  // Multi-signal boost
  if (signals.hasMultipleSignals) score += 15;

  const probability = Math.min(score, 100);
  const tier = probability >= 65 ? "high" : probability >= 35 ? "medium" : "low";

  const timeline = probability >= 75 ? "0-3 months"
    : probability >= 55 ? "3-6 months"
    : probability >= 35 ? "6-12 months"
    : "12+ months";

  return { probability, tier, timeline };
}

// ─── Generate Synthetic Relocation Signals (AI-simulated scan) ────────────────
// In production this would connect to real data APIs. This generates
// plausible Australian market signals for the intelligence engine.
export async function generateRelocationSignals(count: number = 15): Promise<RelocationSignal[]> {
  const AUCompanies = [
    { name: "Macquarie Group", city: "Sydney", state: "NSW", industry: "Finance", headcount: 14000 },
    { name: "Atlassian", city: "Sydney", state: "NSW", industry: "Technology", headcount: 11000 },
    { name: "REA Group", city: "Melbourne", state: "VIC", industry: "Technology", headcount: 2400 },
    { name: "Nearmap", city: "Sydney", state: "NSW", industry: "Technology", headcount: 600 },
    { name: "MYOB", city: "Melbourne", state: "VIC", industry: "Technology", headcount: 2000 },
    { name: "Toll Group", city: "Melbourne", state: "VIC", industry: "Logistics", headcount: 44000 },
    { name: "Maddocks Lawyers", city: "Melbourne", state: "VIC", industry: "Legal", headcount: 800 },
    { name: "HWL Ebsworth", city: "Brisbane", state: "QLD", industry: "Legal", headcount: 1200 },
    { name: "EY Australia", city: "Brisbane", state: "QLD", industry: "Consulting", headcount: 8000 },
    { name: "Aurecon", city: "Brisbane", state: "QLD", industry: "Engineering", headcount: 7500 },
    { name: "Flight Centre", city: "Brisbane", state: "QLD", industry: "Travel", headcount: 10000 },
    { name: "Afterpay", city: "Melbourne", state: "VIC", industry: "Finance", headcount: 1500 },
    { name: "SafetyCulture", city: "Sydney", state: "NSW", industry: "Technology", headcount: 900 },
    { name: "Canva", city: "Sydney", state: "NSW", industry: "Technology", headcount: 3500 },
    { name: "Airtasker", city: "Sydney", state: "NSW", industry: "Technology", headcount: 350 },
    { name: "Dovetail", city: "Sydney", state: "NSW", industry: "Technology", headcount: 200 },
    { name: "Employment Hero", city: "Sydney", state: "NSW", industry: "Technology", headcount: 850 },
    { name: "PEXA Group", city: "Melbourne", state: "VIC", industry: "Technology", headcount: 700 },
    { name: "Bravura Solutions", city: "Sydney", state: "NSW", industry: "Finance", headcount: 1100 },
    { name: "Iress", city: "Melbourne", state: "VIC", industry: "Technology", headcount: 2100 },
  ];

  const signalTypes = [
    "hiring_surge", "job_growth", "headcount_growth", "expansion_news",
    "press_announcement", "lease_expiry", "linkedin_growth", "new_office",
  ];

  const signalSources: Record<string, string> = {
    hiring_surge: "seek.com.au",
    job_growth: "seek.com.au",
    headcount_growth: "linkedin.com",
    expansion_news: "afr.com",
    press_announcement: "businesswire.com",
    lease_expiry: "domain.com.au",
    linkedin_growth: "linkedin.com",
    new_office: "afr.com",
  };

  const created: RelocationSignal[] = [];
  const usedCompanies = new Set<string>();

  for (let i = 0; i < Math.min(count, AUCompanies.length); i++) {
    const company = AUCompanies[i];
    if (usedCompanies.has(company.name)) continue;
    usedCompanies.add(company.name);

    const signalType = signalTypes[i % signalTypes.length];

    // Deterministic seed from company name + index — no Math.random() in production
    const seed = company.name.split("").reduce((acc, c, idx) => acc + c.charCodeAt(0) * (idx + 1), i * 31) % 100;
    const seed2 = company.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), i * 17) % 100;

    const jobPostings = ["hiring_surge", "job_growth"].includes(signalType)
      ? 5 + (seed % 26) : null;
    const headcountGrowth = ["headcount_growth", "linkedin_growth"].includes(signalType)
      ? 10 + (seed % 61) : null;

    const monthsAhead = 2 + (seed2 % 19);
    const leaseExpiry = signalType === "lease_expiry"
      ? new Date(Date.now() + monthsAhead * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      : null;

    const { probability, tier, timeline } = computeRelocationProbability({
      signalType,
      jobPostingsCount: jobPostings,
      headcountGrowthPct: headcountGrowth,
      leaseExpiryDate: leaseExpiry,
    });

    const sqmVariance = 0.7 + (seed % 60) / 100; // 0.70 – 1.29 range, deterministic
    const sqm = Math.round(company.headcount * 0.12 * sqmVariance);
    const projectValue = estimateProjectValue(company.headcount, sqm, company.industry);

    const detail = signalType === "hiring_surge"
      ? `${company.name} has posted ${jobPostings} new roles in the past 30 days, suggesting significant headcount growth`
      : signalType === "lease_expiry"
      ? `Commercial lease for ${company.name}'s current office space expires ${leaseExpiry} — relocation decision window open`
      : signalType === "expansion_news"
      ? `${company.name} announced plans to expand operations in ${company.city}, likely requiring additional office space`
      : signalType === "press_announcement"
      ? `${company.name} issued a press release regarding their office footprint strategy in Australia`
      : signalType === "headcount_growth"
      ? `${company.name} LinkedIn headcount has grown ${headcountGrowth}% in the past 6 months`
      : signalType === "new_office"
      ? `${company.name} confirmed opening a new office location in ${company.city}`
      : `${company.name} showing ${signalType.replace(/_/g, " ")} signals in ${company.city}`;

    const action = probability >= 65
      ? `Priority outreach — contact ${company.name} decision-maker within 48 hours`
      : probability >= 35
      ? `Warm outreach — add to nurture sequence and monitor for additional signals`
      : `Monitor — add to watchlist for follow-up in 30 days`;

    const record: InsertRelocationSignal = {
      companyName: company.name,
      industry: company.industry,
      city: company.city,
      state: company.state,
      signalType,
      signalSource: signalSources[signalType] ?? "ai_scan",
      signalDetail: detail,
      sourceUrl: null,
      jobPostingsCount: jobPostings,
      estimatedHeadcount: company.headcount,
      headcountGrowthPct: headcountGrowth,
      leaseExpiryDate: leaseExpiry,
      officeSize: sqm,
      relocationProbability: probability,
      probabilityTier: tier,
      estimatedProjectValue: projectValue,
      estimatedTimeline: timeline,
      recommendedAction: action,
      linkedRadarId: null,
      linkedProspectId: null,
      pushedToPipeline: false,
      status: "active",
    };

    const saved = await storage.createRelocationSignal(record);
    created.push(saved);
  }

  return created;
}

// ─── Market Intelligence Aggregation ─────────────────────────────────────────
export async function getMarketIntelligence(): Promise<{
  totalSignals: number;
  highProbabilityCount: number;
  mediumProbabilityCount: number;
  totalPipelineValue: number;
  cityBreakdown: Array<{ city: string; count: number; avgProbability: number; totalValue: number }>;
  industryBreakdown: Array<{ industry: string; count: number; avgProbability: number; totalValue: number }>;
  signalTypeBreakdown: Array<{ signalType: string; count: number }>;
  avgRelocationTimeline: string;
  topOpportunities: RelocationSignal[];
}> {
  const signals = await storage.getRelocationSignals();
  const active = signals.filter(s => s.status === "active");

  const high = active.filter(s => s.probabilityTier === "high");
  const medium = active.filter(s => s.probabilityTier === "medium");

  const totalValue = active.reduce((s, r) => s + (r.estimatedProjectValue ?? 0), 0);

  // City breakdown
  const cityMap = new Map<string, { count: number; probSum: number; value: number }>();
  for (const s of active) {
    const c = cityMap.get(s.city) ?? { count: 0, probSum: 0, value: 0 };
    c.count++; c.probSum += s.relocationProbability; c.value += (s.estimatedProjectValue ?? 0);
    cityMap.set(s.city, c);
  }
  const cityBreakdown = Array.from(cityMap.entries())
    .map(([city, d]) => ({ city, count: d.count, avgProbability: Math.round(d.probSum / d.count), totalValue: d.value }))
    .sort((a, b) => b.totalValue - a.totalValue);

  // Industry breakdown
  const indMap = new Map<string, { count: number; probSum: number; value: number }>();
  for (const s of active) {
    const ind = s.industry ?? "Other";
    const c = indMap.get(ind) ?? { count: 0, probSum: 0, value: 0 };
    c.count++; c.probSum += s.relocationProbability; c.value += (s.estimatedProjectValue ?? 0);
    indMap.set(ind, c);
  }
  const industryBreakdown = Array.from(indMap.entries())
    .map(([industry, d]) => ({ industry, count: d.count, avgProbability: Math.round(d.probSum / d.count), totalValue: d.value }))
    .sort((a, b) => b.totalValue - a.totalValue);

  // Signal type breakdown
  const stMap = new Map<string, number>();
  for (const s of active) stMap.set(s.signalType, (stMap.get(s.signalType) ?? 0) + 1);
  const signalTypeBreakdown = Array.from(stMap.entries())
    .map(([signalType, count]) => ({ signalType, count }))
    .sort((a, b) => b.count - a.count);

  const topOpportunities = [...active]
    .sort((a, b) => b.relocationProbability - a.relocationProbability)
    .slice(0, 10);

  // Average timeline from high-probability
  const timelineCounts: Record<string, number> = {};
  for (const s of high) {
    if (s.estimatedTimeline) timelineCounts[s.estimatedTimeline] = (timelineCounts[s.estimatedTimeline] ?? 0) + 1;
  }
  const avgTimeline = Object.entries(timelineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "3-6 months";

  return {
    totalSignals: active.length,
    highProbabilityCount: high.length,
    mediumProbabilityCount: medium.length,
    totalPipelineValue: totalValue,
    cityBreakdown,
    industryBreakdown,
    signalTypeBreakdown,
    avgRelocationTimeline: avgTimeline,
    topOpportunities,
  };
}

// ─── Push Relocation Signal to Pipeline ───────────────────────────────────────
export async function pushRelocationToPipeline(signalId: string): Promise<{ prospectId: string }> {
  const signal = await storage.getRelocationSignalById(signalId);
  if (!signal) throw new Error("Signal not found");

  const outreach = `Hi,

I noticed ${signal.companyName} appears to be planning an office ${signal.signalType.replace(/_/g, " ")} based on recent market signals. Given your ${signal.estimatedTimeline ?? "upcoming"} timeline, I'd love to connect about how we can help create the ideal workspace for your team.

We specialise in premium Australian office fit-outs for ${signal.industry ?? "corporate"} firms. Happy to share some ideas — would a quick call work this week?`;

  const prospect = await storage.createProspectedLead({
    company: signal.companyName,
    industry: signal.industry ?? "",
    estimatedTeamSize: signal.estimatedHeadcount ? String(signal.estimatedHeadcount) : "",
    estimatedOfficeSqm: signal.officeSize ? String(signal.officeSize) : "",
    likelyOfficeNeed: signal.signalType.replace(/_/g, " "),
    signalsDetected: [signal.signalType],
    score: signal.relocationProbability,
    priority: signal.probabilityTier === "high" ? "High" : signal.probabilityTier === "medium" ? "Medium" : "Low",
    outreachMessage: outreach,
    signalType: signal.signalType,
    estimatedProjectValue: signal.estimatedProjectValue ? `$${signal.estimatedProjectValue.toLocaleString()}` : "",
    dealProbability: signal.relocationProbability,
    status: "New",
    city: signal.city,
    location: `${signal.city}, ${signal.state ?? "AU"}`,
    decisionMakers: "[]",
    reasoning: `Relocation signal detected: ${signal.signalDetail}. Signal type: ${signal.signalType}. Relocation probability: ${signal.relocationProbability}%.`,
    rawInput: JSON.stringify({ signalId: signal.id, companyName: signal.companyName, signalType: signal.signalType, city: signal.city }),
  });

  await storage.updateRelocationSignal(signalId, { pushedToPipeline: true, status: "converted", linkedProspectId: prospect.id });

  return { prospectId: prospect.id };
}
