/**
 * Opportunity Scoring Engine — v2
 *
 * Deterministic signal model — NO AI calls.
 * Updated to correctly value mid-sized office projects:
 *   - 20–50 staff = medium opportunity baseline
 *   - 200–500 sqm = medium opportunity baseline
 *   - $120k+ projects never default to LOW tier
 *
 * Returns: signals[], opportunityScore (0–100), opportunityTier, nextAction
 */

export interface OppSignal {
  type: string;
  confidence: number;
  source: "planner" | "lead_form" | "message_text";
  reason: string;
}

export interface OpportunityResult {
  signals: OppSignal[];
  opportunityScore: number;
  opportunityTier: "enterprise" | "high" | "medium" | "low";
  nextAction: string;
  estimatedValueRange: string;
}

// ─── Text search helpers ──────────────────────────────────────────────────────

function hasKeyword(text: string | null | undefined, ...terms: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return terms.some(t => lower.includes(t.toLowerCase()));
}

// ─── Budget → numeric midpoint ────────────────────────────────────────────────

function budgetMidpoint(budget: string | null | undefined): number {
  if (!budget) return 0;
  if (budget.includes("300,000") || budget.startsWith("$300") || budget === "$300,000+") return 420000;
  if (budget.includes("180,000")) return 240000;
  if (budget.includes("100,000")) return 140000;
  if (budget.includes("60,000")) return 80000;
  if (budget.includes("30,000")) return 40000;
  const nums = (budget.match(/[\d,]+/g) || []).map(s => parseInt(s.replace(/,/g, ""), 10)).filter(n => n > 100);
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}

// ─── Style rate map ───────────────────────────────────────────────────────────

const STYLE_RATES: Record<string, number> = {
  "Luxury Executive": 1500,
  "Corporate Prestige": 1200,
  "Modern Open Plan": 950,
  "Warm Timber / Premium": 1100,
  "Minimal": 800,
  "Mixed / Flexible": 900,
};

// ─── Estimate value range string ──────────────────────────────────────────────

function estimateValue(data: Partial<ScoringInput>): string {
  const budget = budgetMidpoint(data.budget || data.budgetRange);
  if (budget >= 400000) return "$400,000+";
  if (budget >= 120000) return `$${Math.round(budget / 1000)}K – $${Math.round(budget * 1.25 / 1000)}K`;
  if (budget >= 50000) return `$${Math.round(budget / 1000)}K – $${Math.round(budget * 1.3 / 1000)}K`;

  const sqm = parseFloat(data.squareMetres || data.officeSize || "0");
  const rate = STYLE_RATES[data.stylePreference || ""] || 900;
  if (sqm >= 30) {
    const lo = Math.round(sqm * rate * 0.8);
    const hi = Math.round(sqm * rate * 1.2);
    return `$${Math.round(lo / 1000)}K – $${Math.round(hi / 1000)}K`;
  }

  const staff = parseInt(data.staffCount || "0", 10);
  if (staff >= 75)  return "$250,000 – $600,000";
  if (staff >= 50)  return "$150,000 – $350,000";
  if (staff >= 25)  return "$90,000 – $220,000";
  if (staff >= 15)  return "$55,000 – $130,000";
  if (staff >= 10)  return "$35,000 – $80,000";
  if (staff >= 5)   return "$20,000 – $50,000";
  return "";
}

// ─── Scoring input types ──────────────────────────────────────────────────────

export interface ScoringInput {
  // Lead form fields
  type?: string | null;
  name?: string | null;
  company?: string | null;
  message?: string | null;
  officeSize?: string | null;
  staffCount?: string | null;
  budget?: string | null;
  timeline?: string | null;
  officeLocation?: string | null;
  moveDate?: string | null;

  // Planning request fields
  projectType?: string | null;
  squareMetres?: string | null;
  meetingRooms?: string | null;
  receptionRequired?: boolean | null;
  breakoutRequired?: boolean | null;
  executiveOfficeRequired?: boolean | null;
  budgetRange?: string | null;
  stylePreference?: string | null;
  specialRequirements?: string | null;
  aiSummary?: string | null;
  estimatedValue?: string | null;
  leadScore?: number | null;
}

// ─── Main scoring function ────────────────────────────────────────────────────

export function scoreOpportunity(data: ScoringInput): OpportunityResult {
  const signals: OppSignal[] = [];
  let score = 0;

  // ── 1. Project type expansion signals (up to 20 pts) ──────────────────────
  const pt = (data.projectType || data.type || "").toLowerCase();
  const msgAndReqs = [data.message, data.specialRequirements, data.aiSummary].filter(Boolean).join(" ");

  if (hasKeyword(pt, "reloc", "relocation") || hasKeyword(msgAndReqs, "relocat", "moving office", "new location")) {
    signals.push({ type: "office_relocation", confidence: 0.9, source: "planner", reason: "Relocation project type or language detected" });
    score += 20;
  } else if (hasKeyword(pt, "new office", "new hq", "headquarters") || hasKeyword(msgAndReqs, "new office", "new headquarters", "new hq")) {
    signals.push({ type: "new_office", confidence: 0.85, source: "planner", reason: "New office / headquarters language detected" });
    score += 18;
  } else if (hasKeyword(pt, "expan") || hasKeyword(msgAndReqs, "expan", "growing", "scaling", "scale up")) {
    signals.push({ type: "company_expansion", confidence: 0.80, source: "planner", reason: "Expansion or growth language detected" });
    score += 15;
  }

  // ── 2. Fit-out language (up to 10 pts) ────────────────────────────────────
  if (hasKeyword(msgAndReqs, "fit-out", "fitout", "fit out", "tenancy", "refurb", "workspace design")) {
    signals.push({ type: "fitout_language", confidence: 0.85, source: "message_text", reason: "Fit-out / tenancy language in enquiry" });
    score += 10;
  }

  // ── 3. Staff count / team size (up to 28 pts) ────────────────────────────
  // Updated tiers: 1-10 low | 10-25 medium | 25-75 medium-high | 75+ high
  const staffNum = parseInt(data.staffCount || "0", 10);
  if (staffNum >= 75) {
    signals.push({ type: "large_team", confidence: 0.95, source: "planner", reason: `${staffNum} staff — enterprise-scale project` });
    score += 28;
  } else if (staffNum >= 25) {
    signals.push({ type: "mid_large_team", confidence: 0.90, source: "planner", reason: `${staffNum} staff — medium-high commercial opportunity` });
    score += 21;
  } else if (staffNum >= 10) {
    signals.push({ type: "mid_team", confidence: 0.80, source: "planner", reason: `${staffNum} staff — medium opportunity` });
    score += 14;
  } else if (staffNum >= 5) {
    signals.push({ type: "small_team", confidence: 0.65, source: "planner", reason: `${staffNum} staff — small business fit-out` });
    score += 7;
  } else if (staffNum >= 2) {
    score += 3;
  }

  // ── 4. Office size / sqm (up to 18 pts) ──────────────────────────────────
  // Updated tiers: <100 low | 100-300 medium | 300-800 medium-high | 800+ high
  const sqmNum = parseFloat(data.squareMetres || data.officeSize || "0");
  if (sqmNum >= 800) {
    signals.push({ type: "large_space", confidence: 0.92, source: "planner", reason: `${sqmNum}sqm — large-scale commercial fit-out` });
    score += 18;
  } else if (sqmNum >= 300) {
    signals.push({ type: "medium_large_space", confidence: 0.85, source: "planner", reason: `${sqmNum}sqm — medium-high commercial space` });
    score += 14;
  } else if (sqmNum >= 100) {
    signals.push({ type: "medium_space", confidence: 0.78, source: "planner", reason: `${sqmNum}sqm — medium commercial space` });
    score += 9;
  } else if (sqmNum >= 50) {
    score += 4;
  } else if (sqmNum >= 20) {
    score += 1;
  }

  // ── 5. Budget / estimated project value (up to 22 pts) ───────────────────
  // Updated tiers: <$50k low | $50k-$120k medium | $120k-$400k high | $400k+ enterprise
  const budgetVal = budgetMidpoint(data.budget || data.budgetRange);
  if (budgetVal >= 400000) {
    signals.push({ type: "enterprise_budget", confidence: 0.97, source: "planner", reason: `Budget $400K+ — enterprise commercial project` });
    score += 22;
  } else if (budgetVal >= 120000) {
    signals.push({ type: "high_budget", confidence: 0.92, source: "planner", reason: `Budget $120K–$400K — high-value commercial project` });
    score += 17;
  } else if (budgetVal >= 50000) {
    signals.push({ type: "mid_budget", confidence: 0.80, source: "planner", reason: `Budget $50K–$120K — solid mid-market project` });
    score += 10;
  } else if (budgetVal >= 25000) {
    score += 5;
  } else if ((data.budget || data.budgetRange) && !hasKeyword(data.budget || data.budgetRange, "not specified")) {
    score += 2;
  }

  // ── 6. Premium style signals (up to 8 pts) ───────────────────────────────
  if (hasKeyword(data.stylePreference, "Luxury Executive", "Corporate Prestige")) {
    signals.push({ type: "premium_brief", confidence: 0.80, source: "planner", reason: `${data.stylePreference} style preference — premium project` });
    score += 8;
  } else if (hasKeyword(data.stylePreference, "Warm Timber", "Modern Open Plan")) {
    score += 4;
  }

  // ── 7. Multiple zones required (up to 10 pts) ────────────────────────────
  let zones = 0;
  if (data.receptionRequired) zones++;
  if (data.breakoutRequired) zones++;
  if (data.executiveOfficeRequired) zones++;
  const meetingRoomsNum = parseInt(data.meetingRooms || "0", 10);
  if (meetingRoomsNum >= 3) {
    signals.push({ type: "multiple_meeting_rooms", confidence: 0.80, source: "planner", reason: `${meetingRoomsNum} meeting rooms — complex programme` });
    zones++;
  } else if (meetingRoomsNum >= 1) zones++;
  if (data.executiveOfficeRequired && data.receptionRequired) {
    signals.push({ type: "premium_fit_out", confidence: 0.85, source: "planner", reason: "Executive office + reception — full prestige fit-out" });
  }
  score += Math.min(zones * 2.5, 10);

  // ── 8. Active timeline / move date (up to 7 pts) ─────────────────────────
  if (data.moveDate || hasKeyword(data.timeline, "urgent", "asap", "immediately", "this month", "next month")) {
    signals.push({ type: "urgent_timeline", confidence: 0.85, source: "lead_form", reason: "Urgent timeline or move date specified" });
    score += 7;
  } else if (hasKeyword(data.timeline, "3 month", "6 month", "quarter")) {
    signals.push({ type: "active_timeline", confidence: 0.75, source: "lead_form", reason: "Active near-term timeline stated" });
    score += 4;
  }

  // ── 9. High-intent lead type (up to 5 pts) ───────────────────────────────
  if (pt === "strategy-call") {
    signals.push({ type: "strategy_call_request", confidence: 0.90, source: "lead_form", reason: "Requested strategy consultation — strong buyer intent" });
    score += 5;
  } else if (pt === "quote-request" || pt === "quote-builder") {
    signals.push({ type: "active_procurement", confidence: 0.88, source: "lead_form", reason: "Quote request — active procurement in progress" });
    score += 5;
  } else if (pt === "layout-plan") {
    signals.push({ type: "layout_planning", confidence: 0.82, source: "lead_form", reason: "Layout plan request — planning stage decision-maker" });
    score += 4;
  }

  // ── 10. Hiring / facilities signals in message (up to 8 pts) ─────────────
  if (hasKeyword(msgAndReqs, "hiring", "office manager", "facilities manager", "growing team", "new hires", "onboarding")) {
    signals.push({ type: "hiring_activity", confidence: 0.78, source: "message_text", reason: "Hiring or facilities language in enquiry text" });
    score += 8;
  }

  // ── 11. Funding / announcement signals (up to 6 pts) ─────────────────────
  if (hasKeyword(msgAndReqs, "funding", "series", "raised", "capital", "investment", "new CEO", "new MD", "merger", "acquisition")) {
    signals.push({ type: "funding_growth", confidence: 0.75, source: "message_text", reason: "Funding or corporate event language detected" });
    score += 6;
  }

  // ── Cap at 100 ────────────────────────────────────────────────────────────
  score = Math.min(100, Math.round(score));

  // If AI already scored it and it's higher, respect that
  if (data.leadScore != null && data.leadScore > score) {
    score = Math.min(100, data.leadScore);
  }

  // ── Tier assignment ───────────────────────────────────────────────────────
  // enterprise ≥ 68 | high ≥ 52 | medium ≥ 36 | low < 36
  // Enterprise = 100+ staff / 800+sqm / $400k+ or combined high signals
  // High = 25-75 staff / 300-800sqm / $120k-$400k range projects
  // Medium = 10-25 staff / 100-300sqm / $50k-$120k baseline
  const opportunityTier: "enterprise" | "high" | "medium" | "low" =
    score >= 68 ? "enterprise"
    : score >= 52 ? "high"
    : score >= 36 ? "medium"
    : "low";

  // ── Next action recommendation ────────────────────────────────────────────
  let nextAction = "";
  if (opportunityTier === "enterprise") {
    nextAction = "Escalate immediately — enterprise project. Director-level contact within 4 hours. Prepare tailored capability deck.";
  } else if (opportunityTier === "high") {
    if (signals.some(s => s.type === "strategy_call_request")) {
      nextAction = "Book strategy consultation within 24h — high-intent buyer confirmed";
    } else if (signals.some(s => s.type === "office_relocation" || s.type === "new_office")) {
      nextAction = "Call contact directly — active relocation requires immediate commercial proposal";
    } else {
      nextAction = "Priority follow-up: send personalised fit-out proposal within 24h";
    }
  } else if (opportunityTier === "medium") {
    nextAction = "Send personalised quote and schedule consultation within 3 business days";
  } else {
    nextAction = "Add to nurture sequence — send product catalogue and capability overview";
  }

  return {
    signals,
    opportunityScore: score,
    opportunityTier,
    nextAction,
    estimatedValueRange: estimateValue(data),
  };
}
