import OpenAI from "openai";
import { storage } from "../storage";
import type { OfficeMovRadar } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function assertSyntheticAllowed(featureName: string) {
  const allowSynthetic = process.env.ALLOW_SYNTHETIC_INTELLIGENCE === "true";
  if (!allowSynthetic) {
    throw new Error(
      `${featureName} is disabled because synthetic intelligence is not allowed in this environment.`
    );
  }
}

export type RadarSignalType =
  | "office_move"
  | "new_lease"
  | "office_expansion"
  | "refurbishment"
  | "hiring_surge"
  | "hiring_spike"
  | "funding_growth"
  | "funding"
  | "new_office_opening"
  | "startup_expansion"
  | "workplace_role"
  | "growth_news"
  | "territory_alert"
  | "tenant_move_in"
  | "tenant_move_out"
  | "lease_expiry"
  | "manual";

export type RadarPriority = "High" | "Medium" | "Low";
export type RadarConfidence = "high" | "medium" | "low";

const SIGNAL_BASE_SCORES: Record<RadarSignalType, number> = {
  office_move: 85,
  new_lease: 80,
  tenant_move_in: 78,
  office_expansion: 72,
  refurbishment: 70,
  new_office_opening: 75,
  startup_expansion: 72,
  lease_expiry: 65,
  hiring_surge: 55,
  hiring_spike: 58,
  funding_growth: 62,
  funding: 62,
  workplace_role: 52,
  growth_news: 48,
  territory_alert: 45,
  tenant_move_out: 40,
  manual: 30,
};

const CONFIDENCE_MODIFIERS: Record<RadarConfidence, number> = {
  high: 10,
  medium: 0,
  low: -10,
};

const CITY_FIT_SCORES: Record<string, number> = {
  brisbane: 10,
  sydney: 8,
  melbourne: 8,
  "gold coast": 5,
  perth: 4,
  adelaide: 3,
  canberra: 2,
  darwin: 1,
};

const HIGH_VALUE_INDUSTRIES = [
  "legal",
  "law",
  "finance",
  "banking",
  "financial services",
  "consulting",
  "technology",
  "tech",
  "mining",
  "resources",
  "engineering",
  "pharmaceutical",
  "private equity",
  "investment",
  "insurance",
  "accounting",
];

const MEDIUM_VALUE_INDUSTRIES = [
  "real estate",
  "healthcare",
  "government",
  "education",
  "retail",
  "construction",
  "logistics",
  "media",
  "marketing",
  "design",
];

const HEADCOUNT_RANGES: Array<{ label: string; min: number; max: number }> = [
  { label: "5–15", min: 5, max: 15 },
  { label: "15–30", min: 15, max: 30 },
  { label: "30–60", min: 30, max: 60 },
  { label: "60–120", min: 60, max: 120 },
  { label: "120–250", min: 120, max: 250 },
  { label: "250+", min: 250, max: 500 },
];

const SQM_PER_PERSON = 12;

const PROJECT_VALUE_BY_SQM: Array<{
  maxSqm: number;
  label: string;
}> = [
  { maxSqm: 150, label: "$15,000–$35,000" },
  { maxSqm: 400, label: "$35,000–$80,000" },
  { maxSqm: 700, label: "$80,000–$160,000" },
  { maxSqm: 1200, label: "$160,000–$320,000" },
  { maxSqm: 2500, label: "$320,000–$700,000" },
  { maxSqm: 99999, label: "$700,000+" },
];

function estimateSqm(headcountLabel: string): string {
  const range = HEADCOUNT_RANGES.find((r) => r.label === headcountLabel);
  if (!range) return "200–400 sqm";
  const mid = Math.round((range.min + range.max) / 2);
  const sqm = mid * SQM_PER_PERSON;
  return `${Math.round(sqm * 0.8).toLocaleString()}–${Math.round(
    sqm * 1.2
  ).toLocaleString()} sqm`;
}

function estimateProjectValue(sqmLabel: string): string {
  const numMatch = sqmLabel.match(/[\d,]+/g);
  if (!numMatch) return "$35,000–$160,000";
  const minSqm = parseInt(numMatch[0].replace(/,/g, ""), 10);
  const tier = PROJECT_VALUE_BY_SQM.find((t) => minSqm <= t.maxSqm);
  return tier?.label ?? "$700,000+";
}

export interface RadarScoringInput {
  signalType: RadarSignalType;
  confidence: RadarConfidence;
  city: string;
  industry?: string;
  estimatedHeadcount?: string;
  multipleSignals?: boolean;
  hasSourceUrl?: boolean;
}

export interface RadarScoringResult {
  radarScore: number;
  priority: RadarPriority;
  estimatedOfficeSizeSqm: string;
  estimatedProjectValue: string;
  recommendedOutreachAngle: string;
  recommendedOffer: string;
  recommendedNextAction: string;
  outreachUrgency: "Immediate" | "This week" | "This month";
}

export function scoreRadarSignal(input: RadarScoringInput): RadarScoringResult {
  let score = SIGNAL_BASE_SCORES[input.signalType] ?? 30;
  score += CONFIDENCE_MODIFIERS[input.confidence] ?? 0;

  const cityKey = (input.city ?? "").toLowerCase();
  const cityFit = Object.entries(CITY_FIT_SCORES).find(([k]) =>
    cityKey.includes(k)
  );
  score += cityFit ? cityFit[1] : 0;

  if (input.industry) {
    const ind = input.industry.toLowerCase();
    if (HIGH_VALUE_INDUSTRIES.some((k) => ind.includes(k))) score += 12;
    else if (MEDIUM_VALUE_INDUSTRIES.some((k) => ind.includes(k))) score += 5;
  }

  if (input.multipleSignals) score += 8;
  if (input.hasSourceUrl) score += 4;

  const headcount = normaliseHeadcount(input.estimatedHeadcount ?? "30–60");
  const sqmLabel = estimateSqm(headcount);
  const projectValueLabel = estimateProjectValue(sqmLabel);

  score = Math.max(0, Math.min(100, score));

  const priority: RadarPriority =
    score >= 75 ? "High" : score >= 50 ? "Medium" : "Low";

  const outreachUrgency =
    score >= 75 ? "Immediate" : score >= 50 ? "This week" : "This month";

  const outreachAngles: Record<RadarSignalType, string> = {
    office_move: "Lead with speed — they need furniture fast for the new space",
    new_lease:
      "New lease = blank canvas — offer a free layout plan for the new floor",
    tenant_move_in:
      "First impression matters — offer reception and entry fitout package",
    office_expansion:
      "Growing team? Lead with workspace planning for the expanded headcount",
    refurbishment: "Existing space, fresh look — lead with product upgrade packages",
    new_office_opening:
      "First-time setup — offer full workspace design and supply package",
    startup_expansion:
      "New city, blank canvas — pitch a full office fitout package for the expansion",
    lease_expiry: "Lease approaching expiry — help them plan ahead for next space",
    hiring_surge: "Rapid hiring = desk shortage — lead with fast-delivery workstations",
    hiring_spike:
      "Rapid team growth = desk demand — offer fast-delivery workstation package",
    funding_growth: "Fresh funding = ready to invest — pitch premium workspace package",
    funding:
      "Post-funding team growth is coming — get in early with a workspace plan",
    workplace_role: "Hiring a Workplace Manager signals an office upgrade — reach out now",
    growth_news: "Business growth often means more space — engage before they start looking",
    territory_alert: "Active in your target precinct — reach out with local knowledge",
    tenant_move_out: "Outgoing tenant may need help winding down and selling furniture",
    manual: "Manually detected signal — outreach based on known intelligence",
  };

  const offers: Record<RadarSignalType, string> = {
    office_move: "Free office layout plan + rapid-delivery workstation package",
    new_lease: "Free office layout plan for new tenancy",
    tenant_move_in: "Free workspace design consultation + fitout package",
    office_expansion: "Free workspace expansion plan + headcount-based pricing",
    refurbishment: "Product upgrade package + trade-in offer on existing furniture",
    new_office_opening: "Full workspace supply package + design consultation",
    startup_expansion: "Full fitout and supply package for new city office",
    lease_expiry: "Free new-space planning consultation",
    hiring_surge: "Fast-delivery workstation package + bulk pricing",
    hiring_spike: "Fast-delivery workstation package + bulk desk pricing",
    funding_growth: "Premium workspace package + finance option",
    funding: "Premium workspace package — position ahead of their growth phase",
    workplace_role: "Workspace audit + upgrade package for incoming Workplace Manager",
    growth_news: "Office layout consultation to plan for upcoming team growth",
    territory_alert: "Local market knowledge + office layout consultation",
    tenant_move_out: "Asset disposal and relocation support",
    manual: "Office layout consultation and product recommendation",
  };

  const nextActions: Record<RadarPriority, string> = {
    High: "Send personalised outreach today — reference the signal directly",
    Medium: "Add to outreach queue — personalise and send within 3 business days",
    Low: "Monitor for additional signals — outreach when confidence increases",
  };

  return {
    radarScore: score,
    priority,
    estimatedOfficeSizeSqm: sqmLabel,
    estimatedProjectValue: projectValueLabel,
    recommendedOutreachAngle: outreachAngles[input.signalType] ?? "Lead with free layout plan",
    recommendedOffer: offers[input.signalType] ?? "Free office layout consultation",
    recommendedNextAction: nextActions[priority],
    outreachUrgency,
  };
}

export interface OutreachDraftInput {
  companyName: string;
  city: string;
  industry?: string;
  signalType: RadarSignalType;
  signalSource?: string;
  estimatedProjectValue?: string;
  recommendedOffer?: string;
}

export interface OutreachDraft {
  subject: string;
  email: string;
  followUp: string;
  cta: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Outreach draft generation
// ─────────────────────────────────────────────────────────────────────────────

export async function generateOutreachDraft(
  input: OutreachDraftInput
): Promise<OutreachDraft> {
  const signalDescriptions: Record<RadarSignalType, string> = {
    office_move: "relocating their office",
    new_lease: "signing a new commercial lease",
    tenant_move_in: "moving into a new building",
    office_expansion: "expanding their office space",
    refurbishment: "refurbishing their existing office",
    new_office_opening: "opening a new office",
    startup_expansion: "expanding into a new city office",
    lease_expiry: "approaching a lease expiry or renewal",
    hiring_surge: "rapidly growing their team",
    hiring_spike: "experiencing a rapid hiring spike across their team",
    funding_growth: "recently receiving new funding and planning team growth",
    funding: "recently closing a funding round and expected to grow their team",
    workplace_role:
      "actively recruiting for a Workplace or Facilities role indicating office growth",
    growth_news:
      "experiencing significant business growth likely requiring more office space",
    territory_alert: "occupying space in a monitored building",
    tenant_move_out: "moving out of their current space",
    manual: "being identified as a potential office fitout opportunity",
  };

  const signal =
    signalDescriptions[input.signalType] ?? "going through a workplace change";

  const prompt = `You are writing a brief, human, non-spammy B2B outreach email on behalf of The Corporate Desk — a premium commercial office furniture company in Australia.

CONTEXT:
- Company: ${input.companyName}
- City: ${input.city}
- Industry: ${input.industry ?? "unknown"}
- Signal: The company has been detected as ${signal}
- Source: ${input.signalSource ?? "commercial intelligence"}
- Estimated project: ${input.estimatedProjectValue ?? "unknown"}
- Our offer: ${input.recommendedOffer ?? "free office layout plan"}

Write THREE things:
1. SUBJECT: A short, direct email subject line (max 9 words). Do not use emojis. Do not use "I noticed" or "Congratulations".
2. EMAIL: A short first outreach email (max 90 words). Mention the signal naturally. Sound human, confident, not salesy. End with a single clear question or soft CTA.
3. FOLLOWUP: A brief 2-sentence follow-up email for 5 days later if no reply. Reference the original email.

Return JSON only, exactly like this:
{
  "subject": "...",
  "email": "...",
  "followUp": "...",
  "cta": "Free office layout plan"
}`;

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 600,
      },
      { signal: AbortSignal.timeout(20000) }
    );

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = safeJsonParse<Record<string, any>>(raw, {});

    return {
      subject: typeof parsed.subject === "string" && parsed.subject.trim()
        ? parsed.subject.trim()
        : `Office fitout support for ${input.companyName}`,
      email: typeof parsed.email === "string" && parsed.email.trim()
        ? parsed.email.trim()
        : `Hi, we noticed ${input.companyName} may be ${signal}. We help companies in ${input.city} set up their offices quickly and cost-effectively. Happy to share some ideas?`,
      followUp: typeof parsed.followUp === "string" && parsed.followUp.trim()
        ? parsed.followUp.trim()
        : `Just following up on my earlier note — happy to put together a quick layout concept for your team if timing works.`,
      cta: typeof parsed.cta === "string" && parsed.cta.trim()
        ? parsed.cta.trim()
        : "Free office layout plan",
    };
  } catch {
    return {
      subject: `Workspace planning support — ${input.companyName}`,
      email: `Hi,

We noticed ${input.companyName} may be ${signal} in ${input.city}. We help commercial teams plan and furnish their offices quickly — from a free layout concept through to full supply and install.

Would it be useful to have a quick look at your requirements?`,
      followUp:
        `Just following up on my earlier note regarding your workspace. Happy to share some ideas or put together a quick layout concept if timing works.`,
      cta: "Free office layout plan",
    };
  }
}

export interface RadarScanOpts {
  cities?: string[];
  signalTypes?: RadarSignalType[];
  count?: number;
}

interface ScannedRadarResult {
  company_name: string;
  industry: string;
  city: string;
  state: string;
  signal_type: RadarSignalType;
  signal_subtype: string;
  signal_source: string;
  source_url: string | null;
  confidence_level: RadarConfidence;
  estimated_headcount: string;
  notes: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Radar scan (synthetic) — FIXED: consistent JSON + safer generation
// ─────────────────────────────────────────────────────────────────────────────

export async function runOfficeMovRadarScan(
  opts: RadarScanOpts = {}
): Promise<OfficeMovRadar[]> {
  assertSyntheticAllowed("runOfficeMovRadarScan");

  const cities =
    opts.cities?.length ? opts.cities : ["Brisbane", "Sydney", "Melbourne"];

  const signalTypes =
    opts.signalTypes?.length
      ? opts.signalTypes
      : [
          "office_move",
          "new_lease",
          "office_expansion",
          "hiring_surge",
          "funding_growth",
          "new_office_opening",
        ];

  const count = Math.min(Math.max(opts.count ?? 5, 1), 8);

  // IMPORTANT:
  // This function stores results as verificationStatus: "synthetic"
  // So we must NOT claim "REAL companies" here.
  const prompt = `You are generating synthetic test data for an Australian commercial office fitout radar.

Generate ${count} plausible (FICTIONAL) Office Move Radar detections for The Corporate Desk — a premium office furniture company.

These represent companies likely to need new office furniture, workstations, executive seating, reception furniture, or a full fitout.

TARGET CITIES: ${cities.join(", ")}
SIGNAL TYPES TO DETECT: ${signalTypes.join(", ")}

Rules:
- Companies must be FICTIONAL but realistic-sounding (do NOT use real company names).
- Use real Australian precincts / suburbs.
- Each detection must be distinct company + city + signal.
- Make the notes specific and realistic.
- source_url must be null (synthetic).

Return JSON as an OBJECT with a "results" array of exactly ${count} objects:

{
  "results": [
    {
      "company_name": "Company name",
      "industry": "Industry sector",
      "city": "City",
      "state": "State abbreviation (QLD, NSW, VIC, WA, SA, ACT, NT, TAS)",
      "signal_type": "one of: ${signalTypes.join(", ")}",
      "signal_subtype": "specific sub-signal description",
      "signal_source": "Synthetic radar",
      "source_url": null,
      "confidence_level": "high | medium | low",
      "estimated_headcount": "one of: 5–15, 15–30, 30–60, 60–120, 120–250, 250+",
      "notes": "1-2 sentence plain-English description of the signal detected"
    }
  ]
}`;

  let results: ScannedRadarResult[] = [];

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1800,
      },
      { signal: AbortSignal.timeout(25000) }
    );

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = safeJsonParse<Record<string, any>>(raw, {});
    const candidate = Array.isArray(parsed) ? parsed : parsed.results;

    results = Array.isArray(candidate) ? candidate : [];
  } catch (err: any) {
    console.error("[OfficeMovRadar] scan failed:", err?.message || err);
    return [];
  }

  // Normalise + validate each result to reduce save failures
  const cleaned = results
    .map((r: any) => normaliseScanResult(r, signalTypes))
    .filter(Boolean) as ScannedRadarResult[];

  const saved: OfficeMovRadar[] = [];

  for (const r of cleaned) {
    try {
      const existing = await storage.findRadarDuplicate(
        r.company_name,
        r.city,
        r.signal_type
      );
      if (existing) continue;

      const scoring = scoreRadarSignal({
        signalType: r.signal_type as RadarSignalType,
        confidence: r.confidence_level as RadarConfidence,
        city: r.city,
        industry: r.industry,
        estimatedHeadcount: (r.estimated_headcount == null ? null : Number(String(r.estimated_headcount).replace(/[^0-9.-]/g, "")) || null),
        hasSourceUrl: !!r.source_url,
      });

      const record = await storage.createOfficeMovRadarRecord({
        companyName: r.company_name,
        industry: r.industry,
        city: r.city,
        state: r.state,
        country: "Australia",
        signalType: r.signal_type,
        signalSubtype: r.signal_subtype,
        signalSource: r.signal_source,
        sourceUrl: r.source_url,
        confidenceLevel: r.confidence_level,
        estimatedHeadcount: (r.estimated_headcount == null ? null : Number(String(r.estimated_headcount).replace(/[^0-9.-]/g, "")) || null),
        estimatedOfficeSizeSqm: (scoring.estimatedOfficeSizeSqm == null ? null : Number(String(scoring.estimatedOfficeSizeSqm).replace(/[^0-9.-]/g, "")) || null),
        estimatedProjectValue: (scoring.estimatedProjectValue == null ? null : Number(String(scoring.estimatedProjectValue).replace(/[^0-9.-]/g, "")) || null),
        radarScore: scoring.radarScore,
        priority: scoring.priority,
        recommendedOutreachAngle: scoring.recommendedOutreachAngle,
        recommendedOffer: scoring.recommendedOffer,
        recommendedNextAction: scoring.recommendedNextAction,
        notes: r.notes,
        status: "New",
        sourceType: "office_move_radar_synthetic",
        verificationStatus: "synthetic",
      });

      saved.push(record);
    } catch (err: any) {
      console.error("[OfficeMovRadar] failed to save record:", err?.message || err);
    }
  }

  console.log(`[OfficeMovRadar] Scan complete — ${saved.length} new records saved`);
  return saved;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (parsing + normalisation)
// ─────────────────────────────────────────────────────────────────────────────

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Sometimes models return fenced JSON. Try strip.
    const stripped = raw
      .replace(/^\s*```(?:json)?/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      return JSON.parse(stripped) as T;
    } catch {
      return fallback;
    }
  }
}

function normaliseConfidence(v: any): RadarConfidence {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

function normaliseSignalType(v: any, allowed: RadarSignalType[]): RadarSignalType {
  const s = String(v ?? "").trim() as RadarSignalType;
  return allowed.includes(s) ? s : (allowed[0] ?? "manual");
}

function normaliseHeadcount(v: any): string {
  const s = String(v ?? "").trim();
  const match = HEADCOUNT_RANGES.find((r) => r.label === s);
  return match ? match.label : "30–60";
}

function normaliseState(v: any): string {
  const s = String(v ?? "").toUpperCase().trim();
  const allowed = new Set(["QLD", "NSW", "VIC", "WA", "SA", "ACT", "NT", "TAS"]);
  return allowed.has(s) ? s : "QLD";
}

function toCleanString(v: any, fallback: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : fallback;
}

function normaliseScanResult(
  r: any,
  allowedSignalTypes: RadarSignalType[]
): ScannedRadarResult | null {
  if (!r || typeof r !== "object") return null;

  const company_name = toCleanString(r.company_name, "");
  const city = toCleanString(r.city, "");
  if (!company_name || !city) return null;

  const signal_type = normaliseSignalType(r.signal_type, allowedSignalTypes);

  return {
    company_name,
    industry: toCleanString(r.industry, "Unknown"),
    city,
    state: normaliseState(r.state),
    signal_type,
    signal_subtype: toCleanString(r.signal_subtype, "Workplace change signal"),
    signal_source: toCleanString(r.signal_source, "Synthetic radar"),
    source_url: null, // force null for synthetic
    confidence_level: normaliseConfidence(r.confidence_level),
    estimated_headcount: normaliseHeadcount(r.estimated_headcount),
    notes: toCleanString(r.notes, "Synthetic signal generated for testing."),
  };
}