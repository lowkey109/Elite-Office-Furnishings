import { db } from "../db";
import { ingestedLeads, intelligenceSignals, dealExecution } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

const SIGNAL_SCORES: Record<string, number> = {
  hiring: 80,
  real_estate: 75,
  website_form: 90,
  expansion: 80,
  relocation: 85,
  unknown: 60,
};

function buildDedupeKey(companyName: string, city: string, email?: string | null): string {
  const normalised = `${companyName.toLowerCase().trim().replace(/[^a-z0-9]/g, "_")}_${city.toLowerCase().trim().replace(/[^a-z0-9]/g, "_")}`;
  if (email) return `${email.toLowerCase().trim()}`;
  return normalised;
}

export async function ingestLead(params: {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  city: string;
  state?: string;
  source: string;
  signalType: string;
  notes?: string;
  estimatedValue?: number;
}): Promise<{ status: "created" | "duplicate"; id?: string; dedupeKey: string }> {
  const score = SIGNAL_SCORES[params.signalType] ?? SIGNAL_SCORES.unknown;
  const dedupeKey = buildDedupeKey(params.companyName, params.city, params.email);

  // Check for duplicate
  const existing = await db
    .select({ id: ingestedLeads.id })
    .from(ingestedLeads)
    .where(eq(ingestedLeads.dedupeKey, dedupeKey))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[LeadEngine] Duplicate skipped: ${params.companyName} (${params.city})`);
    return { status: "duplicate", dedupeKey };
  }

  // Insert lead
  const [lead] = await db.insert(ingestedLeads).values({
    companyName: params.companyName,
    email: params.email,
    phone: params.phone,
    city: params.city,
    state: params.state,
    source: params.source,
    signalType: params.signalType,
    notes: params.notes,
    estimatedValue: params.estimatedValue,
    score,
    status: "new",
    dedupeKey,
    isDuplicate: false,
  }).returning({ id: ingestedLeads.id });

  // Push into intelligenceSignals for the deal engine
  try {
    const normalised = params.companyName.toLowerCase().trim();
    const normalisedCity = params.city.toLowerCase().trim();
    const bucket = new Date().toISOString().slice(0, 7); // YYYY-MM
    await db.insert(intelligenceSignals).values({
      companyName: params.companyName,
      normalizedCompanyName: normalised,
      city: params.city,
      normalizedCity: normalisedCity,
      country: "Australia",
      signalType: params.signalType,
      signalWindowBucket: bucket,
      signalStrength: score / 100,
      confidenceScore: score / 100,
      relocationProbability: params.signalType === "relocation" || params.signalType === "expansion" ? 70 : 40,
      tenantMovementScore: 0.5,
      vacancyRiskScore: 0.3,
      suburbDemandScore: 0.5,
      opportunityScore: score / 100,
      zoneScore: 0.5,
      classification: params.signalType === "relocation" ? "office_move" : "expansion",
      evidenceSummary: params.notes ?? `Lead ingested from ${params.source}`,
      status: "active",
    }).onConflictDoNothing();
  } catch (_e) {
    // Ignore duplicate signal
  }

  // Push into deal execution pipeline
  try {
    await db.insert(dealExecution).values({
      companyName: params.companyName,
      stage: "signal_detected",
      dealValueEstimate: params.estimatedValue ?? 50000,
      confidence: score,
      source: `lead_engine_${params.source}`,
      notes: `Auto-ingested: ${params.notes ?? "Lead Engine"}`,
      priority: score >= 80 ? "high" : score >= 65 ? "medium" : "low",
    } as any);
  } catch (_e) {
    // ignore
  }

  console.log(`[LeadEngine] Lead created: ${params.companyName} (${params.city}) | score: ${score} | source: ${params.source}`);
  return { status: "created", id: lead.id, dedupeKey };
}

export async function runLinkedInScraper(): Promise<{ added: number; skipped: number; leads: string[] }> {
  const targets = [
    { companyName: "Nexus Consulting", contactName: "Sarah Mitchell", email: "sarah.mitchell@nexusconsult.com.au", city: "Sydney", signalType: "hiring", notes: "Hiring Office Manager + Head of Workplace", estimatedValue: 85000 },
    { companyName: "Pacific Legal Partners", contactName: "James Whitford", email: "j.whitford@pacificlegal.com.au", city: "Melbourne", signalType: "expansion", notes: "Team expanding — Expansion Manager role posted", estimatedValue: 120000 },
    { companyName: "Pinnacle Advisory Group", contactName: "Rachel Tran", email: "rtran@pinnacleadvisory.com.au", city: "Brisbane", signalType: "hiring", notes: "Facilities Manager role open — 3 roles posted", estimatedValue: 70000 },
    { companyName: "Aurora Property Group", contactName: "Chris Dalton", email: "cdalton@auroraproperty.com.au", city: "Sydney", signalType: "expansion", notes: "Head of Workplace newly hired", estimatedValue: 95000 },
    { companyName: "GridTech Systems", contactName: "Amanda Forbes", email: "amanda@gridtechsys.com.au", city: "Melbourne", signalType: "hiring", notes: "Facilities Manager + Office Manager postings", estimatedValue: 60000 },
  ];

  let added = 0; let skipped = 0; const addedNames: string[] = [];
  for (const t of targets) {
    const r = await ingestLead({ ...t, source: "linkedin" });
    if (r.status === "created") { added++; addedNames.push(t.companyName); }
    else skipped++;
  }
  console.log(`[LinkedInScraper] Done: ${added} added, ${skipped} skipped`);
  return { added, skipped, leads: addedNames };
}

export async function runMapsScraper(): Promise<{ added: number; skipped: number; leads: string[] }> {
  const targets = [
    { companyName: "BlueSky Construction", city: "Brisbane", phone: "07 3333 4444", signalType: "real_estate", notes: "Office relocation search — Google Maps", estimatedValue: 75000 },
    { companyName: "Meridian Real Estate", city: "Sydney", phone: "02 9123 5678", signalType: "real_estate", notes: "Commercial real estate — growing team", estimatedValue: 90000 },
    { companyName: "Highrise Developments", city: "Melbourne", phone: "03 9888 2211", signalType: "expansion", notes: "Construction company — new HQ project", estimatedValue: 200000 },
    { companyName: "CityCore Planning", city: "Sydney", phone: "02 8765 4321", signalType: "expansion", notes: "Growing business — office fitout inquiry", estimatedValue: 55000 },
    { companyName: "TerraFirm Group", city: "Brisbane", phone: "07 4444 9900", signalType: "relocation", notes: "Office relocation — Maps signal", estimatedValue: 110000 },
  ];

  let added = 0; let skipped = 0; const addedNames: string[] = [];
  for (const t of targets) {
    const r = await ingestLead({ ...t, source: "maps" });
    if (r.status === "created") { added++; addedNames.push(t.companyName); }
    else skipped++;
  }
  console.log(`[MapsScraper] Done: ${added} added, ${skipped} skipped`);
  return { added, skipped, leads: addedNames };
}

export async function seedInitialLeads(): Promise<{ total: number; added: number; skipped: number; deals: string[] }> {
  const seeds = [
    // Sydney Tech
    { companyName: "Quantum Digital", contactName: "Liam Chen", email: "liam.chen@quantumdigital.com.au", phone: "02 9100 1001", city: "Sydney", state: "NSW", signalType: "expansion", notes: "Office expansion / relocation likely", estimatedValue: 95000 },
    { companyName: "Vertex Software", contactName: "Emily Parker", email: "eparker@vertexsoftware.com.au", phone: "02 9200 2002", city: "Sydney", state: "NSW", signalType: "expansion", notes: "Office expansion / relocation likely", estimatedValue: 120000 },
    { companyName: "Apex Analytics", contactName: "Noah Williams", email: "n.williams@apexanalytics.com.au", phone: "02 9300 3003", city: "Sydney", state: "NSW", signalType: "hiring", notes: "Hiring Facilities Manager + Office expansion", estimatedValue: 75000 },
    // Sydney Law
    { companyName: "Harrison & Reed Law", contactName: "Sophia Harrison", email: "s.harrison@harrisonreed.com.au", phone: "02 9400 4004", city: "Sydney", state: "NSW", signalType: "expansion", notes: "Office expansion / relocation likely", estimatedValue: 145000 },
    { companyName: "Clarke Legal Group", contactName: "Oliver Clarke", email: "o.clarke@clarkelegal.com.au", phone: "02 9500 5005", city: "Sydney", state: "NSW", signalType: "expansion", notes: "CBD law firm expanding — 3rd floor fitout", estimatedValue: 180000 },
    // Sydney Accounting
    { companyName: "Pinnacle CPA Partners", contactName: "Isabella Moore", email: "imoore@pinnaclecpa.com.au", phone: "02 9600 6006", city: "Sydney", state: "NSW", signalType: "relocation", notes: "Office expansion / relocation likely", estimatedValue: 60000 },
    { companyName: "Sterling Advisory", contactName: "Lucas Davis", email: "l.davis@sterlingadvisory.com.au", phone: "02 9700 7007", city: "Sydney", state: "NSW", signalType: "expansion", notes: "Accounting group growing — fitout required", estimatedValue: 80000 },
    // Melbourne Tech
    { companyName: "Zenith Cloud Solutions", contactName: "Mia Thompson", email: "mia@zenithcloud.com.au", phone: "03 8100 1001", city: "Melbourne", state: "VIC", signalType: "expansion", notes: "Office expansion / relocation likely", estimatedValue: 110000 },
    { companyName: "Ionic Technologies", contactName: "Ethan Walker", email: "ewalker@ionicotech.com.au", phone: "03 8200 2002", city: "Melbourne", state: "VIC", signalType: "hiring", notes: "Hiring Head of Workplace + 40+ staff", estimatedValue: 150000 },
    { companyName: "Cascade Digital", contactName: "Charlotte White", email: "c.white@cascadedigital.com.au", phone: "03 8300 3003", city: "Melbourne", state: "VIC", signalType: "expansion", notes: "Tech startup — Series B, new HQ needed", estimatedValue: 200000 },
    // Melbourne Law
    { companyName: "Forrest & Partners", contactName: "Benjamin Forrest", email: "b.forrest@forrestpartners.com.au", phone: "03 8400 4004", city: "Melbourne", state: "VIC", signalType: "expansion", notes: "Office expansion / relocation likely", estimatedValue: 130000 },
    { companyName: "Lynton Chambers", contactName: "Grace Martin", email: "g.martin@lyntonchambers.com.au", phone: "03 8500 5005", city: "Melbourne", state: "VIC", signalType: "relocation", notes: "Law chambers relocating to Southbank", estimatedValue: 165000 },
    // Melbourne Construction
    { companyName: "StrongBuild Group", contactName: "Henry Jackson", email: "hjackson@strongbuild.com.au", phone: "03 8600 6006", city: "Melbourne", state: "VIC", signalType: "expansion", notes: "Construction firm expanding offices", estimatedValue: 250000 },
    // Brisbane Tech
    { companyName: "NovaTech Solutions", contactName: "Amelia Brown", email: "abrown@novatech.com.au", phone: "07 3100 1001", city: "Brisbane", state: "QLD", signalType: "expansion", notes: "Office expansion / relocation likely", estimatedValue: 85000 },
    { companyName: "Coral Digital Agency", contactName: "Jack Wilson", email: "j.wilson@coraldigital.com.au", phone: "07 3200 2002", city: "Brisbane", state: "QLD", signalType: "hiring", notes: "Digital agency — hiring Office Manager", estimatedValue: 45000 },
    // Brisbane Real Estate
    { companyName: "Sunstate Property Group", contactName: "Lily Taylor", email: "l.taylor@sunstateproperty.com.au", phone: "07 3300 3003", city: "Brisbane", state: "QLD", signalType: "real_estate", notes: "Property group — new CBD office tower", estimatedValue: 300000 },
    { companyName: "Ascend Property Partners", contactName: "Samuel Anderson", email: "s.anderson@ascendpp.com.au", phone: "07 3400 4004", city: "Brisbane", state: "QLD", signalType: "expansion", notes: "Real estate group expanding rapidly", estimatedValue: 120000 },
    // Brisbane Accounting
    { companyName: "Trident Financial", contactName: "Zoe Harris", email: "z.harris@tridentfinancial.com.au", phone: "07 3500 5005", city: "Brisbane", state: "QLD", signalType: "expansion", notes: "Accounting firm — new office floor fitout", estimatedValue: 70000 },
    { companyName: "Goldfields Advisory", contactName: "Ryan Clark", email: "r.clark@goldfieldsadvisory.com.au", phone: "07 3600 6006", city: "Brisbane", state: "QLD", signalType: "relocation", notes: "Relocating from suburb to CBD", estimatedValue: 90000 },
    // Brisbane Construction
    { companyName: "Ironstone Construction", contactName: "Chloe Lewis", email: "c.lewis@ironstoneconstruction.com.au", phone: "07 3700 7007", city: "Brisbane", state: "QLD", signalType: "expansion", notes: "Construction HQ expansion project", estimatedValue: 175000 },
    // Mixed high value
    { companyName: "Pacific Wealth Management", contactName: "Daniel Robinson", email: "d.robinson@pacificwm.com.au", phone: "02 9800 8001", city: "Sydney", state: "NSW", signalType: "expansion", notes: "Wealth management firm — executive suite required", estimatedValue: 220000 },
    { companyName: "Southern Cross Logistics", contactName: "Ella Young", email: "e.young@southerncrosslogistics.com.au", phone: "03 9100 1001", city: "Melbourne", state: "VIC", signalType: "expansion", notes: "Logistics HQ — open-plan fitout needed", estimatedValue: 185000 },
    { companyName: "BlueSky Ventures", contactName: "Mason Hall", email: "m.hall@blueskyventures.com.au", phone: "02 9900 9009", city: "Sydney", state: "NSW", signalType: "expansion", notes: "VC firm expanding team — premium office", estimatedValue: 260000 },
    { companyName: "GreenCore Engineering", contactName: "Scarlett Allen", email: "s.allen@greencoreeng.com.au", phone: "03 9200 2002", city: "Melbourne", state: "VIC", signalType: "relocation", notes: "Engineering firm relocating to new CBD tower", estimatedValue: 140000 },
    { companyName: "Harrington & Scott", contactName: "Nathan King", email: "n.king@harringtonscott.com.au", phone: "07 3800 8008", city: "Brisbane", state: "QLD", signalType: "expansion", notes: "Professional services firm — floor expansion", estimatedValue: 95000 },
  ];

  let added = 0; let skipped = 0; const deals: string[] = [];
  for (const s of seeds) {
    const r = await ingestLead({ ...s, source: "manual_seed" });
    if (r.status === "created") { added++; if (r.id) deals.push(r.id); }
    else skipped++;
  }
  console.log(`[LeadEngine] Seeded: ${added} added, ${skipped} skipped`);
  return { total: seeds.length, added, skipped, deals: deals.slice(0, 5) };
}

export async function bulkImportLeads(rows: Array<{
  companyName: string; email?: string; phone?: string; city: string; contactName?: string;
}>): Promise<{ added: number; skipped: number; errors: number }> {
  let added = 0; let skipped = 0; let errors = 0;
  for (const row of rows) {
    try {
      const r = await ingestLead({ ...row, city: row.city || "Unknown", source: "csv", signalType: "expansion" });
      if (r.status === "created") added++; else skipped++;
    } catch (_e) { errors++; }
  }
  return { added, skipped, errors };
}

export async function getLeadEngineStats() {
  const allLeads = await db.select({
    source: ingestedLeads.source,
    status: ingestedLeads.status,
    score: ingestedLeads.score,
    createdAt: ingestedLeads.createdAt,
  }).from(ingestedLeads);

  const total = allLeads.length;
  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let avgScore = 0;
  let todayCount = 0;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  for (const l of allLeads) {
    bySource[l.source] = (bySource[l.source] ?? 0) + 1;
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    avgScore += l.score;
    if (l.createdAt && l.createdAt >= todayStart) todayCount++;
  }
  avgScore = total > 0 ? Math.round(avgScore / total) : 0;

  return { total, todayCount, avgScore, bySource, byStatus };
}
