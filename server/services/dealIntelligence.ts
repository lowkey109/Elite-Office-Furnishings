import { storage } from "../storage";
import type { InsertDealIntelligence } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DealSignals {
  pipelineStage: string;
  radarScore: number;
  radarConfidence: string;
  staffCount: number;
  officeSize: number;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeStr(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function parseSqm(v: any): number {
  if (!v) return 0;
  const match = String(v).match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function parseStaff(v: any): number {
  if (!v) return 0;
  const match = String(v).match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// ─── Budget parsing ──────────────────────────────────────────────────────────

function parseBudgetBand(budget: any) {
  const b = safeStr(budget).toLowerCase();
  if (!b) return { min: 0, max: 0 };

  if (b.includes("400") || b.includes("1m")) return { min: 400000, max: 800000 };
  if (b.includes("300")) return { min: 300000, max: 400000 };
  if (b.includes("200")) return { min: 200000, max: 300000 };
  if (b.includes("120")) return { min: 120000, max: 200000 };
  if (b.includes("80")) return { min: 80000, max: 120000 };
  if (b.includes("50")) return { min: 50000, max: 80000 };
  if (b.includes("30")) return { min: 30000, max: 50000 };

  const match = b.match(/\$([\d,]+)/);
  if (match) {
    const val = parseInt(match[1].replace(/,/g, ""));
    return { min: val, max: val * 1.2 };
  }

  return { min: 0, max: 0 };
}

// ─── Win Probability ─────────────────────────────────────────────────────────

export function computeWinProbability(signals: Partial<DealSignals>) {
  let score = 0;

  score += (signals.staffCount ?? 0) > 20 ? 15 : 5;
  score += (signals.officeSize ?? 0) > 200 ? 10 : 3;
  score += parseBudgetBand(signals.budgetBand).min > 100000 ? 20 : 5;
  score += signals.hasPlanningRequest ? 15 : 0;
  score += signals.hasQuote ? 10 : 0;
  score += signals.isQuoteAccepted ? 20 : 0;

  return Math.min(100, score);
}

// ─── Core Analysis ───────────────────────────────────────────────────────────

export function analyseDeal(signals: Partial<DealSignals>) {
  const winProbability = computeWinProbability(signals);

  const budget = parseBudgetBand(signals.budgetBand);
  const estimatedValue =
    budget.min ||
    (signals.officeSize ?? 0) * 1800 ||
    (signals.staffCount ?? 0) * 4500 ||
    45000;

  const margin = signals.marginQuality ?? 28;
  const grossProfit = Math.round(estimatedValue * (margin / 100));

  return {
    winProbability,
    estimatedProjectValue: estimatedValue,
    estimatedGrossProfit: grossProfit,
    estimatedMarginPct: margin,
  };
}

// ─── Mapping Functions ───────────────────────────────────────────────────────

export function prospectsToSignals(p: any): Partial<DealSignals> {
  return {
    pipelineStage: safeStr(p.status || "Lead Detected"),
    staffCount: parseStaff(p.estimatedHeadcount),
    officeSize: parseSqm(p.estimatedOfficeSqm),
    budgetBand: safeStr(p.estimatedProjectValue),
    industryFit: safeStr(p.industry),
    urgencyLevel: "",
    radarScore: 0,
    radarConfidence: "low",
    hasPlanningRequest: false,
    isPlanningRequestPaid: false,
    hasQuote: false,
    isQuoteSent: false,
    isQuoteAccepted: false,
    financeInterest: false,
    workspaceComplexity: 1,
    historicalConversionRate: 0,
    marginQuality: 28,
    leadSource: safeStr(p.sourceType),
    hasFollowUpActive: false,
    daysSinceCreated: 0,
  };
}

// ─── Batch Runner ────────────────────────────────────────────────────────────

export async function analyseAllDeals() {
  const prospects = await storage.getProspectedLeads();

  const results: any[] = [];

  for (const p of prospects) {
    const signals = prospectsToSignals(p);
    const result = analyseDeal(signals);

    const record: InsertDealIntelligence = {
      sourceType: "prospect",
      relatedProspectId: p.id,
      companyName: safeStr(p.company),
      city: safeStr(p.city),
      industry: safeStr(p.industry),
      officeSize: signals.officeSize ?? 0,
      staffCount: signals.staffCount ?? 0,
      budgetBand: safeStr(signals.budgetBand),
      pipelineStage: safeStr(signals.pipelineStage),
      estimatedProjectValue: result.estimatedProjectValue,
      estimatedGrossProfit: result.estimatedGrossProfit,
      estimatedMarginPct: result.estimatedMarginPct,
      winProbability: result.winProbability,
      probabilityTier: "medium",
      confidenceLevel: "medium",
      dealStrength: result.winProbability,
      weightedExpectedRevenue: result.estimatedProjectValue,
      weightedExpectedProfit: result.estimatedGrossProfit,
      recommendedNextAction: "Follow up",
      recommendedFollowUpTiming: "2 days",
      recommendedOffer: "Standard proposal",
      reasoningSummary: "Auto-generated",
      scoringSignalsJson: "{}",
      quoteStatus: null,
      financeInterest: false,
      hasPlanningRequest: false,
      hasQuote: false,
      outcomeResult: "pending",
    };

    const saved = await storage.upsertDealIntelligence(record);
    results.push(saved);
  }

  return { processed: results.length, records: results };
}
