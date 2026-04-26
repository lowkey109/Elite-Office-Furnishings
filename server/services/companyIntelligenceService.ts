// ─── Company Intelligence Service ────────────────────────────────────────────
// Aggregates radar signals into persistent company profiles with multi-signal
// confidence stacking, org-chart extraction, and global radar detection.

import OpenAI from "openai";
import { storage } from "../storage";
import type { InsertOfficeMovRadar } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
function assertSyntheticAllowed(featureName: string) {
  const allowSynthetic = process.env.ALLOW_SYNTHETIC_INTELLIGENCE === "true";
  if (!allowSynthetic) {
    throw new Error(`${featureName} is disabled because synthetic intelligence is not allowed in this environment.`);
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIGNAL_SOURCE_RELIABILITY: Record<string, number> = {
  visitor_intelligence: 0.95,
  workspace_planner: 0.90,
  new_lease: 0.88,
  office_move: 0.85,
  funding: 0.80,
  hiring_spike: 0.72,
  hiring_surge: 0.72,
  workplace_role: 0.68,
  growth_news: 0.60,
  manual: 0.50,
};

const GLOBAL_CITIES: { country: string; city: string; state?: string }[] = [
  // Australia
  { country: "Australia", city: "Sydney", state: "NSW" },
  { country: "Australia", city: "Melbourne", state: "VIC" },
  { country: "Australia", city: "Brisbane", state: "QLD" },
  { country: "Australia", city: "Perth", state: "WA" },
  { country: "Australia", city: "Adelaide", state: "SA" },
  { country: "Australia", city: "Canberra", state: "ACT" },
  { country: "Australia", city: "Gold Coast", state: "QLD" },
  { country: "Australia", city: "Newcastle", state: "NSW" },
  { country: "Australia", city: "Sunshine Coast", state: "QLD" },
  { country: "Australia", city: "Hobart", state: "TAS" },
  // United States
  { country: "United States", city: "New York" },
  { country: "United States", city: "Austin" },
  { country: "United States", city: "San Francisco" },
  { country: "United States", city: "Los Angeles" },
  { country: "United States", city: "Chicago" },
  // United Kingdom
  { country: "United Kingdom", city: "London" },
  { country: "United Kingdom", city: "Manchester" },
  { country: "United Kingdom", city: "Birmingham" },
  // New Zealand
  { country: "New Zealand", city: "Auckland" },
  { country: "New Zealand", city: "Wellington" },
  { country: "New Zealand", city: "Christchurch" },
];

// ─── Multi-signal confidence stacking ────────────────────────────────────────

export function computeStackedConfidence(signals: {
  type: string;
  date: Date | string;
  source?: string;
}[]): {
  confidenceScore: number;
  priorityLevel: "urgent" | "high" | "medium" | "low";
  moveProbability: number;
  reasoningSummary: string;
} {
  if (!signals.length) {
    return { confidenceScore: 0, priorityLevel: "low", moveProbability: 0, reasoningSummary: "No signals detected" };
  }

  const now = Date.now();
  const WINDOW_90 = 90 * 24 * 60 * 60 * 1000;
  const WINDOW_30 = 30 * 24 * 60 * 60 * 1000;

  // Unique signal types
  const uniqueTypes = [...new Set(signals.map(s => s.type))];
  const signalCount = signals.length;
  const uniqueCount = uniqueTypes.length;

  // Recency scoring
  const recentSignals = signals.filter(s => now - new Date(s.date).getTime() < WINDOW_90);
  const veryRecentSignals = signals.filter(s => now - new Date(s.date).getTime() < WINDOW_30);

  // Source reliability average
  const avgReliability = signals.reduce((sum, s) => {
    const reliability = SIGNAL_SOURCE_RELIABILITY[s.source || "manual"] ?? 0.5;
    return sum + reliability;
  }, 0) / signalCount;

  // Base score from signal diversity
  let score = 20; // base
  score += Math.min(uniqueCount * 12, 40); // up to +40 for diverse signals
  score += Math.min(signalCount * 5, 25); // up to +25 for volume
  score += Math.min(recentSignals.length * 3, 15); // up to +15 for recency
  score += Math.min(veryRecentSignals.length * 4, 12); // up to +12 for very recent
  score += Math.round(avgReliability * 10); // up to +10 for source quality

  // Cap at 98
  const confidenceScore = Math.min(Math.round(score), 98);
  const moveProbability = Math.min(Math.round(score * 0.95), 96);

  // Priority levels
  let priorityLevel: "urgent" | "high" | "medium" | "low" = "low";
  if (confidenceScore >= 80) priorityLevel = "urgent";
  else if (confidenceScore >= 65) priorityLevel = "high";
  else if (confidenceScore >= 45) priorityLevel = "medium";

  // Reasoning summary
  const reasons: string[] = [];
  if (uniqueTypes.includes("hiring_spike") || uniqueTypes.includes("hiring_surge")) {
    reasons.push("hiring spike detected");
  }
  if (uniqueTypes.includes("funding") || uniqueTypes.includes("funding_growth")) {
    reasons.push("funding announcement detected");
  }
  if (uniqueTypes.includes("office_move") || uniqueTypes.includes("new_lease")) {
    reasons.push("office move / lease signal detected");
  }
  if (uniqueTypes.includes("workplace_role")) {
    reasons.push("workplace manager role advertised");
  }
  if (uniqueTypes.includes("visitor_intelligence")) {
    reasons.push(`${veryRecentSignals.filter(s => s.type === "visitor_intelligence").length || 1} repeat website visits`);
  }
  if (uniqueTypes.includes("workspace_planner")) {
    reasons.push("workspace planner usage detected");
  }
  if (signalCount > 3) {
    reasons.push(`${signalCount} total signals stacked`);
  }

  const reasoningSummary = reasons.join(" • ") || `${uniqueCount} signal type(s) detected`;

  return { confidenceScore, priorityLevel, moveProbability, reasoningSummary };
}

// ─── Sync company intelligence from radar records ─────────────────────────────

export async function syncCompanyIntelligence(): Promise<{ synced: number; created: number }> {
  console.log("[CompanyIntelligence] Starting sync from radar records...");

  const radarRecords = await storage.getOfficeMovRadarRecords({});
  const visitorSessions = await storage.getVisitorSessions({ limit: 500 });

  // Group radar records by normalised company name
  const byCompany = new Map<string, typeof radarRecords>();
  for (const rec of radarRecords) {
    const key = rec.companyName.trim().toLowerCase();
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key)!.push(rec);
  }

  let synced = 0;
  let created = 0;

  for (const [, records] of byCompany) {
    const latest = records[0];
    const companyName = latest.companyName;

    // Build signal timeline
    const signalTimeline = records.map(r => ({
      type: r.signalType,
      date: r.dateDetected || r.createdAt,
      source: r.signalSource || r.sourceType || "radar",
    }));

    // Count visitor sessions for this company
    const companyVisitors = visitorSessions.filter(v =>
      v.companyName && v.companyName.toLowerCase().includes(companyName.toLowerCase().slice(0, 8))
    );

    // Add visitor intelligence signals to timeline
    for (const vs of companyVisitors) {
      signalTimeline.push({ type: "visitor_intelligence", date: vs.createdAt || new Date(), source: "visitor_intelligence" });
    }

    // Compute stacked confidence
    const { confidenceScore, priorityLevel, moveProbability, reasoningSummary } = computeStackedConfidence(signalTimeline.filter((s) => s.date != null).map((s) => ({ ...s, date: s.date as Date })));

    const uniqueTypes = [...new Set(signalTimeline.map(s => s.type))];
    const latestSignalDates = signalTimeline.filter(s => s.date != null).map(s => new Date(s.date as any)).filter(d => !isNaN(d.getTime()));
    const latestSignalDate = latestSignalDates.length ? new Date(Math.max(...latestSignalDates.map(d => d.getTime()))) : undefined;

    const existingRecords = await storage.getCompanyIntelligenceRecords({ limit: 500 });
    const exists = existingRecords.find(e => e.companyName.toLowerCase() === companyName.toLowerCase());

    await storage.upsertCompanyIntelligence(companyName, {
      city: latest.city,
      state: latest.state || undefined,
      country: latest.country || "Australia",
      industry: latest.industry || undefined,
      employeeEstimate: latest.estimatedHeadcount || undefined,
      estimatedOfficeSizeSqm: latest.estimatedOfficeSizeSqm || undefined,
      estimatedProjectValue: latest.estimatedProjectValue || undefined,
      radarSignalCount: records.length,
      visitorSessions: companyVisitors.length,
      engagementScore: companyVisitors.reduce((s, v) => s + (v.engagementScore || 0), 0),
      confidenceScore,
      moveProbability,
      priorityLevel,
      signalTypesJson: JSON.stringify(uniqueTypes),
      signalTimelineJson: JSON.stringify(signalTimeline.slice(0, 20)),
      latestSignalDate,
      reasoningSummary,
      linkedRadarIds: JSON.stringify(records.map(r => r.id)),
      status: "active",
    });

    if (exists) synced++;
    else created++;
  }

  console.log(`[CompanyIntelligence] Sync complete: ${created} created, ${synced} updated`);
  return { synced, created };
}

// ─── Org chart extraction ─────────────────────────────────────────────────────

export async function extractOrgChartContacts(companyId: string): Promise<{ extracted: number }> {
  const company = await storage.getCompanyIntelligence(companyId);
  if (!company) throw new Error("Company not found");

  console.log(`[CompanyIntelligence] Extracting org chart for: ${company.companyName}`);

  const prompt = `You are an expert B2B intelligence analyst for The Corporate Desk, a premium Australian office furniture company.

Extract likely workplace decision-maker contacts for: ${company.companyName}
Company details:
- Industry: ${company.industry || "Unknown"}
- City: ${company.city}, ${company.country}
- Employee estimate: ${company.employeeEstimate || "Unknown"}
- Domain: ${company.domain || "Unknown"}

For a ${company.industry || "mid-size"} company of this profile, identify the most likely decision makers for office furniture, workspace fitout, and relocation projects.

Return a JSON array of contacts (maximum 6) in this format:
[
  {
    "contactName": "Name if inferrable or null",
    "role": "exact role title",
    "department": "department name",
    "confidenceScore": 0-100,
    "contactSource": "inferred",
    "notes": "brief reasoning"
  }
]

Focus on these roles: Head of Workplace, Facilities Manager, Office Manager, Operations Manager, Head of Real Estate, Workplace Experience Manager, Chief Operating Officer.

Return ONLY valid JSON array. No markdown, no explanation.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 800,
  });

  const content = response.choices[0].message.content?.trim() || "[]";

  let contacts: any[] = [];
  try {
    contacts = JSON.parse(content);
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) contacts = JSON.parse(match[0]);
  }

  // Clear existing contacts and re-insert
  await storage.deleteCompanyContacts(companyId);
  let extracted = 0;
  for (const c of contacts.slice(0, 6)) {
    await storage.createCompanyContact({
      companyIntelligenceId: companyId,
      companyName: company.companyName,
      contactName: c.contactName || null,
      role: c.role || "Unknown Role",
      department: c.department || null,
      confidenceScore: Math.min(100, Math.max(0, c.confidenceScore || 50)),
      contactSource: "inferred",
      notes: c.notes || null,
    });
    extracted++;
  }

  console.log(`[CompanyIntelligence] Extracted ${extracted} contacts for ${company.companyName}`);
  return { extracted };
}

// ─── Global Radar Scan ────────────────────────────────────────────────────────

  export async function runGlobalRadarScan(count: number = 12): Promise<{ saved: number }> {
    assertSyntheticAllowed("runGlobalRadarScan");
    console.log("[GlobalRadar] Starting global radar scan...");

  // Focus on international cities (non-Australian ones for global expansion)
  const intlCities = GLOBAL_CITIES.filter(c => c.country !== "Australia");
  const auCities = GLOBAL_CITIES.filter(c => c.country === "Australia");

  // Pick a mix: 4 international + 4 Australian
  const sampleCities = [
    ...shuffle(intlCities).slice(0, 4),
    ...shuffle(auCities).slice(0, 4),
  ];

  const prompt = `You are the Global Radar for The Corporate Desk, detecting office move and expansion opportunities internationally.

Generate ${count} realistic company signal records for companies showing signs of office relocation, expansion, or fit-out needs in these cities: ${sampleCities.map(c => `${c.city}, ${c.country}`).join(" | ")}

For each record return a JSON object:
{
  "companyName": "realistic company name",
  "industry": "tech|finance|legal|healthcare|consulting|media|retail|logistics",
  "city": "exact city from the list",
  "country": "exact country from the list",
  "state": "state/region or null",
  "signalType": "hiring_spike|funding_growth|office_expansion|new_lease|workplace_role|growth_news|office_move",
  "signalSubtype": "description",
  "signalSource": "linkedin|news|job_board|commercial_registry|press_release",
  "evidenceExcerpt": "1-2 sentence evidence of office move/expansion signal",
  "estimatedHeadcount": "50-200|200-500|500-1000|1000+",
  "estimatedOfficeSizeSqm": "number as string e.g. 800",
  "estimatedProjectValue": "dollar value as string e.g. $250,000",
  "radarScore": 55-90,
  "priority": "High|Medium|Low",
  "confidenceLevel": "high|medium|low",
  "recommendedOutreachAngle": "brief outreach angle",
  "recommendedOffer": "brief offer",
  "recommendedNextAction": "brief next action"
}

Return ONLY a valid JSON array of ${count} objects. No markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 3000,
  });

  const content = response.choices[0].message.content?.trim() || "[]";
  let records: any[] = [];
  try {
    records = JSON.parse(content);
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) records = JSON.parse(match[0]);
  }

  let saved = 0;
  for (const rec of records) {
    try {
      const cityInfo = sampleCities.find(c => c.city === rec.city);
      await storage.createOfficeMovRadarRecord({
        companyName: rec.companyName,
        industry: rec.industry || null,
        city: rec.city,
        state: rec.state || cityInfo?.state || null,
        country: rec.country || "Australia",
        signalType: rec.signalType || "growth_news",
        signalSubtype: rec.signalSubtype || null,
        signalSource: rec.signalSource || "global_radar",
        evidenceExcerpt: rec.evidenceExcerpt || null,
        estimatedHeadcount: rec.estimatedHeadcount || null,
        estimatedOfficeSizeSqm: rec.estimatedOfficeSizeSqm || null,
        estimatedProjectValue: rec.estimatedProjectValue || null,
        radarScore: rec.radarScore || 60,
        priority: rec.priority || "Medium",
        confidenceLevel: rec.confidenceLevel || "medium",
        recommendedOutreachAngle: rec.recommendedOutreachAngle || null,
        recommendedOffer: rec.recommendedOffer || null,
        recommendedNextAction: rec.recommendedNextAction || null,
        status: "New",
        sourceType: "global_radar_disabled",
        verificationStatus: "disabled",
        dateDetected: new Date(),
      } as any);
      saved++;
    } catch (e: any) {
      console.error("[GlobalRadar] Failed to save record:", e.message);
    }
  }

  console.log(`[GlobalRadar] Saved ${saved} global radar records`);
  return { saved };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
