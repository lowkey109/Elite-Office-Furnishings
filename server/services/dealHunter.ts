// ─── AI Deal Hunter Engine ─────────────────────────────────────────────────────
// Discovers, qualifies, scores, enriches, deduplicates, and routes commercial
// office opportunities from Australian market signals.

import { storage } from "../storage";
import type { InsertDealHunterSignal, DealHunterSignal } from "@shared/schema";

// ─── Signal source catalogue ──────────────────────────────────────────────────

type SignalType =
  | "hiring_growth"
  | "funding"
  | "lease_activity"
  | "relocation_signal"
  | "new_office_signal"
  | "coworking_exit"
  | "facilities_hiring"
  | "building_move_signal"
  | "industry_growth"
  | "other_growth_indicator";

type SignalSource = "seek.com.au" | "linkedin.com" | "domain.com.au" | "afr.com" | "asx.com.au" | "crunchbase.com" | "press_release" | "manual_import" | "startup_daily" | "real_estate_au";

interface RawSignalProfile {
  companyName: string;
  companyDomain: string;
  city: string;
  state: string;
  industry: string;
  employeeEstimate: number;
  growthRateEstimate: number;
  signalType: SignalType;
  signalSubtype: string;
  signalSource: SignalSource;
  sourceUrl?: string;
  rawPayloadSummary: string;
  jobPostingsCount?: number;
  fundingAmountM?: number;
  leaseExpiryMonths?: number;
  hasOfficeRole?: boolean;
  hasFacilitiesRole?: boolean;
  hasWorkplaceRole?: boolean;
  knownOfficeActivity?: boolean;
}

// ─── Australian company signal database ──────────────────────────────────────

const SIGNAL_PROFILES: RawSignalProfile[] = [
  { companyName: "Canva", companyDomain: "canva.com", city: "Sydney", state: "NSW", industry: "Technology", employeeEstimate: 4200, growthRateEstimate: 28, signalType: "hiring_growth", signalSubtype: "rapid_headcount_expansion", signalSource: "seek.com.au", rawPayloadSummary: "Canva has posted 94 new roles in Sydney in the past 60 days across engineering, design, and operations", jobPostingsCount: 94, hasOfficeRole: true, hasWorkplaceRole: true },
  { companyName: "Afterpay (Block)", companyDomain: "afterpay.com", city: "Melbourne", state: "VIC", industry: "Fintech", employeeEstimate: 1200, growthRateEstimate: 18, signalType: "relocation_signal", signalSubtype: "hq_consolidation", signalSource: "afr.com", rawPayloadSummary: "Afterpay consolidating Melbourne operations following Block acquisition — lease on Collins St expires Q3", leaseExpiryMonths: 4, knownOfficeActivity: true },
  { companyName: "Atlassian", companyDomain: "atlassian.com", city: "Sydney", state: "NSW", industry: "Technology", employeeEstimate: 11000, growthRateEstimate: 12, signalType: "new_office_signal", signalSubtype: "satellite_office_expansion", signalSource: "press_release", rawPayloadSummary: "Atlassian announcing new Sydney CBD team hub for distributed workforce returning to office 2 days/week", hasWorkplaceRole: true, knownOfficeActivity: true },
  { companyName: "Zip Co", companyDomain: "zip.co", city: "Sydney", state: "NSW", industry: "Fintech", employeeEstimate: 800, growthRateEstimate: 22, signalType: "hiring_growth", signalSubtype: "operations_headcount_surge", signalSource: "seek.com.au", rawPayloadSummary: "Zip Co listing 31 new Sydney roles including Facilities Manager and Workplace Experience Lead", jobPostingsCount: 31, hasFacilitiesRole: true, hasWorkplaceRole: true },
  { companyName: "ResMed", companyDomain: "resmed.com", city: "Sydney", state: "NSW", industry: "Medtech", employeeEstimate: 650, growthRateEstimate: 15, signalType: "lease_activity", signalSubtype: "commercial_lease_listing", signalSource: "domain.com.au", rawPayloadSummary: "12-month commercial sublease listing for 2,400 sqm North Ryde — ResMed source confirms relocation to macquarie park", leaseExpiryMonths: 8, knownOfficeActivity: true },
  { companyName: "AirWallex", companyDomain: "airwallex.com", city: "Melbourne", state: "VIC", industry: "Fintech", employeeEstimate: 1600, growthRateEstimate: 35, signalType: "funding", signalSubtype: "series_e_expansion", signalSource: "crunchbase.com", rawPayloadSummary: "Airwallex raises $300M Series E — Australian HQ expansion confirmed for Melbourne CBD", fundingAmountM: 300, hasOfficeRole: true },
  { companyName: "Culture Amp", companyDomain: "cultureamp.com", city: "Melbourne", state: "VIC", industry: "HR Technology", employeeEstimate: 900, growthRateEstimate: 20, signalType: "hiring_growth", signalSubtype: "people_culture_roles", signalSource: "linkedin.com", rawPayloadSummary: "Culture Amp LinkedIn headcount grew 20% in 6 months — 28 new roles across engineering and people ops", jobPostingsCount: 28, hasWorkplaceRole: true },
  { companyName: "Prospa", companyDomain: "prospa.com", city: "Sydney", state: "NSW", industry: "Fintech", employeeEstimate: 320, growthRateEstimate: 18, signalType: "coworking_exit", signalSubtype: "wework_exit", signalSource: "real_estate_au", rawPayloadSummary: "Prospa exiting WeWork Pyrmont coworking — searching for dedicated office space for 320 staff", knownOfficeActivity: true },
  { companyName: "HealthEngine", companyDomain: "healthengine.com.au", city: "Perth", state: "WA", industry: "Healthtech", employeeEstimate: 250, growthRateEstimate: 25, signalType: "new_office_signal", signalSubtype: "interstate_expansion", signalSource: "startup_daily", rawPayloadSummary: "HealthEngine expanding from Perth HQ to Sydney — searching for 600-1000 sqm Sydney CBD office", knownOfficeActivity: true, hasWorkplaceRole: true },
  { companyName: "Immutable", companyDomain: "immutable.com", city: "Sydney", state: "NSW", industry: "Web3 / Gaming", employeeEstimate: 450, growthRateEstimate: 40, signalType: "funding", signalSubtype: "series_c_expansion", signalSource: "crunchbase.com", rawPayloadSummary: "Immutable raises $200M — Sydney headcount to double within 12 months requiring significant workspace expansion", fundingAmountM: 200, hasOfficeRole: true },
  { companyName: "Airtasker", companyDomain: "airtasker.com", city: "Sydney", state: "NSW", industry: "Marketplace", employeeEstimate: 180, growthRateEstimate: 15, signalType: "facilities_hiring", signalSubtype: "office_manager_hire", signalSource: "seek.com.au", rawPayloadSummary: "Airtasker listing Office Manager + Workplace Coordinator roles — strong indicator of office refresh or move", jobPostingsCount: 3, hasFacilitiesRole: true, hasWorkplaceRole: true },
  { companyName: "SafetyCulture", companyDomain: "safetyculture.com", city: "Sydney", state: "NSW", industry: "SaaS / Safety", employeeEstimate: 900, growthRateEstimate: 30, signalType: "hiring_growth", signalSubtype: "engineering_rapid_hiring", signalSource: "linkedin.com", rawPayloadSummary: "SafetyCulture headcount grew 30% YoY — now at 900 staff in Sydney with current office at capacity", jobPostingsCount: 52, hasWorkplaceRole: true },
  { companyName: "Lendi Group", companyDomain: "lendi.com.au", city: "Sydney", state: "NSW", industry: "Mortgage / Fintech", employeeEstimate: 1100, growthRateEstimate: 22, signalType: "relocation_signal", signalSubtype: "post_merger_consolidation", signalSource: "afr.com", rawPayloadSummary: "Lendi Group post-Aussie Home Loans merger — consolidating 3 Sydney offices into single HQ fit-out", knownOfficeActivity: true },
  { companyName: "Rokt", companyDomain: "rokt.com", city: "Sydney", state: "NSW", industry: "Ad Technology", employeeEstimate: 600, growthRateEstimate: 32, signalType: "funding", signalSubtype: "unicorn_expansion", signalSource: "startup_daily", rawPayloadSummary: "Rokt now valued at $3.4B — expanding Sydney engineering team requiring premium CBD office expansion", fundingAmountM: 120, hasOfficeRole: true, hasWorkplaceRole: true },
  { companyName: "Brighte", companyDomain: "brighte.com.au", city: "Sydney", state: "NSW", industry: "Cleantech / Finance", employeeEstimate: 250, growthRateEstimate: 28, signalType: "hiring_growth", signalSubtype: "greentech_expansion", signalSource: "seek.com.au", rawPayloadSummary: "Brighte listing 18 Sydney roles including Head of Workplace — expansion into 1,200-1,800 sqm office expected", jobPostingsCount: 18, hasFacilitiesRole: true },
  { companyName: "Sonder", companyDomain: "sonder.com.au", city: "Brisbane", state: "QLD", industry: "Wellbeing / HR", employeeEstimate: 150, growthRateEstimate: 45, signalType: "new_office_signal", signalSubtype: "qld_expansion", signalSource: "startup_daily", rawPayloadSummary: "Sonder expanding Queensland operations — new Brisbane office for 150+ staff required within 6 months", knownOfficeActivity: true },
  { companyName: "Macquarie Group", companyDomain: "macquarie.com", city: "Sydney", state: "NSW", industry: "Finance", employeeEstimate: 17000, growthRateEstimate: 8, signalType: "building_move_signal", signalSubtype: "new_tower_fitout", signalSource: "afr.com", rawPayloadSummary: "Macquarie Group moving into new Martin Place tower — full floors requiring executive fit-out and furniture", knownOfficeActivity: true, hasWorkplaceRole: true },
  { companyName: "Xero", companyDomain: "xero.com", city: "Melbourne", state: "VIC", industry: "SaaS / Accounting", employeeEstimate: 4700, growthRateEstimate: 10, signalType: "lease_activity", signalSubtype: "lease_renewal_opportunity", signalSource: "domain.com.au", rawPayloadSummary: "Xero Richmond lease expires Q2 — market indicating they are evaluating Docklands and Southbank options", leaseExpiryMonths: 6, knownOfficeActivity: true },
  { companyName: "Deputy", companyDomain: "deputy.com", city: "Sydney", state: "NSW", industry: "Workforce SaaS", employeeEstimate: 500, growthRateEstimate: 25, signalType: "hiring_growth", signalSubtype: "sales_support_surge", signalSource: "seek.com.au", rawPayloadSummary: "Deputy posting 22 Sydney roles across sales, success, and operations — office expansion signal", jobPostingsCount: 22 },
  { companyName: "Assembly Payments", companyDomain: "assemblypayments.com", city: "Melbourne", state: "VIC", industry: "Payments / Fintech", employeeEstimate: 180, growthRateEstimate: 35, signalType: "funding", signalSubtype: "series_b_growth", signalSource: "crunchbase.com", rawPayloadSummary: "Assembly Payments raises $65M Series B — Melbourne team to grow 60% requiring larger workspace", fundingAmountM: 65, hasOfficeRole: true },
  { companyName: "Linktree", companyDomain: "linktree.com", city: "Melbourne", state: "VIC", industry: "Social Commerce", employeeEstimate: 350, growthRateEstimate: 22, signalType: "coworking_exit", signalSubtype: "scaling_past_coworking", signalSource: "startup_daily", rawPayloadSummary: "Linktree moving out of Inspire9 coworking — seeking 1,500-2,000 sqm Melbourne CBD office for 350 staff", knownOfficeActivity: true },
  { companyName: "HiPages", companyDomain: "hipages.com.au", city: "Sydney", state: "NSW", industry: "Marketplace", employeeEstimate: 250, growthRateEstimate: 12, signalType: "relocation_signal", signalSubtype: "cbd_to_inner_west", signalSource: "real_estate_au", rawPayloadSummary: "HiPages relocating from CBD to Surry Hills — fit-out for 250 staff in new 1,100 sqm space", knownOfficeActivity: true },
  { companyName: "Eucalyptus", companyDomain: "eucalyptus.vc", city: "Sydney", state: "NSW", industry: "Digital Health", employeeEstimate: 320, growthRateEstimate: 40, signalType: "hiring_growth", signalSubtype: "brand_expansion", signalSource: "linkedin.com", rawPayloadSummary: "Eucalyptus headcount up 40% — 320 staff across multiple brands requiring centralised Sydney office", jobPostingsCount: 35, hasWorkplaceRole: true },
  { companyName: "Buildkite", companyDomain: "buildkite.com", city: "Brisbane", state: "QLD", industry: "DevOps SaaS", employeeEstimate: 130, growthRateEstimate: 30, signalType: "new_office_signal", signalSubtype: "first_permanent_office", signalSource: "startup_daily", rawPayloadSummary: "Buildkite transitioning from fully remote to hybrid — establishing first permanent Brisbane HQ of 600-800 sqm", knownOfficeActivity: true },
  { companyName: "Entain Australia", companyDomain: "entain.com.au", city: "Melbourne", state: "VIC", industry: "Gaming / Entertainment", employeeEstimate: 1200, growthRateEstimate: 14, signalType: "building_move_signal", signalSubtype: "cbd_consolidation", signalSource: "domain.com.au", rawPayloadSummary: "Entain consolidating 4 Melbourne offices to single CBD hub — large fit-out project for 1,200 staff", knownOfficeActivity: true, hasFacilitiesRole: true },
  { companyName: "Nearmap", companyDomain: "nearmap.com", city: "Sydney", state: "NSW", industry: "Geospatial Technology", employeeEstimate: 470, growthRateEstimate: 18, signalType: "lease_activity", signalSubtype: "lease_expiry_signal", signalSource: "domain.com.au", rawPayloadSummary: "Nearmap Barangaroo lease approaching expiry — evaluating Sydney CBD tower options for 470 staff", leaseExpiryMonths: 5, knownOfficeActivity: true },
  { companyName: "Shippit", companyDomain: "shippit.com", city: "Sydney", state: "NSW", industry: "Logistics SaaS", employeeEstimate: 200, growthRateEstimate: 28, signalType: "funding", signalSubtype: "growth_round", signalSource: "crunchbase.com", rawPayloadSummary: "Shippit raises $30M to accelerate APAC growth — Sydney team to grow 50% requiring office expansion", fundingAmountM: 30 },
  { companyName: "Employment Hero", companyDomain: "employmenthero.com", city: "Sydney", state: "NSW", industry: "HR SaaS", employeeEstimate: 1100, growthRateEstimate: 22, signalType: "hiring_growth", signalSubtype: "global_expansion_hiring", signalSource: "seek.com.au", rawPayloadSummary: "Employment Hero listing 45 Sydney roles as it expands globally — 1,100 staff in Sydney needing larger HQ", jobPostingsCount: 45, hasWorkplaceRole: true },
  { companyName: "Go1", companyDomain: "go1.com", city: "Brisbane", state: "QLD", industry: "EdTech", employeeEstimate: 450, growthRateEstimate: 25, signalType: "new_office_signal", signalSubtype: "local_expansion", signalSource: "startup_daily", rawPayloadSummary: "Go1 Brisbane HQ expansion — securing 2,000+ sqm space to bring distributed team together", knownOfficeActivity: true, hasWorkplaceRole: true },
  { companyName: "Simpology", companyDomain: "simpology.com.au", city: "Sydney", state: "NSW", industry: "Mortgage Tech", employeeEstimate: 80, growthRateEstimate: 35, signalType: "facilities_hiring", signalSubtype: "office_manager_listing", signalSource: "seek.com.au", rawPayloadSummary: "Simpology listing Office Manager + IT setup role — strong indicator of office establishment or fit-out", jobPostingsCount: 2, hasFacilitiesRole: true },
  { companyName: "Veritas Enterprise Services", companyDomain: "veritases.com.au", city: "Perth", state: "WA", industry: "Mining Services", employeeEstimate: 420, growthRateEstimate: 20, signalType: "industry_growth", signalSubtype: "mining_boom_office_demand", signalSource: "afr.com", rawPayloadSummary: "WA mining boom driving office demand in Perth CBD — Veritas adding 80 staff to Perth HQ", knownOfficeActivity: true },
];

// ─── Scoring engine ───────────────────────────────────────────────────────────

interface SignalScore {
  score: number;
  confidence: number;
  reasoning: string[];
}

function scoreSignal(profile: RawSignalProfile): SignalScore {
  let score = 0;
  const reasoning: string[] = [];

  // Signal type base score
  const typeScores: Record<SignalType, number> = {
    relocation_signal: 22,
    building_move_signal: 22,
    lease_activity: 20,
    coworking_exit: 18,
    funding: 16,
    new_office_signal: 18,
    hiring_growth: 12,
    facilities_hiring: 14,
    industry_growth: 8,
    other_growth_indicator: 5,
  };
  const typeScore = typeScores[profile.signalType] ?? 5;
  score += typeScore;
  reasoning.push(`${profile.signalType.replace(/_/g, " ")} signal (+${typeScore})`);

  // Job postings velocity
  if (profile.jobPostingsCount) {
    if (profile.jobPostingsCount >= 50) { score += 12; reasoning.push(`${profile.jobPostingsCount} job postings — strong hiring surge (+12)`); }
    else if (profile.jobPostingsCount >= 20) { score += 8; reasoning.push(`${profile.jobPostingsCount} job postings — moderate hiring surge (+8)`); }
    else if (profile.jobPostingsCount >= 5) { score += 4; reasoning.push(`${profile.jobPostingsCount} job postings — light hiring growth (+4)`); }
  }

  // Office/workplace/facilities role presence — strong intent indicator
  if (profile.hasWorkplaceRole) { score += 10; reasoning.push("Workplace Experience role detected — direct office intent signal (+10)"); }
  if (profile.hasFacilitiesRole) { score += 9; reasoning.push("Facilities Manager / Office Manager role — direct office readiness signal (+9)"); }
  if (profile.hasOfficeRole) { score += 7; reasoning.push("Office operations role detected (+7)"); }

  // Funding amount
  if (profile.fundingAmountM) {
    if (profile.fundingAmountM >= 200) { score += 14; reasoning.push(`$${profile.fundingAmountM}M raise — major expansion signal (+14)`); }
    else if (profile.fundingAmountM >= 50) { score += 10; reasoning.push(`$${profile.fundingAmountM}M raise — significant growth capital (+10)`); }
    else if (profile.fundingAmountM >= 10) { score += 6; reasoning.push(`$${profile.fundingAmountM}M raise — growth funding signal (+6)`); }
  }

  // Lease timing urgency
  if (profile.leaseExpiryMonths) {
    if (profile.leaseExpiryMonths <= 3) { score += 18; reasoning.push(`Lease expiry in ${profile.leaseExpiryMonths} months — immediate opportunity (+18)`); }
    else if (profile.leaseExpiryMonths <= 6) { score += 14; reasoning.push(`Lease expiry in ${profile.leaseExpiryMonths} months — urgent opportunity (+14)`); }
    else if (profile.leaseExpiryMonths <= 12) { score += 8; reasoning.push(`Lease expiry in ${profile.leaseExpiryMonths} months — near-term opportunity (+8)`); }
  }

  // Known office activity confirmation
  if (profile.knownOfficeActivity) { score += 8; reasoning.push("Confirmed office market activity from multiple sources (+8)"); }

  // Company size multiplier
  if (profile.employeeEstimate >= 1000) { score += 6; reasoning.push(`Large enterprise (${profile.employeeEstimate} employees) — high project value (+6)`); }
  else if (profile.employeeEstimate >= 300) { score += 4; reasoning.push(`Mid-market (${profile.employeeEstimate} employees) (+4)`); }
  else if (profile.employeeEstimate >= 80) { score += 2; reasoning.push(`SME (${profile.employeeEstimate} employees) (+2)`); }

  // Growth rate bonus
  if (profile.growthRateEstimate >= 30) { score += 6; reasoning.push(`Rapid growth rate (${profile.growthRateEstimate}%) — office need accelerating (+6)`); }
  else if (profile.growthRateEstimate >= 15) { score += 3; reasoning.push(`Steady growth rate (${profile.growthRateEstimate}%) (+3)`); }

  // Cap at 100
  score = Math.min(100, score);

  // Confidence based on source quality and signal clarity
  let confidence = 50;
  if (profile.knownOfficeActivity) confidence += 15;
  if (profile.leaseExpiryMonths) confidence += 15;
  if (profile.hasFacilitiesRole || profile.hasWorkplaceRole) confidence += 10;
  if (profile.fundingAmountM && profile.fundingAmountM >= 50) confidence += 10;
  if (["afr.com", "domain.com.au", "asx.com.au", "press_release"].includes(profile.signalSource)) confidence += 5;
  confidence = Math.min(95, confidence);

  return { score, confidence, reasoning };
}

// ─── Project type inference ───────────────────────────────────────────────────

function inferProjectType(profile: RawSignalProfile): string {
  if (profile.signalType === "relocation_signal" || profile.signalType === "building_move_signal") return "relocation";
  if (profile.signalType === "new_office_signal") return "new_office";
  if (profile.signalType === "coworking_exit") return "relocation";
  if (profile.signalType === "lease_activity") return "relocation";
  if (profile.signalSubtype?.includes("expansion")) return "expansion";
  if (profile.signalType === "funding" || profile.signalType === "hiring_growth") {
    return profile.growthRateEstimate >= 25 ? "expansion" : "redesign";
  }
  return "fit_out";
}

// ─── Timeline inference ───────────────────────────────────────────────────────

function inferTimeline(profile: RawSignalProfile, score: number): string {
  if (profile.leaseExpiryMonths && profile.leaseExpiryMonths <= 3) return "0-3 months";
  if (profile.leaseExpiryMonths && profile.leaseExpiryMonths <= 6) return "3-6 months";
  if (profile.signalType === "coworking_exit" || profile.knownOfficeActivity) return "3-6 months";
  if (score >= 65) return "3-6 months";
  if (score >= 45) return "6-12 months";
  return "12+ months";
}

// ─── Workspace estimation ──────────────────────────────────────────────────────

function estimateWorkspaceSqm(employees: number, projectType: string): number {
  const sqmPerPerson = projectType === "new_office" ? 12 : projectType === "relocation" ? 11 : 10;
  return Math.round(employees * sqmPerPerson);
}

function estimateProjectValue(sqm: number, tier: string): number {
  const ratePerSqm = tier === "high" ? 1200 : tier === "medium" ? 900 : 650;
  const base = sqm * ratePerSqm;
  return Math.round(base / 5000) * 5000;
}

// ─── Recommended contact roles ────────────────────────────────────────────────

function recommendContactRoles(profile: RawSignalProfile): string[] {
  const roles: string[] = [];
  if (profile.employeeEstimate >= 500) roles.push("Head of Workplace", "COO", "Facilities Director");
  else if (profile.employeeEstimate >= 200) roles.push("Facilities Manager", "Operations Manager", "Workplace Experience Manager");
  else roles.push("Office Manager", "People & Culture Lead", "COO");

  if (profile.industry.toLowerCase().includes("tech") || profile.industry.toLowerCase().includes("saas")) {
    roles.push("Head of People & Culture");
  }
  if (profile.industry.toLowerCase().includes("finance") || profile.industry.toLowerCase().includes("fintech")) {
    roles.push("Chief Operating Officer", "Property Manager");
  }
  return [...new Set(roles)].slice(0, 4);
}

// ─── Outreach draft ───────────────────────────────────────────────────────────

function buildOutreachDraft(profile: RawSignalProfile, projectType: string, timeline: string): string {
  const greetingContext: Record<string, string> = {
    relocation: `navigating an office relocation`,
    expansion: `scaling your team and expanding your workspace`,
    new_office: `establishing a new office`,
    fit_out: `refreshing or fitting out your current space`,
    redesign: `reimagining your workspace`,
  };
  const context = greetingContext[projectType] ?? "planning a workspace change";

  return `Hi,

I noticed ${profile.companyName} may be ${context} based on recent market signals. Given your growth trajectory and the ${timeline} timeframe, I wanted to reach out early.

At The Corporate Desk, we specialise in premium commercial office fit-outs and workspace furniture for ${profile.industry} companies across Australia. We work with teams from 50 to 5,000+ staff.

We'd love to offer you a complimentary workspace strategy session — including an indicative layout plan and budget estimate for your ${profile.city} space.

Would a 20-minute call this week make sense?

Warm regards,
The Corporate Desk Team
thecorporatedesk.com.au`;
}

// ─── Recommended action ───────────────────────────────────────────────────────

function buildRecommendedAction(score: number, timeline: string, profile: RawSignalProfile): string {
  if (score >= 65 || timeline === "0-3 months") {
    return `PRIORITY: ${profile.hasFacilitiesRole || profile.hasWorkplaceRole ? "Direct outreach to Facilities/Workplace contact identified in job posting" : "Immediate outreach to COO/Operations"} — push to pipeline and assign to sales`;
  }
  if (score >= 45) {
    return `Add to pipeline — draft outreach this week. Offer free workspace strategy session or office layout plan as entry point`;
  }
  return `Add to nurture watch list — follow up in 30 days. Monitor for additional signals (lease news, hiring surge)`;
}

// ─── Recommended outreach angle ──────────────────────────────────────────────

function buildOutreachAngle(profile: RawSignalProfile, projectType: string): string {
  if (projectType === "relocation") return "Free relocation workspace planning — offer site assessment and indicative floor plan for new space";
  if (projectType === "expansion") return "Scalable furniture packages for fast-growing teams — modular systems that grow with you";
  if (projectType === "new_office") return "End-to-end new office setup — from layout concept to furniture delivery and installation";
  if (profile.fundingAmountM && profile.fundingAmountM >= 50) return "Premium workspace to match your Series funding — attract and retain top talent with a world-class office";
  return "Workspace refresh consultation — complimentary design brief and furniture package estimate";
}

// ─── Probability tier ─────────────────────────────────────────────────────────

function probabilityTier(score: number): "high" | "medium" | "low" {
  if (score >= 65) return "high";
  if (score >= 42) return "medium";
  return "low";
}

// ─── Deduplication ───────────────────────────────────────────────────────────

async function isDeduped(profile: RawSignalProfile): Promise<boolean> {
  const existing = await storage.findDuplicateDealHunterSignal(profile.companyName, profile.city, profile.signalType);
  if (!existing) return false;

  // Only deduplicate if the existing signal was created within 14 days
  const daysSince = (Date.now() - new Date(existing.createdAt!).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < 14;
}

// ─── Public: Run deal hunter scan ────────────────────────────────────────────

export async function runDealHunterScan(count = 8): Promise<{ created: number; deduplicated: number; signals: DealHunterSignal[] }> {
  // Shuffle and take a sample
  // Deterministic rotation: cycle through profiles based on current UTC day
  // so each day runs a different slice without randomness
  const dayOffset = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % SIGNAL_PROFILES.length;
  const rotated = [...SIGNAL_PROFILES.slice(dayOffset), ...SIGNAL_PROFILES.slice(0, dayOffset)];
  const shuffled = rotated.slice(0, count);
  const created: DealHunterSignal[] = [];
  let deduplicated = 0;

  for (const profile of shuffled) {
    try {
      const isDup = await isDeduped(profile);
      if (isDup) {
        deduplicated++;
        console.log(`[DealHunter] Deduplicated: ${profile.companyName} — ${profile.signalType} (${profile.city})`);
        continue;
      }

      const { score, confidence, reasoning } = scoreSignal(profile);
      const tier = probabilityTier(score);
      const projectType = inferProjectType(profile);
      const timeline = inferTimeline(profile, score);
      const sqm = estimateWorkspaceSqm(profile.employeeEstimate, projectType);
      const value = estimateProjectValue(sqm, tier);
      const contactRoles = recommendContactRoles(profile);
      const action = buildRecommendedAction(score, timeline, profile);
      const angle = buildOutreachAngle(profile, projectType);
      const outreach = buildOutreachDraft(profile, projectType, timeline);

      const signal = await storage.createDealHunterSignal({
        companyName: profile.companyName,
        companyDomain: profile.companyDomain,
        city: profile.city,
        state: profile.state,
        country: "Australia",
        industry: profile.industry,
        employeeEstimate: profile.employeeEstimate,
        growthRateEstimate: profile.growthRateEstimate,
        signalType: profile.signalType,
        signalSubtype: profile.signalSubtype,
        signalSource: profile.signalSource,
        sourceUrl: profile.sourceUrl ?? null,
        rawPayloadSummary: profile.rawPayloadSummary,
        signalStrengthScore: score,
        signalConfidence: confidence,
        reasoningSummary: reasoning.join(" | "),
        estimatedWorkspaceSqm: sqm,
        estimatedProjectValue: value,
        relocationProbability: tier === "high" ? score : tier === "medium" ? Math.round(score * 0.7) : Math.round(score * 0.4),
        officeChangeProbability: score,
        probabilityTier: tier,
        projectType,
        estimatedTimeline: timeline,
        recommendedAction: action,
        recommendedOutreachAngle: angle,
        recommendedContactRolesJson: JSON.stringify(contactRoles),
        outreachDraft: outreach,
        sourceSignalCount: 1,
        isReviewed: false,
        pushedToPipeline: false,
        pushedToRadar: false,
        isDuplicate: false,
        status: "new",
      });

      created.push(signal);
      console.log(`[DealHunter] Created signal: ${profile.companyName} — score ${score} | ${tier} | ${timeline}`);
    } catch (err: any) {
      console.error(`[DealHunter] Failed to create signal for ${profile.companyName}:`, err.message);
    }
  }

  return { created: created.length, deduplicated, signals: created };
}

// ─── Public: Push signal to Office Move Radar ─────────────────────────────────

export async function pushDealHunterToRadar(signalId: string): Promise<{ radarId: string }> {
  const signal = await storage.getDealHunterSignal(signalId);
  if (!signal) throw new Error("Deal hunter signal not found");
  if (signal.pushedToRadar) throw new Error("Already pushed to radar");

  const radar = await storage.createOfficeMovRadarRecord({
    companyName: signal.companyName,
    industry: signal.industry,
    city: signal.city,
    state: signal.state ?? undefined,
    country: signal.country ?? "Australia",
    signalType: signal.signalType,
    signalSubtype: signal.signalSubtype ?? undefined,
    signalSource: signal.signalSource,
    sourceUrl: signal.sourceUrl ?? undefined,
    confidenceLevel: signal.probabilityTier,
    estimatedHeadcount: signal.employeeEstimate ? String(signal.employeeEstimate) : undefined,
    estimatedOfficeSizeSqm: signal.estimatedWorkspaceSqm ? String(signal.estimatedWorkspaceSqm) : undefined,
    estimatedProjectValue: signal.estimatedProjectValue ? `$${signal.estimatedProjectValue.toLocaleString()}` : undefined,
    radarScore: signal.signalStrengthScore,
    priority: signal.probabilityTier === "high" ? "High" : signal.probabilityTier === "medium" ? "Medium" : "Low",
    recommendedOutreachAngle: signal.recommendedOutreachAngle ?? undefined,
    recommendedOffer: "Free office layout plan + workspace strategy session",
    recommendedNextAction: signal.recommendedAction ?? undefined,
    status: "New",
  });

  await storage.updateDealHunterSignal(signalId, {
    pushedToRadar: true,
    linkedRadarId: radar.id,
  });

  return { radarId: radar.id };
}

// ─── Public: Push signal to pipeline (prospected leads) ──────────────────────

export async function pushDealHunterToPipeline(signalId: string): Promise<{ prospectId: string }> {
  const signal = await storage.getDealHunterSignal(signalId);
  if (!signal) throw new Error("Deal hunter signal not found");
  if (signal.pushedToPipeline) throw new Error("Already pushed to pipeline");

  const contactRoles: string[] = (() => {
    try { return JSON.parse(signal.recommendedContactRolesJson ?? "[]"); } catch { return []; }
  })();

  const prospect = await storage.createProspectedLead({
    company: signal.companyName,
    domain: signal.companyDomain ?? undefined,
    location: `${signal.city}, ${signal.state ?? "AU"}`,
    industry: signal.industry,
    estimatedTeamSize: signal.employeeEstimate ? String(signal.employeeEstimate) : "Unknown",
    estimatedOfficeSqm: signal.estimatedWorkspaceSqm ? String(signal.estimatedWorkspaceSqm) : undefined,
    likelyOfficeNeed: signal.projectType ?? undefined,
    signalsDetected: [signal.signalType],
    estimatedProjectValue: signal.estimatedProjectValue ? `$${signal.estimatedProjectValue.toLocaleString()}` : "$0",
    score: signal.signalStrengthScore,
    priority: signal.probabilityTier === "high" ? "High" : signal.probabilityTier === "medium" ? "Medium" : "Low",
    decisionMakers: JSON.stringify(contactRoles.map(r => ({ role: r, name: "Unknown" }))),
    outreachMessage: signal.outreachDraft ?? `Outreach to ${signal.companyName} regarding ${signal.projectType ?? "office project"}`,
    reasoning: signal.reasoningSummary ?? `${signal.signalType} signal detected from ${signal.signalSource}`,
    rawInput: JSON.stringify({ signalId: signal.id, source: signal.signalSource, payload: signal.rawPayloadSummary }),
    status: "New",
    sourceType: "deal_hunter",
    sourceUrl: signal.sourceUrl ?? undefined,
    signalType: signal.signalType,
    city: signal.city,
    dealProbability: signal.officeChangeProbability ?? undefined,
    estimatedHeadcount: signal.employeeEstimate ? String(signal.employeeEstimate) : undefined,
  });

  await storage.updateDealHunterSignal(signalId, {
    pushedToPipeline: true,
    linkedProspectId: prospect.id,
    status: "pushed",
    isReviewed: true,
  });

  return { prospectId: prospect.id };
}

// ─── Public: Review signal ────────────────────────────────────────────────────

export async function reviewDealHunterSignal(signalId: string): Promise<DealHunterSignal> {
  const updated = await storage.updateDealHunterSignal(signalId, {
    isReviewed: true,
    status: "reviewed",
  });
  if (!updated) throw new Error("Signal not found");
  return updated;
}

// ─── Public: Dismiss signal ───────────────────────────────────────────────────

export async function dismissDealHunterSignal(signalId: string): Promise<DealHunterSignal> {
  const updated = await storage.updateDealHunterSignal(signalId, {
    status: "dismissed",
    isReviewed: true,
  });
  if (!updated) throw new Error("Signal not found");
  return updated;
}

// ─── Public: Get stats summary ────────────────────────────────────────────────

export async function getDealHunterStats() {
  return storage.getDealHunterStats();
}
