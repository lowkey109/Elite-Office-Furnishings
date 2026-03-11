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
  return `You are the AI Lead Intelligence Analyst for The Corporate Desk (thecorporatedesk.com.au), Australia's premium commercial office furniture and workspace fitout company.

Analyse the following content from ${context} and determine if this company is a strong prospect for commercial office furniture or a complete office fitout project in Australia.

TARGET CRITERIA:
- Australian companies with 10–500+ employees
- Industries: tech, finance, law, consulting, engineering, architecture, healthcare admin, government, professional services
- Buying signals: funding rounds, headcount growth, office relocation, new HQ, expanding to new cities, leaving coworking, lease signing, renovation, fitout tender
- Project values: $30,000 (small team) up to $300,000+ (large enterprise)

Respond ONLY with a valid JSON object. No markdown, no code fences, no commentary — just the JSON:

{
  "company": "Full company name",
  "domain": "domain.com.au or null",
  "website": "https://full-url.com.au or null",
  "location": "City, STATE (e.g. Brisbane, QLD)",
  "industry": "Industry sector",
  "estimatedTeamSize": "e.g. 45-60 people",
  "likelyOfficeNeed": "Specific need, e.g. New 400sqm fitout for 50-person team relocating to Fortitude Valley",
  "signalsDetected": ["Specific signal 1", "Specific signal 2", "Specific signal 3"],
  "estimatedProjectValue": "e.g. $85,000 – $140,000",
  "score": 8,
  "priority": "High",
  "decisionMakers": "e.g. CEO, Head of Operations, Office Manager",
  "outreachMessage": "Professional personalised outreach email (3-4 paragraphs). Open with a specific reference to their growth signal. Introduce The Corporate Desk, mention the free office layout plan and Brisbane showroom at 10 Primrose St Bowen Hills. Warm consultative tone.",
  "reasoning": "2-3 sentences on why this is or is not a good prospect, citing specific signals."
}

Scoring guide: 1-10 (10 = highest value prospect). Priority: High (8-10), Medium (5-7), Low (1-4).
If the content does not describe an identifiable Australian business, set score to 1-2 and explain in reasoning.

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
