// ─── AI Deal Intelligence Engine ─────────────────────────────────────────────
// Analyses leads, planning requests, quotes, radar opportunities, and pipeline
// records to produce: win probability, expected value, gross profit,
// recommended next action, follow-up timing, and offer strategy.
// All logic is deterministic, weighted, and transparent — no randomness.

import { storage } from "../storage";
import type { InsertDealIntelligence } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DealSignals {
  pipelineStage: string;
  radarScore: number;
  radarConfidence: string;
  staffCount: number;
  officeSizeSqm: number;
  budgetBand: string;
  hasPlanningRequest: boolean;
  isPlanningRequestPaid: boolean;
  hasQuote: boolean;
  isQuoteSent: boolean;
  isQuoteAccepted: boolean;
  financeInterest: boolean;
  industryFit: string;
  urgencyLevel: string;
  workspaceComplexity: number;
  historicalConversionRate: number;
  marginQuality: number;
  leadSource: string;
  hasFollowUpActive: boolean;
  daysSinceCreated: number;
}

export interface DealIntelligenceResult {
  winProbability: number;
  probabilityTier: "low" | "medium" | "high";
  confidenceLevel: "low" | "medium" | "high";
  dealStrength: number;
  estimatedProjectValue: number;
  estimatedGrossProfit: number;
  estimatedMarginPct: number;
  weightedExpectedRevenue: number;
  weightedExpectedProfit: number;
  recommendedNextAction: string;
  recommendedFollowUpTiming: string;
  recommendedOffer: string;
  reasoningSummary: string;
  scoringSignals: Record<string, number>;
}

// ─── Industry fit scoring ────────────────────────────────────────────────────

const HIGH_FIT_INDUSTRIES = [
  "technology", "tech", "finance", "financial", "legal", "law",
  "professional services", "consulting", "accounting", "insurance",
  "real estate", "property", "media", "advertising", "healthcare"
];

const MEDIUM_FIT_INDUSTRIES = [
  "construction", "engineering", "education", "government", "retail",
  "logistics", "mining", "energy"
];

function scoreIndustryFit(industry: string): number {
  const lower = (industry || "").toLowerCase();
  if (HIGH_FIT_INDUSTRIES.some(i => lower.includes(i))) return 8;
  if (MEDIUM_FIT_INDUSTRIES.some(i => lower.includes(i))) return 4;
  return 2;
}

// ─── Budget parsing ──────────────────────────────────────────────────────────

function parseBudgetBand(budget: string | null | undefined): { min: number; max: number; label: string } {
  if (!budget) return { min: 0, max: 0, label: "unknown" };
  const b = budget.toLowerCase();
  if (b.includes("400") || b.includes("500") || b.includes("1m") || b.includes("million")) return { min: 400000, max: 800000, label: "enterprise" };
  if (b.includes("300") || b.includes("350")) return { min: 300000, max: 400000, label: "large" };
  if (b.includes("200") || b.includes("250")) return { min: 200000, max: 300000, label: "large" };
  if (b.includes("120") || b.includes("150")) return { min: 120000, max: 200000, label: "medium-high" };
  if (b.includes("80") || b.includes("100")) return { min: 80000, max: 120000, label: "medium" };
  if (b.includes("50") || b.includes("60") || b.includes("70")) return { min: 50000, max: 80000, label: "small-medium" };
  if (b.includes("30") || b.includes("40")) return { min: 30000, max: 50000, label: "small" };
  // Try to find dollar amounts
  const match = budget.match(/\$([\d,]+)/);
  if (match) {
    const val = parseInt(match[1].replace(/,/g, ""));
    if (val >= 400000) return { min: val, max: val * 1.5, label: "enterprise" };
    if (val >= 120000) return { min: val, max: val * 1.3, label: "large" };
    if (val >= 50000) return { min: val, max: val * 1.2, label: "medium" };
    return { min: val, max: val * 1.1, label: "small" };
  }
  return { min: 0, max: 0, label: "unknown" };
}

function parseSqm(sqm: string | null | undefined): number {
  if (!sqm) return 0;
  const match = sqm.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function parseStaff(staff: string | null | undefined): number {
  if (!staff) return 0;
  const match = staff.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// ─── Win Probability Engine ──────────────────────────────────────────────────
// Total possible raw points: ~120. Scaled to 0–100.

export function computeWinProbability(signals: Partial<DealSignals>): {
  score: number;
  breakdown: Record<string, number>;
} {
  const breakdown: Record<string, number> = {};

  // 1. Pipeline stage (max 25pts)
  const STAGE_POINTS: Record<string, number> = {
    "Lead Detected": 5, "New": 5,
    "Contacted": 12, "Responded": 12,
    "Planning": 18, "Qualified": 18,
    "Quoted": 22,
    "Negotiation": 25,
    "Won": 30, "Closed": 30,
    "Lost": 0,
  };
  breakdown.pipelineStage = STAGE_POINTS[signals.pipelineStage ?? "New"] ?? 5;

  // 2. Office Move Radar signal strength (max 12pts)
  const radarScore = signals.radarScore ?? 0;
  const radarConf = signals.radarConfidence ?? "low";
  if (radarScore > 0) {
    let pts = radarScore >= 70 ? 12 : radarScore >= 50 ? 9 : radarScore >= 30 ? 6 : 3;
    if (radarConf === "low") pts = Math.round(pts * 0.6);
    breakdown.radarSignal = pts;
  } else {
    breakdown.radarSignal = 0;
  }

  // 3. Company size — staff (max 10pts)
  const staff = signals.staffCount ?? 0;
  breakdown.staffSize = staff >= 75 ? 10 : staff >= 25 ? 7 : staff >= 10 ? 5 : staff >= 5 ? 3 : 1;

  // 4. Office size (max 8pts)
  const sqm = signals.officeSizeSqm ?? 0;
  breakdown.officeSize = sqm >= 800 ? 8 : sqm >= 300 ? 6 : sqm >= 100 ? 4 : sqm > 0 ? 2 : 0;

  // 5. Budget quality (max 12pts)
  const budget = parseBudgetBand(signals.budgetBand);
  breakdown.budgetQuality = budget.min >= 400000 ? 12 : budget.min >= 120000 ? 9 : budget.min >= 50000 ? 6 : budget.min >= 20000 ? 3 : 0;

  // 6. Planning request submitted (max 10pts)
  breakdown.hasPlanningRequest = signals.hasPlanningRequest ? (signals.isPlanningRequestPaid ? 10 : 7) : 0;

  // 7. Quote generated (max 8pts)
  breakdown.hasQuote = signals.hasQuote
    ? (signals.isQuoteAccepted ? 8 : signals.isQuoteSent ? 6 : 4)
    : 0;

  // 8. Finance interest (max 6pts)
  breakdown.financeInterest = signals.financeInterest ? 6 : 0;

  // 9. Industry fit (max 8pts)
  breakdown.industryFit = scoreIndustryFit(signals.industryFit ?? "");

  // 10. Urgency (max 6pts)
  const urgency = (signals.urgencyLevel ?? "").toLowerCase();
  breakdown.urgency = urgency.includes("immed") || urgency.includes("asap") || urgency.includes("urgent") ? 6
    : urgency.includes("3 month") || urgency.includes("quarter") ? 4
    : urgency.includes("6 month") ? 3
    : 1;

  // 11. Workspace complexity — more zones = more committed (max 5pts)
  breakdown.complexity = Math.min(signals.workspaceComplexity ?? 0, 5);

  // 12. Historical conversion from workspace learning (max 5pts)
  const histRate = signals.historicalConversionRate ?? 0;
  breakdown.historicalConversion = Math.round(histRate * 5);

  // 13. Margin quality from profit engine (max 5pts)
  const margin = signals.marginQuality ?? 0;
  breakdown.marginQuality = margin >= 35 ? 5 : margin >= 25 ? 3 : margin >= 15 ? 2 : 0;

  // 14. Follow-up active (max 3pts)
  breakdown.followUpActive = signals.hasFollowUpActive ? 3 : 0;

  // 15. Recency bonus — fresh leads are warmer (max 3pts)
  const days = signals.daysSinceCreated ?? 999;
  breakdown.recency = days <= 3 ? 3 : days <= 7 ? 2 : days <= 14 ? 1 : 0;

  // Sum and scale
  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const maxPossible = 120;
  const scaled = Math.min(100, Math.round((raw / maxPossible) * 100));

  return { score: scaled, breakdown };
}

// ─── Probability Tier ────────────────────────────────────────────────────────

export function getProbabilityTier(score: number): "low" | "medium" | "high" {
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

// ─── Confidence Level ─────────────────────────────────────────────────────────

export function getConfidenceLevel(signals: Partial<DealSignals>): "low" | "medium" | "high" {
  let knownFields = 0;
  if (signals.staffCount && signals.staffCount > 0) knownFields++;
  if (signals.officeSizeSqm && signals.officeSizeSqm > 0) knownFields++;
  if (signals.budgetBand && signals.budgetBand !== "unknown") knownFields++;
  if (signals.hasPlanningRequest) knownFields++;
  if (signals.hasQuote) knownFields++;
  if (signals.pipelineStage && signals.pipelineStage !== "Lead Detected") knownFields++;
  if (signals.radarScore && signals.radarScore > 0) knownFields++;
  if (knownFields >= 5) return "high";
  if (knownFields >= 3) return "medium";
  return "low";
}

// ─── Value + Profit Estimation ────────────────────────────────────────────────
// Average margins from profit engine: ~30% on balanced packages

const MARGIN_BY_TIER: Record<string, number> = {
  premium: 35, balanced: 30, value: 25, unknown: 28
};

const SQM_RATE = 1800; // AUD per sqm baseline for commercial fit-out
const STAFF_RATE = 4500; // AUD per staff member for workstation + chair + accessories

export function estimateProjectValue(signals: Partial<DealSignals>, exactQuoteTotal?: number): {
  estimatedValue: number;
  estimatedGrossProfit: number;
  estimatedMarginPct: number;
  weightedRevenue: number;
  weightedProfit: number;
  basis: string;
} {
  let value = 0;
  let basis = "indicative";
  let marginPct = 28;

  // Priority 1: use exact quote total
  if (exactQuoteTotal && exactQuoteTotal > 0) {
    value = exactQuoteTotal;
    marginPct = signals.marginQuality ?? 30;
    basis = "exact_quote";
  }
  // Priority 2: budget band
  else if (signals.budgetBand) {
    const budget = parseBudgetBand(signals.budgetBand);
    if (budget.min > 0) {
      value = Math.round((budget.min + budget.max) / 2);
      basis = "budget_band";
    }
  }

  // Priority 3: sqm × rate
  if (value === 0 && signals.officeSizeSqm && signals.officeSizeSqm > 0) {
    value = signals.officeSizeSqm * SQM_RATE;
    basis = "sqm_rate";
  }

  // Priority 4: staff × rate
  if (value === 0 && signals.staffCount && signals.staffCount > 0) {
    value = signals.staffCount * STAFF_RATE;
    basis = "staff_rate";
  }

  // Default minimum
  if (value === 0) {
    value = 45000;
    basis = "minimum_estimate";
  }

  const grossProfit = Math.round(value * (marginPct / 100));
  const winProb = 0.30; // placeholder — caller passes actual
  const weightedRevenue = Math.round(value * winProb);
  const weightedProfit = Math.round(grossProfit * winProb);

  return {
    estimatedValue: value,
    estimatedGrossProfit: grossProfit,
    estimatedMarginPct: marginPct,
    weightedRevenue,
    weightedProfit,
    basis,
  };
}

// ─── Next Action Recommendations ──────────────────────────────────────────────

export function getNextAction(signals: Partial<DealSignals>, winProb: number): {
  action: string;
  timing: string;
} {
  const stage = signals.pipelineStage ?? "Lead Detected";
  const isEnterprise = (signals.staffCount ?? 0) >= 75 || (signals.officeSizeSqm ?? 0) >= 800;
  const isHighBudget = parseBudgetBand(signals.budgetBand).min >= 120000;

  // Quote accepted → fulfillment
  if (signals.isQuoteAccepted) {
    return { action: "Confirm order details and initiate supplier procurement", timing: "Within 24 hours" };
  }

  // Quote sent → follow up
  if (signals.isQuoteSent && !signals.isQuoteAccepted) {
    return { action: "Follow up on sent quote — confirm receipt and answer questions", timing: "Within 2 business days" };
  }

  // Negotiation stage
  if (stage === "Negotiation") {
    return {
      action: isEnterprise ? "Schedule director-level strategy call to close" : "Send value-comparison summary and close offer",
      timing: "Today"
    };
  }

  // Quoted but not sent
  if (signals.hasQuote && !signals.isQuoteSent) {
    return { action: "Send formal quote to client immediately", timing: "Today" };
  }

  // Planning request complete, no quote yet
  if (signals.hasPlanningRequest && !signals.hasQuote) {
    if (signals.isPlanningRequestPaid) {
      return { action: "Generate formal quote from paid workspace plan", timing: "Within 24 hours" };
    }
    return { action: "Generate formal quote from planning request data", timing: "Within 2 business days" };
  }

  // Finance interest flagged
  if (signals.financeInterest) {
    return { action: "Offer finance discussion — present monthly payment options", timing: "Within 24 hours" };
  }

  // High radar score, contacted stage
  if ((signals.radarScore ?? 0) >= 60 && stage === "Contacted") {
    return {
      action: isEnterprise ? "Send premium workspace concept with executive package options" : "Send workspace concept and offer free office layout plan",
      timing: "Within 24 hours"
    };
  }

  // Lead detected / early stage
  if (stage === "Lead Detected" || stage === "New") {
    if (isEnterprise || isHighBudget) {
      return { action: "Schedule strategy call — high-value enterprise opportunity", timing: "Within 4 hours" };
    }
    if ((signals.radarScore ?? 0) >= 40) {
      return { action: "Send workspace concept with supplier-backed package options", timing: "Within 24 hours" };
    }
    return { action: "Send initial outreach with free office layout plan offer", timing: "Within 48 hours" };
  }

  // Contacted stage
  if (stage === "Contacted") {
    return { action: "Send workspace concept and book discovery call", timing: "Within 24 hours" };
  }

  // Planning stage
  if (stage === "Planning") {
    return { action: "Present AI workspace plan and generate formal quote", timing: "Within 2 business days" };
  }

  // Low win probability — nurture
  if (winProb < 30) {
    return { action: "Move to nurture sequence — check back in 30 days", timing: "Within 1 week" };
  }

  // Deprioritise very low signals
  if (winProb < 15) {
    return { action: "Deprioritise — add to newsletter sequence", timing: "30 days" };
  }

  return { action: "Follow up and qualify project timeline", timing: "Within 2 business days" };
}

// ─── Offer Strategy ───────────────────────────────────────────────────────────

export function getOfferStrategy(signals: Partial<DealSignals>, winProb: number): string {
  const budget = parseBudgetBand(signals.budgetBand);
  const isEnterprise = (signals.staffCount ?? 0) >= 75 || (signals.officeSizeSqm ?? 0) >= 800 || budget.min >= 400000;
  const isHighBudget = budget.min >= 120000;
  const isMediumBudget = budget.min >= 50000;
  const isComplex = (signals.workspaceComplexity ?? 0) >= 4;
  const hasFinance = signals.financeInterest;

  if (signals.isQuoteAccepted) return "Project confirmed — focus on fulfilment and delivery experience";
  if (signals.isQuoteSent) return "Quote comparison — highlight value, supplier quality, and delivery certainty";

  if (isEnterprise) {
    return hasFinance
      ? "Executive premium workspace package with finance-backed payment plan"
      : "Executive premium workspace package — full fitout with 3D walkthrough and dedicated account management";
  }

  if (isHighBudget && isComplex) {
    return "Premium multi-zone workspace concept — full AI design, supplier-backed package, and formal quote";
  }

  if (isHighBudget) {
    return hasFinance
      ? "Premium workspace package with finance option — spread cost over 24–48 months"
      : "Premium workspace concept with full design and supplier-backed package";
  }

  if (isMediumBudget) {
    return signals.hasPlanningRequest
      ? "Formal quote from workspace plan — balanced package with quality suppliers"
      : "Free office layout plan to demonstrate value, then quote balanced package";
  }

  if (hasFinance) {
    return "Value-engineered package with accessible finance — low monthly commitment";
  }

  if (winProb >= 50) {
    return "Offer free office layout plan to build trust, then convert to quote";
  }

  return "Value-engineered package — quality fit-out within budget constraints";
}

// ─── Reasoning Summary ────────────────────────────────────────────────────────

export function buildReasoningSummary(
  signals: Partial<DealSignals>,
  winProb: number,
  breakdown: Record<string, number>
): string {
  const parts: string[] = [];
  const stage = signals.pipelineStage ?? "Lead Detected";
  const isEnterprise = (signals.staffCount ?? 0) >= 75 || (signals.officeSizeSqm ?? 0) >= 800;

  if (isEnterprise) parts.push("Enterprise-scale opportunity");
  if (stage === "Negotiation") parts.push("Deal in active negotiation — high close probability");
  if (stage === "Quoted") parts.push("Quote generated — awaiting client response");
  if (signals.isQuoteAccepted) parts.push("Quote accepted — project confirmed");
  if (signals.hasPlanningRequest) parts.push("Planning request on file");
  if (signals.isPlanningRequestPaid) parts.push("paid workspace plan");
  if (signals.hasQuote) parts.push(signals.isQuoteSent ? "quote sent" : "quote drafted");
  if ((signals.radarScore ?? 0) >= 60) parts.push("strong Office Move Radar signal");
  if (signals.financeInterest) parts.push("finance interest noted");
  if ((breakdown.industryFit ?? 0) >= 8) parts.push("high-fit industry");
  if ((breakdown.urgency ?? 0) >= 5) parts.push("urgent timeline");
  if (signals.hasFollowUpActive) parts.push("follow-up sequence active");

  const tier = getProbabilityTier(winProb);
  const tierLabel = tier === "high" ? "HIGH" : tier === "medium" ? "MEDIUM" : "LOW";

  const intro = `${tierLabel} PROBABILITY (${winProb}%) — `;
  return intro + (parts.length > 0 ? parts.join(", ") + "." : "Early-stage lead with limited signals.");
}

// ─── Deal Strength Score ──────────────────────────────────────────────────────
// 0–100, based on data completeness and commercial quality

export function computeDealStrength(signals: Partial<DealSignals>): number {
  let pts = 0;
  if ((signals.staffCount ?? 0) > 0) pts += 15;
  if ((signals.officeSizeSqm ?? 0) > 0) pts += 15;
  if (signals.budgetBand && signals.budgetBand !== "unknown") pts += 15;
  if (signals.hasPlanningRequest) pts += 15;
  if (signals.hasQuote) pts += 15;
  if ((signals.radarScore ?? 0) > 0) pts += 10;
  if (signals.industryFit) pts += 5;
  if (signals.pipelineStage && !["Lead Detected", "New"].includes(signals.pipelineStage)) pts += 10;
  return Math.min(100, pts);
}

// ─── Full Analysis ────────────────────────────────────────────────────────────

export function analyseDeal(signals: Partial<DealSignals>, exactQuoteTotal?: number): DealIntelligenceResult {
  const { score, breakdown } = computeWinProbability(signals);
  const probabilityTier = getProbabilityTier(score);
  const confidence = getConfidenceLevel(signals);
  const dealStrength = computeDealStrength(signals);
  const valueResult = estimateProjectValue(signals, exactQuoteTotal);
  const { action, timing } = getNextAction(signals, score);
  const offer = getOfferStrategy(signals, score);
  const reasoning = buildReasoningSummary(signals, score, breakdown);

  const actualWinRate = score / 100;
  const weightedRevenue = Math.round(valueResult.estimatedValue * actualWinRate);
  const weightedProfit = Math.round(valueResult.estimatedGrossProfit * actualWinRate);

  return {
    winProbability: score,
    probabilityTier,
    confidenceLevel: confidence,
    dealStrength,
    estimatedProjectValue: valueResult.estimatedValue,
    estimatedGrossProfit: valueResult.estimatedGrossProfit,
    estimatedMarginPct: valueResult.estimatedMarginPct,
    weightedExpectedRevenue: weightedRevenue,
    weightedExpectedProfit: weightedProfit,
    recommendedNextAction: action,
    recommendedFollowUpTiming: timing,
    recommendedOffer: offer,
    reasoningSummary: reasoning,
    scoringSignals: breakdown,
  };
}

// ─── Prospect → Signals ────────────────────────────────────────────────────────

export function prospectsToSignals(prospect: any): Partial<DealSignals> {
  const daysSinceCreated = prospect.createdAt
    ? Math.floor((Date.now() - new Date(prospect.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const zones: string[] = [];
  return {
    pipelineStage: prospect.status ?? "Lead Detected",
    radarScore: 0,
    radarConfidence: "low",
    staffCount: parseStaff(prospect.estimatedHeadcount ?? prospect.estimatedTeamSize),
    officeSizeSqm: parseSqm(prospect.estimatedOfficeSqm),
    budgetBand: prospect.estimatedProjectValue ?? "",
    hasPlanningRequest: false,
    isPlanningRequestPaid: false,
    hasQuote: false,
    isQuoteSent: false,
    isQuoteAccepted: false,
    financeInterest: false,
    industryFit: prospect.industry ?? "",
    urgencyLevel: "",
    workspaceComplexity: 1,
    historicalConversionRate: 0,
    marginQuality: 28,
    leadSource: prospect.sourceType ?? "manual",
    hasFollowUpActive: false,
    daysSinceCreated,
  };
}

export function planningRequestToSignals(pr: any, hasQuote: boolean, quoteStatus?: string): Partial<DealSignals> {
  const daysSinceCreated = pr.createdAt
    ? Math.floor((Date.now() - new Date(pr.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const zonesComplexity = [pr.receptionRequired, pr.breakoutRequired, pr.executiveOfficeRequired, pr.meetingRooms]
    .filter(Boolean).length;

  return {
    pipelineStage: pr.status === "New" ? "Planning" : pr.status ?? "Planning",
    radarScore: 0,
    radarConfidence: "low",
    staffCount: parseStaff(pr.staffCount),
    officeSizeSqm: parseSqm(pr.squareMetres),
    budgetBand: pr.budgetRange ?? "",
    hasPlanningRequest: true,
    isPlanningRequestPaid: pr.isPaid === true,
    hasQuote,
    isQuoteSent: quoteStatus === "Sent" || quoteStatus === "Accepted",
    isQuoteAccepted: quoteStatus === "Accepted",
    financeInterest: false,
    industryFit: "",
    urgencyLevel: pr.implementationTimeline ?? "",
    workspaceComplexity: zonesComplexity,
    historicalConversionRate: 0.35,
    marginQuality: 30,
    leadSource: pr.source ?? "upload-floor-plan",
    hasFollowUpActive: false,
    daysSinceCreated,
  };
}

export function radarToSignals(radar: any): Partial<DealSignals> {
  const daysSinceCreated = radar.dateDetected
    ? Math.floor((Date.now() - new Date(radar.dateDetected).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  return {
    pipelineStage: radar.status === "New" ? "Lead Detected" : radar.status ?? "Lead Detected",
    radarScore: radar.radarScore ?? 0,
    radarConfidence: radar.confidenceLevel ?? "low",
    staffCount: parseStaff(radar.estimatedHeadcount),
    officeSizeSqm: parseSqm(radar.estimatedOfficeSizeSqm),
    budgetBand: radar.estimatedProjectValue ?? "",
    hasPlanningRequest: false,
    isPlanningRequestPaid: false,
    hasQuote: false,
    isQuoteSent: false,
    isQuoteAccepted: false,
    financeInterest: false,
    industryFit: radar.industry ?? "",
    urgencyLevel: radar.signalType ?? "",
    workspaceComplexity: 1,
    historicalConversionRate: 0,
    marginQuality: 28,
    leadSource: "radar",
    hasFollowUpActive: false,
    daysSinceCreated,
  };
}

export function leadToSignals(lead: any): Partial<DealSignals> {
  const daysSinceCreated = lead.createdAt
    ? Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  return {
    pipelineStage: "Lead Detected",
    radarScore: 0,
    radarConfidence: "low",
    staffCount: parseStaff(lead.staffCount),
    officeSizeSqm: parseSqm(lead.officeSize),
    budgetBand: lead.budget ?? "",
    hasPlanningRequest: false,
    isPlanningRequestPaid: false,
    hasQuote: false,
    isQuoteSent: false,
    isQuoteAccepted: false,
    financeInterest: false,
    industryFit: "",
    urgencyLevel: lead.timeline ?? "",
    workspaceComplexity: 1,
    historicalConversionRate: 0,
    marginQuality: 28,
    leadSource: lead.type ?? "contact",
    hasFollowUpActive: false,
    daysSinceCreated,
  };
}

// ─── Batch Analysis — persists all results ────────────────────────────────────

export async function analyseAllDeals(): Promise<{ processed: number; records: any[] }> {
  const [prospects, planningReqs, radarRecords, inboundLeads, quotes, profitRecs] = await Promise.all([
    storage.getProspectedLeads(),
    storage.getPlanningRequests(),
    storage.getOfficeMovRadarRecords(),
    storage.getLeads(),
    storage.getQuotes(),
    storage.getProfitRecords(200),
  ]);

  // Build look-up: planning request → quote
  const quotesByPR = new Map<string, { quote: any; quoteStatus: string }>();
  for (const q of quotes) {
    if (q.planningRequestId) {
      quotesByPR.set(q.planningRequestId, { quote: q, quoteStatus: q.status ?? "Draft" });
    }
  }

  // Average margin from profit records
  const avgMargin = profitRecs.length > 0
    ? Math.round(profitRecs.reduce((s, r) => s + (r.estimatedMarginPercent ?? 28), 0) / profitRecs.length)
    : 28;

  const results: any[] = [];

  // 1. Analyse prospected leads (pipeline)
  for (const p of prospects) {
    if (p.status === "Lost") continue;
    const signals = prospectsToSignals(p);
    signals.marginQuality = avgMargin;
    const result = analyseDeal(signals);

    const record: InsertDealIntelligence = {
      sourceType: "prospect",
      relatedProspectId: p.id,
      companyName: p.company,
      city: p.city ?? p.location,
      industry: p.industry,
      officeSizeSqm: parseInt(p.estimatedOfficeSqm) || null,
      staffCount: parseInt(p.estimatedHeadcount ?? p.estimatedTeamSize) || null,
      budgetBand: p.estimatedProjectValue ?? "",
      pipelineStage: p.status,
      estimatedProjectValue: result.estimatedProjectValue,
      estimatedGrossProfit: result.estimatedGrossProfit,
      estimatedMarginPct: result.estimatedMarginPct,
      winProbability: result.winProbability,
      probabilityTier: result.probabilityTier,
      confidenceLevel: result.confidenceLevel,
      dealStrength: result.dealStrength,
      weightedExpectedRevenue: result.weightedExpectedRevenue,
      weightedExpectedProfit: result.weightedExpectedProfit,
      recommendedNextAction: result.recommendedNextAction,
      recommendedFollowUpTiming: result.recommendedFollowUpTiming,
      recommendedOffer: result.recommendedOffer,
      reasoningSummary: result.reasoningSummary,
      scoringSignalsJson: JSON.stringify(result.scoringSignals),
      quoteStatus: null,
      financeInterest: false,
      hasRadarSignal: false,
      hasPlanningRequest: false,
      hasQuote: false,
      outcomeResult: "pending",
    };

    const saved = await storage.upsertDealIntelligence(record);
    results.push(saved);
  }

  // 2. Analyse planning requests
  for (const pr of planningReqs) {
    const qData = pr.id ? quotesByPR.get(pr.id) : undefined;
    const signals = planningRequestToSignals(pr, !!qData, qData?.quoteStatus);
    signals.marginQuality = avgMargin;
    const exactQuote = qData?.quote?.totalIncGst ?? qData?.quote?.total;
    const result = analyseDeal(signals, exactQuote);

    const record: InsertDealIntelligence = {
      sourceType: "planning_request",
      relatedPlanningRequestId: pr.id,
      relatedQuoteId: qData?.quote?.id ?? null,
      companyName: pr.company || pr.name,
      city: pr.city ?? "",
      industry: "",
      officeSizeSqm: parseInt(pr.squareMetres) || null,
      staffCount: parseInt(pr.staffCount) || null,
      budgetBand: pr.budgetRange ?? "",
      pipelineStage: signals.pipelineStage ?? "Planning",
      estimatedProjectValue: result.estimatedProjectValue,
      estimatedGrossProfit: result.estimatedGrossProfit,
      estimatedMarginPct: result.estimatedMarginPct,
      winProbability: result.winProbability,
      probabilityTier: result.probabilityTier,
      confidenceLevel: result.confidenceLevel,
      dealStrength: result.dealStrength,
      weightedExpectedRevenue: result.weightedExpectedRevenue,
      weightedExpectedProfit: result.weightedExpectedProfit,
      recommendedNextAction: result.recommendedNextAction,
      recommendedFollowUpTiming: result.recommendedFollowUpTiming,
      recommendedOffer: result.recommendedOffer,
      reasoningSummary: result.reasoningSummary,
      scoringSignalsJson: JSON.stringify(result.scoringSignals),
      quoteStatus: qData?.quoteStatus ?? null,
      financeInterest: false,
      hasRadarSignal: false,
      hasPlanningRequest: true,
      hasQuote: !!qData,
      outcomeResult: "pending",
    };

    const saved = await storage.upsertDealIntelligence(record);
    results.push(saved);
  }

  // 3. Analyse radar signals (active only)
  for (const radar of radarRecords) {
    if (radar.status === "Converted" || radar.status === "Dismissed") continue;
    const signals = radarToSignals(radar);
    signals.marginQuality = avgMargin;
    const result = analyseDeal(signals);

    const record: InsertDealIntelligence = {
      sourceType: "radar",
      relatedRadarId: radar.id,
      companyName: radar.companyName,
      city: radar.city,
      industry: radar.industry ?? "",
      officeSizeSqm: parseInt(radar.estimatedOfficeSizeSqm) || null,
      staffCount: parseInt(radar.estimatedHeadcount) || null,
      budgetBand: radar.estimatedProjectValue ?? "",
      pipelineStage: "Lead Detected",
      estimatedProjectValue: result.estimatedProjectValue,
      estimatedGrossProfit: result.estimatedGrossProfit,
      estimatedMarginPct: result.estimatedMarginPct,
      winProbability: result.winProbability,
      probabilityTier: result.probabilityTier,
      confidenceLevel: result.confidenceLevel,
      dealStrength: result.dealStrength,
      weightedExpectedRevenue: result.weightedExpectedRevenue,
      weightedExpectedProfit: result.weightedExpectedProfit,
      recommendedNextAction: result.recommendedNextAction,
      recommendedFollowUpTiming: result.recommendedFollowUpTiming,
      recommendedOffer: result.recommendedOffer,
      reasoningSummary: result.reasoningSummary,
      scoringSignalsJson: JSON.stringify(result.scoringSignals),
      quoteStatus: null,
      financeInterest: false,
      hasRadarSignal: true,
      hasPlanningRequest: false,
      hasQuote: false,
      outcomeResult: "pending",
    };

    const saved = await storage.upsertDealIntelligence(record);
    results.push(saved);
  }

  // 4. Analyse inbound leads (top 50 most recent)
  const recentLeads = inboundLeads.slice(0, 50);
  for (const lead of recentLeads) {
    const signals = leadToSignals(lead);
    signals.marginQuality = avgMargin;
    const result = analyseDeal(signals);

    const record: InsertDealIntelligence = {
      sourceType: "lead",
      relatedLeadId: lead.id,
      companyName: lead.company,
      city: lead.officeLocation ?? "",
      industry: "",
      officeSizeSqm: parseInt(lead.officeSize) || null,
      staffCount: parseInt(lead.staffCount) || null,
      budgetBand: lead.budget ?? "",
      pipelineStage: "Lead Detected",
      estimatedProjectValue: result.estimatedProjectValue,
      estimatedGrossProfit: result.estimatedGrossProfit,
      estimatedMarginPct: result.estimatedMarginPct,
      winProbability: result.winProbability,
      probabilityTier: result.probabilityTier,
      confidenceLevel: result.confidenceLevel,
      dealStrength: result.dealStrength,
      weightedExpectedRevenue: result.weightedExpectedRevenue,
      weightedExpectedProfit: result.weightedExpectedProfit,
      recommendedNextAction: result.recommendedNextAction,
      recommendedFollowUpTiming: result.recommendedFollowUpTiming,
      recommendedOffer: result.recommendedOffer,
      reasoningSummary: result.reasoningSummary,
      scoringSignalsJson: JSON.stringify(result.scoringSignals),
      quoteStatus: null,
      financeInterest: false,
      hasRadarSignal: false,
      hasPlanningRequest: false,
      hasQuote: false,
      outcomeResult: "pending",
    };

    const saved = await storage.upsertDealIntelligence(record);
    results.push(saved);
  }

  // 5. Analyse standalone quotes (no planning request link)
  const processedPrIds = new Set(planningReqs.map(pr => pr.id));
  const standaloneQuotes = quotes.filter(q => !q.planningRequestId || !processedPrIds.has(q.planningRequestId));
  for (const q of standaloneQuotes) {
    if (q.status === "Declined") continue;
    const signals: Partial<DealSignals> = {
      pipelineStage: q.status === "Accepted" ? "Quoted" : q.status === "Sent" ? "Quoted" : "Proposal",
      hasQuote: true,
      isQuoteSent: q.status === "Sent" || q.status === "Accepted",
      isQuoteAccepted: q.status === "Accepted",
      financeInterest: !!(q.financeMonthlyEstimate && Number(q.financeMonthlyEstimate) > 0),
      hasPlanningRequest: false,
      hasRadarSignal: false,
      marginQuality: avgMargin,
    };
    const exactTotal = q.totalIncGst ?? q.total ?? undefined;
    const result = analyseDeal(signals, exactTotal ? Number(exactTotal) : undefined);

    const record: InsertDealIntelligence = {
      sourceType: "quote",
      relatedQuoteId: q.id,
      relatedPlanningRequestId: q.planningRequestId ?? null,
      companyName: q.companyName || q.clientName || "Unknown",
      city: "",
      industry: "",
      officeSizeSqm: null,
      staffCount: null,
      budgetBand: exactTotal ? `$${Number(exactTotal).toLocaleString()}` : "",
      pipelineStage: signals.pipelineStage ?? "Quoted",
      estimatedProjectValue: result.estimatedProjectValue,
      estimatedGrossProfit: result.estimatedGrossProfit,
      estimatedMarginPct: result.estimatedMarginPct,
      winProbability: result.winProbability,
      probabilityTier: result.probabilityTier,
      confidenceLevel: result.confidenceLevel,
      dealStrength: result.dealStrength,
      weightedExpectedRevenue: result.weightedExpectedRevenue,
      weightedExpectedProfit: result.weightedExpectedProfit,
      recommendedNextAction: result.recommendedNextAction,
      recommendedFollowUpTiming: result.recommendedFollowUpTiming,
      recommendedOffer: result.recommendedOffer,
      reasoningSummary: result.reasoningSummary,
      scoringSignalsJson: JSON.stringify(result.scoringSignals),
      quoteStatus: q.status ?? null,
      financeInterest: signals.financeInterest ?? false,
      hasRadarSignal: false,
      hasPlanningRequest: false,
      hasQuote: true,
      outcomeResult: q.status === "Accepted" ? "won" : "pending",
    };

    const saved = await storage.upsertDealIntelligence(record);
    results.push(saved);
  }

  return { processed: results.length, records: results };
}
