import OpenAI from "openai";
import { ADVISOR_SYSTEM_MESSAGE } from "../systemPrompt";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type SourceType =
  | "manual"
  | "job_ad"
  | "linkedin"
  | "hiring_page"
  | "announcement"
  | "article"
  | "website";

export interface SignalInput {
  sourceType: SourceType;
  sourceUrl?: string | null;
  sourceText: string;
  companyHint?: string | null;
}

export interface LeadAnalysisResult {
  company: string;
  domain: string | null;
  website: string | null;
  location: string;
  industry: string;
  estimatedTeamSize: string;
  likelyOfficeNeed: string;
  signalsDetected: string[];
  estimatedProjectValue: string;
  score: number;
  priority: "High" | "Medium" | "Low";
  decisionMakers: string;
  outreachMessage: string;
  reasoning: string;
  buyerPsychologyNotes?: string;
  ceoRecommendation?: string;
  dealQualityAssessment?: string;
  scoreBreakdown?: {
    companySize: number;
    projectValue: number;
    expansionSignals: number;
    budgetClarity: number;
    industryFit: number;
    reasoning: string;
  };
}

const SOURCE_CONTEXT: Record<SourceType, string> = {
  manual: "raw company intelligence and signals",
  job_ad: "a job advertisement posted by the company",
  linkedin: "a LinkedIn post or company profile",
  hiring_page: "the company's careers/hiring page",
  announcement: "a company announcement or press release",
  article: "a news article about the company",
  website: "the company's website content",
};

export function buildAnalysisPrompt(input: SignalInput): string {
  const context = SOURCE_CONTEXT[input.sourceType] || "company content";
  return `You are the AI Lead Intelligence Analyst and CEO Advisor for The Corporate Desk (thecorporatedesk.com.au), Australia's premium commercial office furniture and workspace fitout company.

You think like a CEO/operator, not just a lead scorer. Your job is to tell the team whether this lead is worth their time, what the opportunity is worth, how to approach the buyer, and what the single most important next action is.

Analyse the following content from ${context} and determine if this company is a strong prospect for commercial office furniture or a complete office fitout project in Australia.

TARGET CRITERIA:
- Australian companies with 10–500+ employees
- Industries: tech, finance, law, consulting, engineering, architecture, healthcare admin, government, professional services
- Buying signals: funding rounds, headcount growth, office relocation, new HQ, expanding to new cities, leaving coworking, lease signing, renovation, fitout tender
- Project values: $30,000 (small team) up to $300,000+ (large enterprise)
- Highest-value targets: law firms, financial services, tech companies $10M+ ARR, government agencies, professional services 50+ staff

DEAL QUALITY THINKING:
- A $300k fit-out for a law firm with a signed lease is worth 10x the effort of ten $20k vague enquiries
- Score ruthlessly: no timeline + no budget + no signals = Low priority regardless of company size
- High quality signals: signed lease, headcount above 30, budget mentioned, professional services sector, specific relocation date
- Deprioritise: no verifiable business, residential enquiries, overseas entities, projects under $15,000

Respond ONLY with a valid JSON object. No markdown, no code fences, no commentary — just the JSON:

{
  "company": "Full company name",
  "domain": "domain.com.au or null",
  "website": "https://full-url.com.au or null",
  "location": "City, STATE (e.g. Brisbane, QLD)",
  "industry": "Industry sector",
  "estimatedTeamSize": "e.g. 45-60 people",
  "likelyOfficeNeed": "Specific office need, e.g. New 400sqm fitout for 50-person team relocating to Fortitude Valley Q3 2025",
  "signalsDetected": ["Specific buying signal 1", "Specific buying signal 2", "Specific buying signal 3"],
  "estimatedProjectValue": "e.g. $85,000 – $140,000",
  "score": 8,
  "priority": "High",
  "scoreBreakdown": {
    "companySize": 20,
    "projectValue": 25,
    "expansionSignals": 20,
    "budgetClarity": 15,
    "industryFit": 20,
    "reasoning": "Brief explanation of score components. Each component is out of 20; total should equal score × 10."
  },
  "decisionMakers": "e.g. CEO + Head of Operations are likely key; Office Manager or EA will be day-to-day champion",
  "buyerPsychologyNotes": "What will resonate with this buyer — e.g. risk reduction, premium positioning, certainty of delivery. What objections to expect and how to address them.",
  "outreachMessage": "Professional personalised outreach email (3-4 paragraphs). Open with a specific reference to their growth signal. Introduce The Corporate Desk as Australia's premium commercial furniture supplier with a 6-year warranty and local Brisbane showroom at 10 Primrose St Bowen Hills. Offer a free office layout plan. Warm, consultative, authoritative tone — not a cold sales pitch.",
  "dealQualityAssessment": "CEO-level view: Is this worth pursuing? What is the estimated conversion likelihood? What is the time sensitivity? What would make this a slam-dunk deal?",
  "ceoRecommendation": "The single most important next action for The Corporate Desk, with timing. E.g. 'Call within 48 hours — signed lease signals they are 6–8 weeks from needing furniture decisions. Lead with the free layout plan offer and mention installation slot availability.'",
  "reasoning": "2-3 sentences on why this is or is not a strong prospect for The Corporate Desk, citing the most important specific signals."
}

Scoring guide: 1-10 (10 = highest value prospect). Priority: High (8-10), Medium (5-7), Low (1-4).
scoreBreakdown components each out of 20 points (5 components × 20 = 100 total → divide by 10 = score).
If content does not describe an identifiable Australian business, set score to 1-2 and explain why in reasoning.

CONTENT TO ANALYSE:
${input.companyHint ? `[Company name hint: ${input.companyHint}]\n` : ""}${input.sourceUrl ? `[Source URL: ${input.sourceUrl}]\n` : ""}${input.sourceText}`;
}

export async function analyseSignals(input: SignalInput): Promise<LeadAnalysisResult> {
  if (!input.sourceText || input.sourceText.trim().length < 10) {
    throw new Error("Input text is too short to analyse");
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: ADVISOR_SYSTEM_MESSAGE },
      { role: "user", content: buildAnalysisPrompt(input) },
    ],
  } as any);

  const rawContent = completion.choices[0]?.message?.content || "";
  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI response contained no JSON");

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("AI returned malformed JSON");
  }

  const required = [
    "company", "location", "industry", "estimatedTeamSize",
    "signalsDetected", "estimatedProjectValue", "score", "priority",
    "decisionMakers", "outreachMessage", "reasoning",
  ];
  const missing = required.filter(f => !(f in parsed));
  if (missing.length > 0) throw new Error(`AI response missing fields: ${missing.join(", ")}`);

  return {
    company: String(parsed.company),
    domain: parsed.domain && parsed.domain !== "null" ? String(parsed.domain) : null,
    website: parsed.website && parsed.website !== "null" ? String(parsed.website) : null,
    location: String(parsed.location),
    industry: String(parsed.industry),
    estimatedTeamSize: String(parsed.estimatedTeamSize),
    likelyOfficeNeed: String(parsed.likelyOfficeNeed || "Office furniture/fitout required"),
    signalsDetected: Array.isArray(parsed.signalsDetected)
      ? parsed.signalsDetected.map(String)
      : [],
    estimatedProjectValue: String(parsed.estimatedProjectValue),
    score: Math.min(10, Math.max(1, Math.round(Number(parsed.score) || 5))),
    priority: (["High", "Medium", "Low"].includes(parsed.priority)
      ? parsed.priority
      : "Medium") as "High" | "Medium" | "Low",
    decisionMakers: String(parsed.decisionMakers),
    outreachMessage: String(parsed.outreachMessage),
    reasoning: String(parsed.reasoning),
    buyerPsychologyNotes: parsed.buyerPsychologyNotes ? String(parsed.buyerPsychologyNotes) : undefined,
    ceoRecommendation: parsed.ceoRecommendation ? String(parsed.ceoRecommendation) : undefined,
    dealQualityAssessment: parsed.dealQualityAssessment ? String(parsed.dealQualityAssessment) : undefined,
    scoreBreakdown: parsed.scoreBreakdown && typeof parsed.scoreBreakdown === "object" ? {
      companySize: Number(parsed.scoreBreakdown.companySize) || 0,
      projectValue: Number(parsed.scoreBreakdown.projectValue) || 0,
      expansionSignals: Number(parsed.scoreBreakdown.expansionSignals) || 0,
      budgetClarity: Number(parsed.scoreBreakdown.budgetClarity) || 0,
      industryFit: Number(parsed.scoreBreakdown.industryFit) || 0,
      reasoning: String(parsed.scoreBreakdown.reasoning || ""),
    } : undefined,
  };
}

export function extractDomain(urlOrText: string): string | null {
  if (!urlOrText) return null;
  try {
    const withProtocol = urlOrText.startsWith("http") ? urlOrText : `https://${urlOrText}`;
    const u = new URL(withProtocol);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normaliseCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(pty|ltd|limited|pty\.?\s*ltd|inc|llc|corp|corporation)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
