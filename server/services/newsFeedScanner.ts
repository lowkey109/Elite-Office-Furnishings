/**
 * Real Signal Discovery: News Feed + Job Signal Scanners
 *
 * Sources used (tested and verified accessible):
 *   - Google News RSS  (news.google.com/rss) — 100 real items per query
 *   - SmartCompany RSS (smartcompany.com.au/feed/) — 10 items
 *   - Startup Daily RSS (startupdaily.net/feed/) — 10 items
 *
 * Sources NOT used (blocked/JS-rendered):
 *   - Seek.com.au — fully JavaScript-rendered, no structured data accessible
 *   - Indeed AU — 403 bot protection
 *   - ABN Newswire — Incapsula challenge
 *
 * Signal flow:
 *   fetch RSS → parse items → GPT batch classify → dedup check → score → save to office_move_radar
 */

import OpenAI from "openai";
import { storage } from "../storage";
import { scoreRadarSignal } from "./officeMovRadarService";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const AUSTRALIAN_CITIES = [
  "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide",
  "Canberra", "Gold Coast", "Newcastle", "Wollongong", "Hobart", "Darwin",
];

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
  confidence?: string;
  evidenceExcerpt?: string;
  itemIndex: number;
}

function parseRSSFeed(xml: string, feedLabel: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const content = match[1];
    const title =
      (content.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>/) ||
        content.match(/<title>([\s\S]*?)<\/title>/))?.[1]
        ?.replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#\d+;/g, "")
        .trim() ?? "";
    const link =
      (content.match(/<link>([\s\S]*?)<\/link>/) ||
        content.match(/<guid[^>]*>([\s\S]*?)<\/guid>/))?.[1]?.trim() ?? "";
    const rawDesc =
      (content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>/) ||
        content.match(/<description>([\s\S]*?)<\/description>/))?.[1]
        ?.replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, "")
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
      console.warn(`[NewsFeedScanner] ${label} returned HTTP ${res.status} — skipping`);
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

async function classifyArticleBatch(
  items: RSSItem[],
  mode: "office_news" | "job_signal",
): Promise<ClassifiedSignal[]> {
  if (items.length === 0) return [];

  const articleList = items
    .map(
      (it, i) =>
        `[${i}] Title: ${it.title}\nDescription: ${it.description.slice(0, 200)}\nSource: ${it.source}`,
    )
    .join("\n\n");

  const systemPrompt =
    mode === "office_news"
      ? `You are a real estate and commercial office intelligence analyst for Australia.
You ONLY work with real, named Australian companies. You NEVER invent companies.
Your job: analyse each news article and determine if it contains a real office move/expansion signal for a named Australian company.

A relevant signal is:
- A named company opening, moving to, or expanding an Australian office
- A named company announcing a new Australian headquarters
- A named company completing an office fitout/refurbishment
- A named company signing a commercial lease in Australia

NOT relevant:
- Articles about work-from-home policies, rules, or trends (no specific company office transaction)
- Government/public sector building projects (unless a private company is named)
- Real estate market reports without a named tenant
- Articles where no specific company name can be identified
- Non-Australian offices`
      : `You are a commercial office intelligence analyst for Australia.
You ONLY work with real, named Australian companies. You NEVER invent companies.
Your job: analyse each article and determine if it contains a real hiring signal indicating a named Australian company is actively setting up, growing, or managing an office.

A relevant signal is:
- A named company in Australia actively recruiting for: Facilities Manager, Workplace Experience, Head of Workplace, Office Manager, Workplace Lead, Director of Real Estate, Property Manager
- A named company announcing headcount growth (hiring 50+ staff) that implies office space demand
- A named company announcing a new Australian office that requires staff

NOT relevant:
- Generic career advice articles
- Job market reports without a specific company
- Articles where no specific company name is clearly identified`;

  const userPrompt = `Analyse these ${items.length} articles. For each one, respond with ONLY valid JSON.

Articles:
${articleList}

Respond with a JSON array of objects, one per article, in order:
[
  {
    "itemIndex": 0,
    "isRelevant": true or false,
    "companyName": "exact company name as it appears in the article, or null",
    "city": "Australian city name, or null if not specified",
    "industry": "one of: Technology, Finance, Legal, Consulting, Retail, Healthcare, Property, Resources, Government, Education, Media, Other — or null",
    "signalType": "one of: office_move, new_office_opening, office_expansion, refurbishment, hiring_surge, funding_growth, new_lease — or null",
    "confidence": "high, medium, or low",
    "evidenceExcerpt": "the single most relevant sentence or phrase from the article title/description that proves the signal, verbatim, max 200 chars"
  },
  ...
]

Rules:
- If isRelevant is false, set all other fields to null
- companyName MUST be a real named company from the article. If no specific company is named, set isRelevant to false
- city: infer from the article text. If only a state is mentioned, use the state capital. If unclear, set to null
- Only return the JSON array, nothing else`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000,
    });

    const raw = resp.choices[0].message.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[NewsFeedScanner] GPT returned non-JSON:", raw.slice(0, 200));
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
        confidence: x.confidence ?? "medium",
        evidenceExcerpt: x.evidenceExcerpt ?? null,
        itemIndex: Number(x.itemIndex ?? 0),
      }));
  } catch (err: any) {
    console.error("[NewsFeedScanner] GPT batch classify failed:", err.message);
    return [];
  }
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

    const city = signal.city ?? resolveCity(items[signal.itemIndex]?.title ?? "") ?? "Sydney";
    const item = items[signal.itemIndex];
    if (!item) continue;

    const existing = await storage.findRadarDuplicate(
      signal.companyName,
      city,
      signal.signalType,
    );
    if (existing) {
      console.log(
        `[NewsFeedScanner] Duplicate skipped: ${signal.companyName} / ${city} / ${signal.signalType}`,
      );
      continue;
    }

    const scoring = scoreRadarSignal({
      signalType: signal.signalType,
      confidenceLevel: signal.confidence ?? "medium",
      industry: signal.industry ?? "Other",
      city,
      estimatedHeadcount: null,
    });

    try {
      await storage.createOfficeMovRadarRecord({
        companyName: signal.companyName,
        industry: signal.industry ?? null,
        city,
        state: null,
        country: "Australia",
        signalType: signal.signalType,
        signalSubtype: null,
        signalSource: item.source,
        sourceUrl: item.link,
        confidenceLevel: signal.confidence ?? "medium",
        estimatedHeadcount: null,
        estimatedOfficeSizeSqm: null,
        estimatedProjectValue: null,
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
      console.log(
        `[NewsFeedScanner] Saved: ${signal.companyName} / ${city} / ${signal.signalType} [score ${scoring.radarScore}]`,
      );
    } catch (err: any) {
      console.warn(`[NewsFeedScanner] Save failed for ${signal.companyName}:`, err.message);
    }
  }

  return saved;
}

function resolveCity(text: string): string | null {
  for (const city of AUSTRALIAN_CITIES) {
    if (text.toLowerCase().includes(city.toLowerCase())) return city;
  }
  return null;
}

function deduplicateItems(items: RSSItem[]): RSSItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.slice(0, 80).toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const OFFICE_KEYWORDS = [
  "office", "workspace", "headquarters", "hq", "fitout", "fit out",
  "commercial property", "commercial lease", "office space", "new premises",
  "relocation", "move", "expansion", "new floor", "new building",
  "facilities manager", "workplace", "co-working", "coworking",
  "new hire", "hiring", "recruiting", "new role", "new appointment",
  "head of people", "head of workplace", "office manager", "facilities",
];

const AUSTRALIA_MARKERS = [
  ...AUSTRALIAN_CITIES.map(c => c.toLowerCase()),
  "australia", "australian", "nsw", "vic", "qld", "wa", "sa", "act", "nt",
];

function preFilterArticles(items: RSSItem[]): RSSItem[] {
  return items.filter((item) => {
    const text = `${item.title} ${item.description}`.toLowerCase();
    const hasOfficeSignal = OFFICE_KEYWORDS.some(kw => text.includes(kw));
    const hasAustralia = AUSTRALIA_MARKERS.some(m => text.includes(m));
    return hasOfficeSignal && hasAustralia;
  });
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const MAX_ARTICLES_PER_SCAN = 60;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1200;

export async function runNewsFeedScan(): Promise<{ saved: number; processed: number }> {
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

  const rssFetches = await Promise.allSettled([
    ...queries.map((q) =>
      fetchRSS(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-AU&gl=AU&ceid=AU:en`,
        `Google News`,
      ),
    ),
    fetchRSS("https://www.smartcompany.com.au/feed/", "SmartCompany"),
    fetchRSS("https://www.startupdaily.net/feed/", "Startup Daily"),
  ]);

  for (const result of rssFetches) {
    if (result.status === "fulfilled") allItems.push(...result.value);
  }

  const deduped = deduplicateItems(allItems);
  const preFiltered = preFilterArticles(deduped).slice(0, MAX_ARTICLES_PER_SCAN);
  console.log(`[NewsFeedScanner] ${deduped.length} unique → ${preFiltered.length} passed keyword filter → classifying with GPT`);

  let totalSaved = 0;

  for (let i = 0; i < preFiltered.length; i += BATCH_SIZE) {
    const batch = preFiltered.slice(i, i + BATCH_SIZE);
    const classified = await classifyArticleBatch(batch, "office_news");
    const batchSaved = await saveSignals(batch, classified, "news_rss");
    totalSaved += batchSaved;
    if (i + BATCH_SIZE < preFiltered.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`[NewsFeedScanner] Office news scan complete. Saved ${totalSaved} new signals from ${preFiltered.length} filtered articles.`);
  return { saved: totalSaved, processed: preFiltered.length };
}

export async function runJobSignalScan(): Promise<{ saved: number; processed: number }> {
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

  const rssFetches = await Promise.allSettled(
    queries.map((q) =>
      fetchRSS(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-AU&gl=AU&ceid=AU:en`,
        `Google News (Jobs)`,
      ),
    ),
  );

  for (const result of rssFetches) {
    if (result.status === "fulfilled") allItems.push(...result.value);
  }

  const deduped = deduplicateItems(allItems);
  const preFiltered = preFilterArticles(deduped).slice(0, MAX_ARTICLES_PER_SCAN);
  console.log(`[NewsFeedScanner] ${deduped.length} unique → ${preFiltered.length} passed keyword filter → classifying with GPT`);

  let totalSaved = 0;

  for (let i = 0; i < preFiltered.length; i += BATCH_SIZE) {
    const batch = preFiltered.slice(i, i + BATCH_SIZE);
    const classified = await classifyArticleBatch(batch, "job_signal");
    const batchSaved = await saveSignals(batch, classified, "job_signal");
    totalSaved += batchSaved;
    if (i + BATCH_SIZE < preFiltered.length) await sleep(BATCH_DELAY_MS);
  }

  console.log(`[NewsFeedScanner] Job signal scan complete. Saved ${totalSaved} new signals from ${preFiltered.length} filtered articles.`);
  return { saved: totalSaved, processed: preFiltered.length };
}
