/**
 * Real Signal Discovery: News Feed + Job Signal + Predictive Scanners
 *
 * Sources (tested accessible):
 *   - Google News RSS  (news.google.com/rss) — up to 100 items per query
 *   - SmartCompany RSS (smartcompany.com.au/feed/)
 *   - Startup Daily RSS (startupdaily.net/feed/)
 *   - Business News Australia RSS (businessnews.com.au/rss.xml)
 *
 * Blocked: Seek (JS-rendered), Indeed (403), ABN Newswire (Incapsula)
 *
 * Signal flow:
 *   fetch RSS → parse → keyword pre-filter → GPT batch classify → dedup → score → save
 */

import OpenAI from "openai";
import { storage } from "../storage";
import { scoreRadarSignal } from "./officeMovRadarService";

function makeOpenAI(): OpenAI {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  if (!apiKey) {
    throw new Error("OpenAI API key not configured (AI_INTEGRATIONS_OPENAI_API_KEY or OPENAI_API_KEY)");
  }

  return new OpenAI({
    apiKey,
    baseURL: baseURL || undefined, // Only set if explicitly provided
    timeout: 30000, // 30 second timeout
    maxRetries: 2,
  });
}

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = makeOpenAI();
  return _openai;
}

let _quotaExhausted = false;
let _quotaResetAt = 0;

function markQuotaExhausted() {
  _quotaExhausted = true;
  _quotaResetAt = Date.now() + 60 * 60 * 1000;
  console.warn("[NewsFeedScanner] OpenAI quota exhausted — skipping classify for 1 hour");
}

function isQuotaExhausted(): boolean {
  if (_quotaExhausted && Date.now() > _quotaResetAt) {
    _quotaExhausted = false;
    console.log("[NewsFeedScanner] OpenAI quota cooldown expired — retrying");
  }
  return _quotaExhausted;
}

// ─── Scan locks — prevent concurrent runs of each scanner ────────────────────

let _newsFeedScanning = false;
let _jobSignalScanning = false;
let _predictiveScanning = false;

// ─── Geographic scope — all major Australian cities ──────────────────────────

export const AUSTRALIAN_CITIES = [
  "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide",
  "Canberra", "Gold Coast", "Newcastle", "Wollongong", "Hobart", "Darwin",
  "Sunshine Coast", "Geelong", "Townsville", "Cairns", "Toowoomba",
  "Ballarat", "Bendigo", "Launceston", "Albury", "Mandurah",
  "Hervey Bay", "Mackay", "Rockhampton", "Bunbury",
];

// State capitals used as fallback when only state is mentioned
const STATE_CAPITALS: Record<string, string> = {
  nsw: "Sydney", vic: "Melbourne", qld: "Brisbane",
  wa: "Perth", sa: "Adelaide", act: "Canberra",
  nt: "Darwin", tas: "Hobart",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
}

interface ClassifiedSignal {
  isRelevant: boolean;
  companyName?: string;
  city?: string;
  industry?: string;
  signalType?: string;
  signalSubtype?: string;
  confidence?: string;
  evidenceExcerpt?: string;
  itemIndex: number;
}

// ─── RSS fetch + parse ────────────────────────────────────────────────────────

function parseRSSFeed(xml: string, feedLabel: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const content = match[1];
    const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    const title = titleMatch?.[1]
      ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      ?.replace(/<[^>]+>/g, "")
      ?.replace(/&amp;/g, "&")
      ?.replace(/&lt;/g, "<")
      ?.replace(/&gt;/g, ">")
      ?.replace(/&#\d+;/g, "")
      ?.trim() ?? "";
    const link =
      (content.match(/<link>([\s\S]*?)<\/link>/) ||
        content.match(/<guid[^>]*>([\s\S]*?)<\/guid>/))?.[1]?.trim() ?? "";
    const rawDesc =
      (content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>/) ||
        content.match(/<description>([\s\S]*?)<\/description>/))?.[1]
        ?.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#\d+;/g, "")
        .trim() ?? "";
    const pubDate = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
    if (title && link) {
      items.push({ title, link, description: rawDesc.slice(0, 300), pubDate, source: feedLabel });
    }
  }
  return items;
}

async function fetchRSS(url: string, label: string): Promise<RSSItem[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TCD-SignalBot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      console.warn(`[NewsFeedScanner] ${label} HTTP ${res.status} — skipping`);
      return [];
    }
    const xml = await res.text();
    const items = parseRSSFeed(xml, label);
    console.log(`[NewsFeedScanner] ${label}: fetched ${items.length} items`);
    return items;
  } catch (err: any) {
    console.warn(`[NewsFeedScanner] ${label} fetch failed: ${err.message}`);
    return [];
  }
}

// ─── GPT batch classifier ─────────────────────────────────────────────────────

type ScanMode = "office_news" | "job_signal" | "predictive";

const SYSTEM_PROMPTS: Record<ScanMode, string> = {
  office_news: `You are a commercial office intelligence analyst for Australia.
You ONLY work with real, named Australian companies. You NEVER invent companies.
Analyse each news article and determine if it contains a real office move/expansion signal for a named Australian company.

RELEVANT signals:
- A named company opening, moving to, or expanding an Australian office
- A named company announcing a new Australian headquarters
- A named company completing an office fitout or refurbishment
- A named company signing a commercial lease in Australia

NOT relevant:
- Work-from-home policy articles with no specific company office transaction
- Government building projects unless a private company is the named tenant
- Real estate market reports without a named tenant
- Articles where no specific company name is identifiable
- Non-Australian offices`,

  job_signal: `You are a commercial office intelligence analyst for Australia.
You ONLY work with real, named Australian companies. You NEVER invent companies.
Analyse each article and determine if it contains a real hiring signal indicating a named Australian company is growing or setting up an office.

RELEVANT signals:
- A named Australian company recruiting: Facilities Manager, Workplace Experience, Head of Workplace, Office Manager, Workplace Lead, Director of Real Estate, Property Manager, Operations Manager
- A named company announcing headcount growth (50+ staff) implying office space demand
- A named company announcing a new Australian office that requires staffing

NOT relevant:
- Generic career advice articles
- Job market trend reports without a specific company
- Articles where no company name is clearly identified`,

  predictive: `You are a predictive commercial intelligence analyst for Australia.
You ONLY work with real, named Australian companies. You NEVER invent companies.
Analyse each article for early-stage signals that predict a company will require office space, furniture, or a fitout in the next 3–12 months.

RELEVANT predictive signals:
- FUNDING: Company raises seed, Series A, Series B, venture capital, growth capital, or private equity — usually leads to team expansion and new/larger office
- HIRING_SPIKE: Company announces hiring 10+ roles, rapid team expansion, or significant headcount growth
- STARTUP_EXPANSION: Startup/scaleup opening a new city office, interstate expansion, or moving from coworking into private office
- WORKPLACE_ROLE: Company hiring Workplace Manager, Facilities Coordinator, Workplace Experience Manager, or similar roles that signal office setup/growth
- GROWTH_NEWS: Major contract win, acquisition, merger, new division launch, or expansion announcement that implies office change
- NEW_OFFICE_OPENING: Direct announcement of a new office opening anywhere in Australia

NOT relevant:
- Generic business news with no office/space implication
- Articles about existing stable businesses with no growth signals
- Market reports without a specific named company
- Non-Australian companies or offices`,
};

async function classifyArticleBatch(
  items: RSSItem[],
  mode: ScanMode,
  attempt = 0,
): Promise<ClassifiedSignal[]> {
  if (items.length === 0) return [];

  const articleList = items
    .map((it, i) => `[${i}] Title: ${it.title}\nDescription: ${it.description.slice(0, 200)}\nSource: ${it.source}`)
    .join("\n\n");

  const signalTypeOptions = mode === "predictive"
    ? "funding, hiring_spike, startup_expansion, workplace_role, growth_news, new_office_opening"
    : "office_move, new_office_opening, office_expansion, refurbishment, hiring_surge, funding_growth, new_lease";

  const userPrompt = `Analyse these ${items.length} articles. For each one, respond with ONLY valid JSON.

Articles:
${articleList}

Respond with a JSON array of objects, one per article, in order:
[
  {
    "itemIndex": 0,
    "isRelevant": true or false,
    "companyName": "exact company name from the article, or null",
    "city": "Australian city name, or null if not specified",
    "industry": "one of: Technology, Finance, Legal, Consulting, Retail, Healthcare, Property, Resources, Government, Education, Media, Construction, Logistics, Other — or null",
    "signalType": "one of: ${signalTypeOptions} — or null",
    "signalSubtype": "brief description of the specific signal sub-type, or null",
    "confidence": "high, medium, or low",
    "evidenceExcerpt": "the single most relevant sentence or phrase from the article that proves the signal, verbatim, max 200 chars"
  }
]

Rules:
- If isRelevant is false, set all other fields to null
- companyName MUST be a real named company from the article. If no specific company is named, set isRelevant to false
- city: infer from article text. If only a state is mentioned, use the state capital. If not determinable, set to null
- Only return the JSON array, nothing else`;

  if (isQuotaExhausted()) {
    console.warn("[NewsFeedScanner] Skipping classify — quota circuit-breaker active");
    return [];
  }

  try {
    const resp = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[mode] },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2500,
    });

    const raw = resp.choices[0].message.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch {
      console.warn("[NewsFeedScanner] GPT non-JSON:", raw.slice(0, 200));
      return [];
    }

    const arr: any[] = Array.isArray(parsed) ? parsed : parsed.signals ?? parsed.results ?? parsed.items ?? [];
    return arr
      .filter((x: any) => typeof x === "object" && x !== null)
      .map((x: any) => ({
        isRelevant: Boolean(x.isRelevant),
        companyName: x.companyName ?? null,
        city: x.city ?? null,
        industry: x.industry ?? null,
        signalType: x.signalType ?? null,
        signalSubtype: x.signalSubtype ?? null,
        confidence: x.confidence ?? "medium",
        evidenceExcerpt: x.evidenceExcerpt ?? null,
        itemIndex: Number(x.itemIndex ?? 0),
      }));
  } catch (err: any) {
    if (err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("quota")) {
      markQuotaExhausted();
      return [];
    }

    // Transient connection/network error — exponential backoff, max 3 retries
    const isTransient =
      err?.message?.includes("Connection error") ||
      err?.message?.includes("ECONNRESET") ||
      err?.message?.includes("ETIMEDOUT") ||
      err?.code === "ECONNRESET" ||
      err?.code === "ETIMEDOUT";

    if (isTransient && attempt < 3) {
      const backoffMs = Math.pow(2, attempt) * 1000; // 1s → 2s → 4s
      console.warn(`[NewsFeedScanner] GPT batch classify transient error (attempt ${attempt + 1}/3) — retrying in ${backoffMs}ms: ${err.message}`);
      await sleep(backoffMs);
      return classifyArticleBatch(items, mode, attempt + 1);
    }

    // Non-retryable error — log and skip batch (don't re-throw to prevent cascade)
    console.error(`[NewsFeedScanner] GPT batch classify failed — skipping batch: ${err.message}`);
    return [];
  }
  return [];
}

// ─── City resolver ────────────────────────────────────────────────────────────

export function resolveCity(text: string): string | null {
  const lower = text.toLowerCase();
  // Direct city name match
  for (const city of AUSTRALIAN_CITIES) {
    if (lower.includes(city.toLowerCase())) return city;
  }
  // State abbreviation → capital
  for (const [abbr, capital] of Object.entries(STATE_CAPITALS)) {
    const patterns = [` ${abbr} `, `, ${abbr}`, `(${abbr})`, `in ${abbr}`, `${abbr},`];
    if (patterns.some(p => lower.includes(p))) return capital;
  }
  return null;
}

// ─── Save classified signals to DB ───────────────────────────────────────────

const INVALID_COMPANY_PATTERNS = [
  /^unknown$/i, /^n\/a$/i, /^null$/i, /^none$/i,
  /fintech$/i, /startup$/i, /company$/i, /firm$/i, /group$/i,
  /^the company$/i, /^a company$/i, /\bindustry\b/i,
];

function isValidCompanyName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 80) return false;
  if (INVALID_COMPANY_PATTERNS.some(p => p.test(name.trim()))) return false;
  if (/^[a-z\s]+$/.test(name)) return false; // all lowercase = likely description, not proper noun
  return true;
}

async function saveSignals(
  items: RSSItem[],
  classified: ClassifiedSignal[],
  sourceType: string,
): Promise<number> {
  let saved = 0;

  for (const signal of classified) {
    if (!signal.isRelevant) continue;
    if (!signal.companyName || !signal.signalType) continue;
    if (!isValidCompanyName(signal.companyName)) {
      console.log(`[NewsFeedScanner] Rejected invalid company name: "${signal.companyName}"`);
      continue;
    }

    const city =
      signal.city ??
      resolveCity(items[signal.itemIndex]?.title ?? "") ??
      resolveCity(items[signal.itemIndex]?.description ?? "") ??
      "Sydney";

    const item = items[signal.itemIndex];
    if (!item) continue;

    // Dedup check 1: same company + city + signal type
    const existing = await storage.findRadarDuplicate(signal.companyName, city, signal.signalType);
    if (existing) {
      console.log(`[NewsFeedScanner] Duplicate skipped: ${signal.companyName} / ${city} / ${signal.signalType}`);
      continue;
    }

    // Dedup check 2: same source URL (same article shouldn't create entries for multiple cities)
    if (item.link) {
      const existingByUrl = await storage.findRadarBySourceUrl(item.link);
      if (existingByUrl) {
        console.log(`[NewsFeedScanner] Same-article duplicate skipped: ${signal.companyName} / ${city} (URL already exists)`);
        continue;
      }
    }

    const scoring = scoreRadarSignal({
      signalType: signal.signalType as any,
      confidence: (signal.confidence ?? "medium") as any,
      city,
      industry: signal.industry ?? undefined,
      estimatedHeadcount: undefined,
      hasSourceUrl: !!item.link,
    });

    try {
      await storage.createOfficeMovRadarRecord({
        companyName: signal.companyName,
        industry: signal.industry ?? null,
        city,
        state: null,
        country: "Australia",
        signalType: signal.signalType,
        signalSubtype: signal.signalSubtype ?? null,
        signalSource: item.source,
        sourceUrl: item.link,
        confidenceLevel: signal.confidence ?? "medium",
        estimatedHeadcount: null,
        estimatedOfficeSizeSqm: (scoring.estimatedOfficeSizeSqm == null ? null : Number(String(scoring.estimatedOfficeSizeSqm).replace(/[^0-9.-]/g, "")) || null),
        estimatedProjectValue: (scoring.estimatedProjectValue == null ? null : Number(String(scoring.estimatedProjectValue).replace(/[^0-9.-]/g, "")) || null),
        radarScore: scoring.radarScore,
        priority: scoring.priority,
        recommendedOutreachAngle: scoring.recommendedOutreachAngle ?? null,
        recommendedOffer: scoring.recommendedOffer ?? null,
        recommendedNextAction: scoring.recommendedNextAction ?? null,
        outreachSubject: null,
        outreachEmailDraft: null,
        outreachFollowUp: null,
        outreachCta: null,
        linkedBuildingId: null,
        linkedProspectId: null,
        status: "New",
        notes: signal.evidenceExcerpt ?? item.title,
        sourceType,
        verificationStatus: "source_post",
        evidenceExcerpt: signal.evidenceExcerpt ?? item.title,
      });
      saved++;
      console.log(`[NewsFeedScanner] Saved: ${signal.companyName} / ${city} / ${signal.signalType} [score ${scoring.radarScore}]`);
    } catch (err: any) {
      console.warn(`[NewsFeedScanner] Save failed for ${signal.companyName}:`, err.message);
    }
  }

  return saved;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function deduplicateItems(items: RSSItem[]): RSSItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.slice(0, 80).toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const MAX_ARTICLES_PER_SCAN = 60;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1200;

// ─── Keyword filters ──────────────────────────────────────────────────────────

const OFFICE_KEYWORDS = [
  "office", "workspace", "headquarters", "hq", "fitout", "fit out",
  "commercial property", "commercial lease", "office space", "new premises",
  "relocation", "move", "expansion", "new floor", "new building",
  "facilities manager", "workplace", "co-working", "coworking",
  "new hire", "hiring", "recruiting", "new role", "new appointment",
  "head of people", "head of workplace", "office manager", "facilities",
];

const PREDICTIVE_KEYWORDS = [
  "funding", "raises", "raised", "series a", "series b", "seed round",
  "venture capital", "growth capital", "investment round", "backed",
  "hiring", "expanding team", "headcount", "staff growth", "new roles",
  "opens office", "opening office", "new city", "interstate", "expansion",
  "contract win", "acquisition", "merger", "new division", "scale up", "scaleup",
  "workplace manager", "facilities coordinator", "office manager", "operations manager",
];

const AUSTRALIA_MARKERS = [
  ...AUSTRALIAN_CITIES.map(c => c.toLowerCase()),
  "australia", "australian", "nsw", "vic", "qld", "wa", "sa", "act", "nt", "tas",
];

function preFilterArticles(items: RSSItem[], extraKeywords: string[] = []): RSSItem[] {
  const keywords = [...OFFICE_KEYWORDS, ...extraKeywords];
  return items.filter((item) => {
    const text = `${item.title} ${item.description}`.toLowerCase();
    const hasSignal = keywords.some(kw => text.includes(kw));
    const hasAustralia = AUSTRALIA_MARKERS.some(m => text.includes(m));
    return hasSignal && hasAustralia;
  });
}

async function runBatchedScan(
  items: RSSItem[],
  mode: ScanMode,
  sourceType: string,
  label: string,
): Promise<{ saved: number; processed: number }> {
  const preFiltered = preFilterArticles(
    items,
    mode === "predictive" ? PREDICTIVE_KEYWORDS : [],
  ).slice(0, MAX_ARTICLES_PER_SCAN);

  const totalUnique = items.length;
  console.log(`[NewsFeedScanner] ${totalUnique} unique → ${preFiltered.length} passed keyword filter → classifying with GPT`);

  let totalSaved = 0;
  for (let i = 0; i < preFiltered.length; i += BATCH_SIZE) {
    const batch = preFiltered.slice(i, i + BATCH_SIZE);
    if (i > 0) await sleep(500); // 500ms between GPT calls to avoid API hammering
    const classified = await classifyArticleBatch(batch, mode);
    totalSaved += await saveSignals(batch, classified, sourceType);
    if (i + BATCH_SIZE < preFiltered.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`[NewsFeedScanner] ${label} complete. Saved ${totalSaved} new signals from ${preFiltered.length} filtered articles.`);
  return { saved: totalSaved, processed: preFiltered.length };
}

// ─── Public scanner functions ─────────────────────────────────────────────────

/**
 * Scans news RSS feeds for direct office move/expansion/opening signals.
 */
export async function runNewsFeedScan(): Promise<{ saved: number; processed: number }> {
  if (_newsFeedScanning) {
    console.warn("[NewsFeedScanner] runNewsFeedScan already in progress — skipping concurrent run");
    return { saved: 0, processed: 0 };
  }
  _newsFeedScanning = true;
  try {
    console.log("[NewsFeedScanner] Starting office news feed scan...");

    const queries = [
      '"new office" Australia',
      '"office expansion" Australia',
      '"office relocation" Australia',
      '"opens new office" Australia',
      '"new Australian office"',
      '"office fitout" Australia',
      '"new headquarters" Australia',
    ];

    const allItems: RSSItem[] = [];
    const fetches = await Promise.allSettled([
      ...queries.map(q => fetchRSS(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-AU&gl=AU&ceid=AU:en`,
        "Google News",
      )),
      fetchRSS("https://www.smartcompany.com.au/feed/", "SmartCompany"),
      fetchRSS("https://www.startupdaily.net/feed/", "Startup Daily"),
      fetchRSS("https://businessnews.com.au/rss.xml", "Business News AU"),
    ]);
    for (const r of fetches) if (r.status === "fulfilled") allItems.push(...r.value);

    return runBatchedScan(deduplicateItems(allItems), "office_news", "news_rss", "Office news scan");
  } finally {
    _newsFeedScanning = false;
  }
}

/**
 * Scans for job posting signals (facilities/workplace roles = likely office growth).
 */
export async function runJobSignalScan(): Promise<{ saved: number; processed: number }> {
  if (_jobSignalScanning) {
    console.warn("[NewsFeedScanner] runJobSignalScan already in progress — skipping concurrent run");
    return { saved: 0, processed: 0 };
  }
  _jobSignalScanning = true;
  try {
    console.log("[NewsFeedScanner] Starting job signal scan...");

    const queries = [
      '"facilities manager" Australia hiring',
      '"workplace experience" Australia',
      '"head of workplace" Australia',
      '"office manager" "new role" Australia',
      '"director of real estate" Australia',
      '"workplace lead" Australia',
    ];

    const allItems: RSSItem[] = [];
    const fetches = await Promise.allSettled(
      queries.map(q => fetchRSS(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-AU&gl=AU&ceid=AU:en`,
        "Google News (Jobs)",
      )),
    );
    for (const r of fetches) if (r.status === "fulfilled") allItems.push(...r.value);

    return runBatchedScan(deduplicateItems(allItems), "job_signal", "job_signal", "Job signal scan");
  } finally {
    _jobSignalScanning = false;
  }
}

/**
 * Predictive scanner — detects early-stage signals that precede office demand:
 * funding rounds, hiring spikes, startup expansion, workplace role hires, growth news.
 */
export async function runPredictiveScan(): Promise<{ saved: number; processed: number }> {
  if (_predictiveScanning) {
    console.warn("[NewsFeedScanner] runPredictiveScan already in progress — skipping concurrent run");
    return { saved: 0, processed: 0 };
  }
  _predictiveScanning = true;
  try {
    console.log("[NewsFeedScanner] Starting predictive signal scan...");

    const queries = [
      '"Series A" Australia office',
      '"Series B" Australia',
      '"seed funding" Australia startup',
      '"raises" million Australia technology',
      '"venture capital" Australia',
      '"expanding" "new office" Australia',
      '"opening" office Australia 2025 OR 2026',
      '"Australian office" opens',
      '"interstate expansion" Australia',
      '"contract win" Australia office',
      '"acquisition" Australia office',
    ];

    const allItems: RSSItem[] = [];
    const fetches = await Promise.allSettled([
      ...queries.map(q => fetchRSS(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-AU&gl=AU&ceid=AU:en`,
        "Google News (Predictive)",
      )),
      fetchRSS("https://www.smartcompany.com.au/feed/", "SmartCompany"),
      fetchRSS("https://www.startupdaily.net/feed/", "Startup Daily"),
      fetchRSS("https://businessnews.com.au/rss.xml", "Business News AU"),
    ]);
    for (const r of fetches) if (r.status === "fulfilled") allItems.push(...r.value);

    return runBatchedScan(deduplicateItems(allItems), "predictive", "predictive", "Predictive signal scan");
  } finally {
    _predictiveScanning = false;
  }
}

/**
 * Full combined scan — runs news, job, and predictive in sequence.
 * Used by the scheduler and "Scan All" admin button.
 */
export async function runFullRadarScan(): Promise<{ saved: number; processed: number; breakdown: Record<string, number> }> {
  console.log("[NewsFeedScanner] Starting full radar scan (all sources)...");

  const [news, jobs, predictive] = await Promise.allSettled([
    runNewsFeedScan(),
    runJobSignalScan(),
    runPredictiveScan(),
  ]);

  const newsResult = news.status === "fulfilled" ? news.value : { saved: 0, processed: 0 };
  const jobsResult = jobs.status === "fulfilled" ? jobs.value : { saved: 0, processed: 0 };
  const predictiveResult = predictive.status === "fulfilled" ? predictive.value : { saved: 0, processed: 0 };

  const totalSaved = newsResult.saved + jobsResult.saved + predictiveResult.saved;
  const totalProcessed = newsResult.processed + jobsResult.processed + predictiveResult.processed;

  console.log(`[NewsFeedScanner] Full scan complete: ${totalSaved} new signals from ${totalProcessed} articles`);

  return {
    saved: totalSaved,
    processed: totalProcessed,
    breakdown: {
      news: newsResult.saved,
      jobs: jobsResult.saved,
      predictive: predictiveResult.saved,
    },
  };
}
