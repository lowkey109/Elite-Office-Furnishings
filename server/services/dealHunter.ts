// ─── AI Deal Hunter Engine ─────────────────────────────────────────────────────
// Real-data-only Deal Hunter for Australian commercial office signals.
// Uses Adzuna live job data + live property / lease RSS signals,
// scores opportunities, deduplicates them, enriches them lightly,
// and routes them into TCD workflows.

import { storage } from "../storage";
import type { DealHunterSignal } from "@shared/schema";

type SignalType =
  | "hiring_growth"
  | "funding"
  | "lease_activity"
  | "relocation_signal"
  | "new_office_signal"
  | "coworking_exit"
  | "facilities_hiring"
  | "building_move_signal"
  | "industry_growth"
  | "other_growth_indicator";

type SignalSource =
  | "seek.com.au"
  | "linkedin.com"
  | "domain.com.au"
  | "afr.com"
  | "asx.com.au"
  | "crunchbase.com"
  | "press_release"
  | "manual_import"
  | "real_estate_au"
  | "adzuna"
  | "news.google.com";

interface RawSignalProfile {
  companyName: string;
  companyDomain: string;
  city: string;
  state: string;
  industry: string;
  employeeEstimate: number;
  growthRateEstimate: number;
  signalType: SignalType;
  signalSubtype: string;
  signalSource: SignalSource;
  sourceUrl?: string;
  rawPayloadSummary: string;
  jobPostingsCount?: number;
  fundingAmountM?: number;
  leaseExpiryMonths?: number;
  hasOfficeRole?: boolean;
  hasFacilitiesRole?: boolean;
  hasWorkplaceRole?: boolean;
  knownOfficeActivity?: boolean;
  estimatedWorkspaceSqmHint?: number | null;
  estimatedProjectValueHint?: number | null;
  publishedAt?: string;
}

interface DecisionMakerCandidate {
  fullName?: string;
  role: string;
  email?: string;
  source: "company_website" | "linkedin_public" | "news_public";
  publiclyListedEmail: boolean;
}

interface PublicPageCandidate {
  url: string;
  label: "homepage" | "about" | "team" | "leadership" | "contact" | "careers";
}

interface StoredDecisionMakerPayload {
  best: DecisionMakerCandidate | null;
  all: DecisionMakerCandidate[];
}

interface SignalScore {
  score: number;
  confidence: number;
  reasoning: string[];
}

interface RssItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  source?: string;
}

const COUNTRY = "Australia";
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; TCD-DealHunter/2.0)";
const MAX_DECISION_MAKER_PAGES = 4;
const DEFAULT_SCAN_BATCH_SIZE = 3;
const RAW_DEDUPE_TTL_DAYS = 14;

const ALLOWED_SOURCE_URL_HOSTS = [
  "adzuna.com",
  "adzuna.com.au",
  "seek.com.au",
  "linkedin.com",
  "indeed.com",
  "domain.com.au",
  "realestate.com.au",
  "realcommercial.com.au",
  "commercialrealestate.com.au",
  "afr.com",
  "asx.com.au",
  "crunchbase.com",
  "news.google.com",
] as const;

const BLOCKED_MARKERS = [
  "demo",
  "mock",
  "synthetic",
  "fake",
  "seed",
  "test",
] as const;

const EXCLUDED_COMPANY_MARKERS = [
  "confidential",
  "undisclosed",
  "anonymous",
  "private advertiser",
  "private company",
  "n/a",
] as const;

const OFFICE_INTENT_KEYWORDS = [
  "office",
  "workplace",
  "facilities",
  "facility",
  "office manager",
  "facilities manager",
  "workplace manager",
  "workplace experience",
  "property manager",
  "operations manager",
  "head of operations",
  "office coordinator",
  "site manager",
  "administration manager",
] as const;

const INDUSTRY_KEYWORDS: Array<{ match: RegExp; industry: string }> = [
  { match: /(software|saas|developer|engineering|data|cloud|product|technology|it)/i, industry: "Technology" },
  { match: /(finance|bank|fintech|payments|insurance|wealth|accounting)/i, industry: "Financial Services" },
  { match: /(health|medical|clinic|hospital|pharma|healthcare)/i, industry: "Healthcare" },
  { match: /(property|real estate|construction|developer|architecture)/i, industry: "Property / Construction" },
  { match: /(legal|law|lawyer|solicitor)/i, industry: "Legal" },
  { match: /(marketing|agency|creative|media|advertising)/i, industry: "Marketing / Creative" },
  { match: /(logistics|supply chain|warehouse|transport|freight)/i, industry: "Logistics" },
  { match: /(education|school|university|training)/i, industry: "Education" },
  { match: /(retail|ecommerce|e-commerce|consumer)/i, industry: "Retail / Commerce" },
  { match: /(hr|people|recruitment|talent)/i, industry: "Recruitment / HR" },
];

const PROPERTY_FEED_QUERIES = [
  'site:afr.com OR site:realcommercial.com.au OR site:commercialrealestate.com.au office lease Australia',
  'site:afr.com OR site:realcommercial.com.au OR site:commercialrealestate.com.au company relocates office Australia',
  'site:afr.com OR site:realcommercial.com.au OR site:commercialrealestate.com.au new headquarters Australia',
  'site:afr.com OR site:realcommercial.com.au OR site:commercialrealestate.com.au office fitout Australia',
];

const ADZUNA_SEARCH_TERMS = [
  '"office manager"',
  '"facilities manager"',
  '"workplace manager"',
  '"operations manager" office',
  '"property manager" office',
  '"office coordinator"',
];

// ─── General helpers ──────────────────────────────────────────────────────────

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[]";
  }
}

function normalizeDomain(input: string): string {
  const cleaned = cleanText(input);
  if (!cleaned) return "";

  try {
    const withProto = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    const url = new URL(withProto);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return cleaned
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/.*$/i, "")
      .toLowerCase();
  }
}

function getHostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return normalizeDomain(url);
  }
}

function isAllowedSourceUrl(url: string): boolean {
  const domain = getHostnameFromUrl(url);
  return ALLOWED_SOURCE_URL_HOSTS.some(
    (host) => domain === host || domain.endsWith(`.${host}`)
  );
}

function looksLikeExcludedCompanyName(name: string): boolean {
  const lower = name.toLowerCase();
  return EXCLUDED_COMPANY_MARKERS.some((m) => lower.includes(m));
}

function hasBlockedMarker(value: string): boolean {
  const lower = value.toLowerCase();
  return BLOCKED_MARKERS.some((marker) => lower.includes(marker));
}

function assertRealSignal(profile: RawSignalProfile): void {
  if (!profile.companyName || profile.companyName.length < 2) {
    throw new Error("Invalid company");
  }

  if (looksLikeExcludedCompanyName(profile.companyName)) {
    throw new Error("Blocked company");
  }

  if (!profile.rawPayloadSummary || cleanText(profile.rawPayloadSummary).length < 8) {
    throw new Error("Missing summary");
  }

  if (!profile.sourceUrl || !isAllowedSourceUrl(profile.sourceUrl)) {
    throw new Error("Untrusted source");
  }

  const combined = `${profile.companyName} ${profile.rawPayloadSummary} ${profile.sourceUrl}`;
  if (hasBlockedMarker(combined)) {
    throw new Error("Blocked marker detected");
  }
}

function countKeywordHits(text: string, keywords: readonly string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((count, keyword) => count + (lower.includes(keyword) ? 1 : 0), 0);
}

function normalizeAustralianState(input: string): string {
  const value = cleanText(input).toUpperCase();

  if (["QLD", "NSW", "VIC", "WA", "SA", "TAS", "ACT", "NT"].includes(value)) {
    return value;
  }

  if (value.includes("QUEENSLAND")) return "QLD";
  if (value.includes("NEW SOUTH WALES")) return "NSW";
  if (value.includes("VICTORIA")) return "VIC";
  if (value.includes("WESTERN AUSTRALIA")) return "WA";
  if (value.includes("SOUTH AUSTRALIA")) return "SA";
  if (value.includes("TASMANIA")) return "TAS";
  if (value.includes("AUSTRALIAN CAPITAL TERRITORY")) return "ACT";
  if (value.includes("NORTHERN TERRITORY")) return "NT";

  return value;
}

function inferIndustry(title: string, description: string): string {
  const haystack = `${title} ${description}`;

  for (const rule of INDUSTRY_KEYWORDS) {
    if (rule.match.test(haystack)) return rule.industry;
  }

  return "Unknown";
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const map = new Map<string, T>();

  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, item);
  }

  return [...map.values()];
}

function toIsoOrUndefined(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function daysSince(dateValue?: string | Date | null): number {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  const date = new Date(dateValue);
  const time = date.getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / (1000 * 60 * 60 * 24);
}

function buildRawSignalKey(profile: RawSignalProfile): string {
  return [
    cleanText(profile.companyName).toLowerCase(),
    cleanText(profile.city).toLowerCase(),
    cleanText(profile.state).toLowerCase(),
    cleanText(profile.signalType).toLowerCase(),
    cleanText(profile.signalSubtype).toLowerCase(),
    normalizeDomain(profile.sourceUrl ?? ""),
  ].join("|");
}

// ─── RSS / property helpers ───────────────────────────────────────────────────

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-");
}

function stripHtml(input: string): string {
  return decodeHtmlEntities(
    String(input ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractTagValue(block: string, tag: string): string {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cdataRegex = new RegExp(`<${escapedTag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escapedTag}>`, "i");
  const plainRegex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i");

  const cdata = block.match(cdataRegex)?.[1];
  if (cdata) return cleanText(stripHtml(cdata));

  const plain = block.match(plainRegex)?.[1];
  return cleanText(stripHtml(plain ?? ""));
}

function parseRssItems(xml: string): RssItem[] {
  if (!xml || typeof xml !== "string") return [];

  const itemMatches = Array.from(xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi));

  return itemMatches
    .map((match) => {
      const block = match[1] ?? "";
      return {
        title: extractTagValue(block, "title"),
        link: extractTagValue(block, "link"),
        pubDate: extractTagValue(block, "pubDate"),
        description: extractTagValue(block, "description"),
        source: extractTagValue(block, "source"),
      };
    })
    .filter((item) => item.title && item.link);
}

async function fetchTextWithTimeout(url: string, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
      },
    });

    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function inferPropertySignalType(title: string, description: string): SignalType | null {
  const haystack = `${title} ${description}`.toLowerCase();

  if (
    /(lease|leasing|leased|tenancy|tenanted|sqm|square metres|square meters|premises|office tower|commercial office|workplace hub)/i.test(
      haystack
    )
  ) {
    return "lease_activity";
  }

  if (/(relocat|move into|moving into|new hq|new headquarters|new office)/i.test(haystack)) {
    return "relocation_signal";
  }

  if (/(fitout|fit-out|fit out|refurbishment|workspace upgrade|office refresh)/i.test(haystack)) {
    return "new_office_signal";
  }

  if (/(building move|office opening|opens new office|expands into)/i.test(haystack)) {
    return "building_move_signal";
  }

  return null;
}

function inferPropertySignalSubtype(title: string, description: string): string {
  const haystack = `${title} ${description}`.toLowerCase();

  if (/(new hq|new headquarters)/i.test(haystack)) return "new_hq";
  if (/(lease|leasing|leased)/i.test(haystack)) return "commercial_lease";
  if (/(relocat|moving into|move into)/i.test(haystack)) return "office_relocation";
  if (/(fitout|fit-out|fit out)/i.test(haystack)) return "office_fitout";
  if (/(expands into|opens new office)/i.test(haystack)) return "office_expansion";

  return "property_signal";
}

function looksLikePropertySignal(title: string, description: string): boolean {
  const haystack = `${title} ${description}`.toLowerCase();

  return (
    /(office|hq|headquarters|workspace|commercial property|commercial office|lease|leasing|leased|fitout|fit-out|fit out|premises|tenant|tenancy|sqm|square metre|square meter|relocation|move)/i.test(
      haystack
    ) &&
    /(australia|brisbane|sydney|melbourne|perth|adelaide|fortitude valley|cbd|nsw|qld|vic|wa|sa|act|canberra|gold coast)/i.test(
      haystack
    )
  );
}

function inferCityFromPropertyText(title: string, description: string): string {
  const haystack = `${title} ${description}`.toLowerCase();

  if (haystack.includes("fortitude valley")) return "Brisbane";
  if (haystack.includes("brisbane")) return "Brisbane";
  if (haystack.includes("sydney")) return "Sydney";
  if (haystack.includes("melbourne")) return "Melbourne";
  if (haystack.includes("perth")) return "Perth";
  if (haystack.includes("adelaide")) return "Adelaide";
  if (haystack.includes("canberra")) return "Canberra";
  if (haystack.includes("gold coast")) return "Gold Coast";

  return "Australia";
}

function inferStateFromPropertyText(title: string, description: string): string {
  const haystack = `${title} ${description}`.toLowerCase();

  if (haystack.includes("brisbane") || haystack.includes("queensland") || /\bqld\b/i.test(haystack)) return "QLD";
  if (haystack.includes("sydney") || haystack.includes("new south wales") || /\bnsw\b/i.test(haystack)) return "NSW";
  if (haystack.includes("melbourne") || haystack.includes("victoria") || /\bvic\b/i.test(haystack)) return "VIC";
  if (haystack.includes("perth") || haystack.includes("western australia") || /\bwa\b/i.test(haystack)) return "WA";
  if (haystack.includes("adelaide") || haystack.includes("south australia") || /\bsa\b/i.test(haystack)) return "SA";
  if (haystack.includes("canberra") || /\bact\b/i.test(haystack)) return "ACT";

  return "";
}

function extractCompanyNameFromHeadline(title: string): string {
  const cleaned = cleanText(title)
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s+\|\s+.*$/, "")
    .replace(/\s+—\s+.*$/, "")
    .trim();

  const patterns = [
    /^(.+?)\s+(leases|lease|leased|relocates|relocating|moves|moving|opens|opening|expands|expanding|takes|taking)\b/i,
    /^(.+?)\s+(signs|signed)\s+(a\s+)?(new\s+)?lease\b/i,
    /^(.+?)\s+(to|will)\s+(move|relocate|open)\b/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }

  return cleanText(cleaned.split(" ").slice(0, 4).join(" "));
}

function estimateWorkspaceFromPropertyText(title: string, description: string): number | null {
  const haystack = `${title} ${description}`;
  const sqmMatch = haystack.match(/(\d{2,5})\s*(sqm|square metres|square meters)/i);

  if (sqmMatch?.[1]) {
    return safeNumber(sqmMatch[1], 0);
  }

  return null;
}

function estimateProjectValueFromPropertySignal(
  sqm: number | null,
  signalType: SignalType
): number | null {
  if (!sqm || sqm <= 0) return null;

  const rate =
    signalType === "lease_activity" || signalType === "relocation_signal" ? 1100 : 900;

  return Math.round((sqm * rate) / 5000) * 5000;
}

function inferPropertySignalSource(url: string): SignalSource {
  const hostname = getHostnameFromUrl(url);

  if (hostname.includes("afr.com")) return "afr.com";
  if (hostname.includes("domain.com.au")) return "domain.com.au";
  if (hostname.includes("news.google.com")) return "news.google.com";

  return "real_estate_au";
}

// ─── Job signal helpers ───────────────────────────────────────────────────────

function extractAreaLocation(job: any): { city: string; state: string } {
  const area = Array.isArray(job?.location?.area) ? job.location.area : [];
  const city = cleanText(area[2] ?? area[1] ?? area[0] ?? "Australia");
  const state = cleanText(area[1] ?? "");
  return { city, state };
}

function shouldKeepJobSignal(title: string, description: string): boolean {
  const haystack = `${title} ${description}`.toLowerCase();
  const keywordHits = countKeywordHits(haystack, OFFICE_INTENT_KEYWORDS);

  if (keywordHits >= 1) return true;

  if (
    haystack.includes("operations") &&
    (haystack.includes("site") || haystack.includes("office") || haystack.includes("workplace"))
  ) {
    return true;
  }

  return false;
}

function detectSignalType(title: string, description: string): SignalType {
  const haystack = `${title} ${description}`.toLowerCase();

  if (haystack.includes("facilities")) return "facilities_hiring";
  if (haystack.includes("workplace")) return "new_office_signal";
  if (haystack.includes("office")) return "hiring_growth";

  return "other_growth_indicator";
}

function detectSignalSubtype(title: string, description: string): string {
  const haystack = `${title} ${description}`.toLowerCase();

  if (haystack.includes("facilities manager")) return "facilities_manager_hiring";
  if (haystack.includes("workplace manager")) return "workplace_manager_hiring";
  if (haystack.includes("office manager")) return "office_manager_hiring";
  if (haystack.includes("property manager")) return "property_manager_hiring";
  if (haystack.includes("operations manager")) return "operations_manager_hiring";

  return "office_related_hiring";
}

function estimateEmployeeRange(companyName: string, title: string, description: string): number {
  const haystack = `${companyName} ${title} ${description}`.toLowerCase();

  if (/(enterprise|national|global|group)/i.test(haystack)) return 500;
  if (/(manager|head of|lead)/i.test(haystack)) return 120;
  return 60;
}

function estimateGrowthRate(title: string, description: string): number {
  const haystack = `${title} ${description}`.toLowerCase();

  if (haystack.includes("expansion") || haystack.includes("growth")) return 25;
  if (haystack.includes("new office") || haystack.includes("scale")) return 20;
  return 12;
}

function tryExtractCompanyDomainFromDescription(description: string): string {
  const match = cleanText(description).match(
    /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z]{2,})(?:\/[^\s]*)?/i
  );

  if (!match?.[1]) return "";

  const domain = normalizeDomain(match[1]);
  if (!domain) return "";
  if (isAllowedSourceUrl(`https://${domain}`)) return "";

  return domain;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchAdzunaPage(searchTerm: string, page: number): Promise<any[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) return [];

  const url =
    `https://api.adzuna.com/v1/api/jobs/au/search/${page}` +
    `?app_id=${encodeURIComponent(appId)}` +
    `&app_key=${encodeURIComponent(appKey)}` +
    `&results_per_page=50` +
    `&what=${encodeURIComponent(searchTerm)}` +
    `&sort_by=date` +
    `&content-type=application/json`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "application/json",
      },
    });

    if (response.status === 429) {
      console.warn("[DealHunter] Adzuna 429 rate limit hit — backing off 5s", { searchTerm, page });
      await new Promise((r) => setTimeout(r, 5000));
      return [];
    }
    if (!response.ok) {
      console.error("[DealHunter] Adzuna fetch failed:", response.status, response.statusText, { searchTerm, page });
      return [];
    }

    const data = await response.json();
    return Array.isArray(data?.results) ? data.results : [];
  } catch (error) {
    console.error("[DealHunter] Adzuna fetch error:", { searchTerm, page, error });
    return [];
  }
}

async function fetchJobSignals(): Promise<RawSignalProfile[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  console.log("[DealHunter] ENV CHECK:", {
    ADZUNA_APP_ID: appId ? "SET" : "MISSING",
    ADZUNA_APP_KEY: appKey ? "SET" : "MISSING",
  });

  if (!appId || !appKey) {
    console.warn("[DealHunter] Missing ADZUNA_APP_ID / ADZUNA_APP_KEY");
    return [];
  }

  const pagesToFetch = [1, 2];
  const allJobs: any[] = [];
  for (const term of ADZUNA_SEARCH_TERMS) {
    for (const page of pagesToFetch) {
      const results = await fetchAdzunaPage(term, page);
      allJobs.push(...results);
      await new Promise((r) => setTimeout(r, 1200)); // always pace between Adzuna requests
    }
  }

  const jobs = allJobs;
  console.log("[DealHunter] Jobs fetched:", jobs.length);

  const signals: RawSignalProfile[] = [];
  let skippedMissing = 0;
  let skippedUntrusted = 0;
  let skippedIrrelevant = 0;
  let skippedBlocked = 0;

  for (const job of jobs) {
    const companyName = cleanText(job?.company?.display_name);
    const rawTitle = cleanText(job?.title);
    const rawDescription = cleanText(job?.description);
    const title = rawTitle.toLowerCase();
    const description = rawDescription.toLowerCase();
    const redirectUrl = cleanText(job?.redirect_url);
    const jobId = cleanText(job?.id);
    // Use canonical Adzuna listing URL so the trusted-source check always passes for Adzuna jobs.
    const sourceUrl = jobId
      ? `https://www.adzuna.com.au/details/${jobId}`
      : redirectUrl;
    const publishedAt = cleanText(job?.created);

    if (!companyName || !rawTitle || !sourceUrl) {
      skippedMissing++;
      continue;
    }

    if (!/^https?:\/\//i.test(sourceUrl) || !isAllowedSourceUrl(sourceUrl)) {
      skippedUntrusted++;
      continue;
    }

    if (!shouldKeepJobSignal(title, description)) {
      skippedIrrelevant++;
      continue;
    }

    const { city, state } = extractAreaLocation(job);
    const signalType = detectSignalType(title, description);
    const signalSubtype = detectSignalSubtype(title, description);

    const profile: RawSignalProfile = {
      companyName,
      companyDomain: tryExtractCompanyDomainFromDescription(rawDescription),
      city,
      state: normalizeAustralianState(state),
      industry: inferIndustry(rawTitle, rawDescription),
      employeeEstimate: estimateEmployeeRange(companyName, rawTitle, rawDescription),
      growthRateEstimate: estimateGrowthRate(rawTitle, rawDescription),
      signalType,
      signalSubtype,
      signalSource: "adzuna",
      sourceUrl,
      rawPayloadSummary: `${companyName} hiring: ${rawTitle}${rawDescription ? ` — ${cleanText(rawDescription).slice(0, 280)}` : ""}`,
      jobPostingsCount: 1,
      hasFacilitiesRole: /facilities/i.test(rawTitle) || /facilities/i.test(rawDescription),
      hasWorkplaceRole: /workplace/i.test(rawTitle) || /workplace/i.test(rawDescription),
      hasOfficeRole: /office/i.test(rawTitle) || /office/i.test(rawDescription),
      knownOfficeActivity:
        /office|workplace|facilities|property|site/i.test(rawTitle) ||
        /office|workplace|facilities|property|site/i.test(rawDescription),
      publishedAt: toIsoOrUndefined(publishedAt),
    };

    try {
      assertRealSignal(profile);
      signals.push(profile);
    } catch {
      skippedBlocked++;
    }
  }

  const deduped = uniqueBy(signals, buildRawSignalKey);

  console.log("[DealHunter] Job filter summary:", {
    kept: deduped.length,
    skippedMissing,
    skippedUntrusted,
    skippedIrrelevant,
    skippedBlocked,
  });

  return deduped;
}

async function fetchPropertyLeaseSignals(): Promise<RawSignalProfile[]> {
  const feedUrls = PROPERTY_FEED_QUERIES.map(
    (query) =>
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-AU&gl=AU&ceid=AU:en`
  );

  const allItems: RssItem[] = [];

  for (const feedUrl of feedUrls) {
    const xml = await fetchTextWithTimeout(feedUrl, DEFAULT_FETCH_TIMEOUT_MS);
    if (!xml) continue;
    allItems.push(...parseRssItems(xml));
  }

  const uniqueItems = uniqueBy(
    allItems.filter((item) => item.title && item.link),
    (item) => `${item.title.toLowerCase()}|${item.link.toLowerCase()}`
  );

  const signals: RawSignalProfile[] = [];

  for (const item of uniqueItems) {
    const title = cleanText(item.title);
    const description = cleanText(item.description);
    const sourceUrl = cleanText(item.link);

    if (!title || !sourceUrl) continue;
    if (!/^https?:\/\//i.test(sourceUrl)) continue;
    if (!isAllowedSourceUrl(sourceUrl)) continue;
    if (!looksLikePropertySignal(title, description)) continue;

    const signalType = inferPropertySignalType(title, description);
    if (!signalType) continue;

    const companyName = extractCompanyNameFromHeadline(title);
    if (!companyName || looksLikeExcludedCompanyName(companyName)) continue;

    const city = inferCityFromPropertyText(title, description);
    const state = inferStateFromPropertyText(title, description);
    const industry = inferIndustry(title, description);
    const sqm = estimateWorkspaceFromPropertyText(title, description);
    const employeeEstimate = sqm ? Math.max(20, Math.round(sqm / 10)) : 80;
    const estimatedValue = estimateProjectValueFromPropertySignal(sqm, signalType);

    const profile: RawSignalProfile = {
      companyName,
      companyDomain: "",
      city,
      state,
      industry,
      employeeEstimate,
      growthRateEstimate: 18,
      signalType,
      signalSubtype: inferPropertySignalSubtype(title, description),
      signalSource: inferPropertySignalSource(sourceUrl),
      sourceUrl,
      rawPayloadSummary: `${title}${description ? ` — ${description}` : ""}`,
      jobPostingsCount: 0,
      hasOfficeRole: true,
      hasFacilitiesRole: false,
      hasWorkplaceRole: /workplace|fitout|fit-out|fit out/i.test(`${title} ${description}`),
      knownOfficeActivity: true,
      estimatedWorkspaceSqmHint: sqm,
      estimatedProjectValueHint: estimatedValue,
      publishedAt: toIsoOrUndefined(item.pubDate),
    };

    try {
      assertRealSignal(profile);
      signals.push(profile);
    } catch {
      // ignore blocked records
    }
  }

  const deduped = uniqueBy(signals, buildRawSignalKey);

  console.log("[DealHunter] Property/lease feeds fetched:", {
    feeds: feedUrls.length,
    items: uniqueItems.length,
    kept: deduped.length,
  });

  return deduped;
}

// ─── Enrichment helpers ───────────────────────────────────────────────────────

function buildCandidatePages(domain: string): PublicPageCandidate[] {
  const normalized = normalizeDomain(domain);
  if (!normalized || !normalized.includes(".")) return [];

  const base = `https://${normalized}`;

  return [
    { url: base, label: "homepage" },
    { url: `${base}/about`, label: "about" },
    { url: `${base}/about-us`, label: "about" },
    { url: `${base}/team`, label: "team" },
    { url: `${base}/leadership`, label: "leadership" },
    { url: `${base}/our-team`, label: "team" },
    { url: `${base}/contact`, label: "contact" },
    { url: `${base}/careers`, label: "careers" },
  ];
}

function extractPublicEmails(text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return Array.from(new Set(matches.map((e) => e.toLowerCase())));
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) return "";

    const html = await res.text();

    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

async function findDecisionMakers(
  _companyName: string,
  companyDomain?: string
): Promise<DecisionMakerCandidate[]> {
  const normalizedDomain = normalizeDomain(companyDomain ?? "");
  const results: DecisionMakerCandidate[] = [];

  if (!normalizedDomain || !normalizedDomain.includes(".")) {
    return [
      {
        role: "Facilities Manager",
        source: "linkedin_public",
        publiclyListedEmail: false,
      },
      {
        role: "Operations Manager",
        source: "linkedin_public",
        publiclyListedEmail: false,
      },
      {
        role: "Office Manager",
        source: "linkedin_public",
        publiclyListedEmail: false,
      },
    ];
  }

  const pages = buildCandidatePages(normalizedDomain).slice(0, MAX_DECISION_MAKER_PAGES);

  for (const page of pages) {
    const text = await fetchPageText(page.url);
    if (!text) continue;

    const emails = extractPublicEmails(text);
    const publicEmail = emails[0];

    if (/facilities/i.test(text)) {
      results.push({
        role: "Facilities Manager",
        email: publicEmail,
        source: "company_website",
        publiclyListedEmail: Boolean(publicEmail),
      });
    }

    if (/operations/i.test(text)) {
      results.push({
        role: "Operations Manager",
        email: publicEmail,
        source: "company_website",
        publiclyListedEmail: Boolean(publicEmail),
      });
    }

    if (/workplace/i.test(text)) {
      results.push({
        role: "Workplace Manager",
        email: publicEmail,
        source: "company_website",
        publiclyListedEmail: Boolean(publicEmail),
      });
    }

    if (/office manager/i.test(text)) {
      results.push({
        role: "Office Manager",
        email: publicEmail,
        source: "company_website",
        publiclyListedEmail: Boolean(publicEmail),
      });
    }

    if (results.length > 0) break;
  }

  if (!results.length) {
    results.push(
      {
        role: "Facilities Manager",
        source: "linkedin_public",
        publiclyListedEmail: false,
      },
      {
        role: "Operations Manager",
        source: "linkedin_public",
        publiclyListedEmail: false,
      }
    );
  }

  return uniqueBy(
    results,
    (dm) => `${dm.role.toLowerCase()}|${(dm.email ?? "").toLowerCase()}|${dm.source}`
  );
}

function rankDecisionMaker(dm: DecisionMakerCandidate): number {
  const role = dm.role.toLowerCase();

  if (role.includes("facilities")) return 100;
  if (role.includes("workplace")) return 90;
  if (role.includes("office manager")) return 85;
  if (role.includes("operations")) return 80;

  return 50;
}

function pickBestDecisionMaker(
  decisionMakers: DecisionMakerCandidate[]
): DecisionMakerCandidate | null {
  if (!decisionMakers.length) return null;

  return [...decisionMakers].sort((a, b) => {
    const scoreDiff = rankDecisionMaker(b) - rankDecisionMaker(a);
    if (scoreDiff !== 0) return scoreDiff;
    return Number(b.publiclyListedEmail) - Number(a.publiclyListedEmail);
  })[0];
}

function parseStoredDecisionMakers(
  raw: string | null | undefined
): StoredDecisionMakerPayload {
  if (!raw) return { best: null, all: [] };

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return { best: parsed[0] ?? null, all: parsed };
    }

    return {
      best: parsed?.best ?? null,
      all: Array.isArray(parsed?.all) ? parsed.all : [],
    };
  } catch {
    return { best: null, all: [] };
  }
}

// ─── Scoring / inference ──────────────────────────────────────────────────────

function scoreSignal(profile: RawSignalProfile): SignalScore {
  let score = 0;
  const reasoning: string[] = [];

  const typeScores: Record<SignalType, number> = {
    relocation_signal: 28,
    building_move_signal: 24,
    lease_activity: 26,
    coworking_exit: 20,
    funding: 16,
    new_office_signal: 22,
    hiring_growth: 14,
    facilities_hiring: 18,
    industry_growth: 8,
    other_growth_indicator: 6,
  };

  const typeScore = typeScores[profile.signalType] ?? 6;
  score += typeScore;
  reasoning.push(`${profile.signalType.replace(/_/g, " ")} signal (+${typeScore})`);

  if (profile.jobPostingsCount) {
    if (profile.jobPostingsCount >= 20) {
      score += 8;
      reasoning.push(`${profile.jobPostingsCount} postings — hiring surge (+8)`);
    } else if (profile.jobPostingsCount >= 5) {
      score += 4;
      reasoning.push(`${profile.jobPostingsCount} postings — hiring trend (+4)`);
    } else if (profile.jobPostingsCount > 0) {
      score += 2;
      reasoning.push("Live hiring signal detected (+2)");
    }
  }

  if (profile.signalType === "lease_activity") {
    score += 10;
    reasoning.push("Commercial lease activity detected (+10)");
  }

  if (profile.signalType === "relocation_signal") {
    score += 12;
    reasoning.push("Office relocation signal detected (+12)");
  }

  if (profile.signalType === "new_office_signal") {
    score += 10;
    reasoning.push("New office / fit-out signal detected (+10)");
  }

  if (profile.hasFacilitiesRole) {
    score += 12;
    reasoning.push("Facilities role detected (+12)");
  }

  if (profile.hasWorkplaceRole) {
    score += 12;
    reasoning.push("Workplace role detected (+12)");
  }

  if (profile.hasOfficeRole) {
    score += 8;
    reasoning.push("Office role detected (+8)");
  }

  if (profile.knownOfficeActivity) {
    score += 8;
    reasoning.push("Office activity context detected (+8)");
  }

  if (profile.employeeEstimate >= 500) {
    score += 8;
    reasoning.push(`Larger company (${profile.employeeEstimate} staff) (+8)`);
  } else if (profile.employeeEstimate >= 150) {
    score += 5;
    reasoning.push(`Mid-market company (${profile.employeeEstimate} staff) (+5)`);
  } else if (profile.employeeEstimate >= 50) {
    score += 3;
    reasoning.push(`SME opportunity (${profile.employeeEstimate} staff) (+3)`);
  }

  if (profile.growthRateEstimate >= 25) {
    score += 6;
    reasoning.push(`Higher growth estimate (${profile.growthRateEstimate}%) (+6)`);
  } else if (profile.growthRateEstimate >= 10) {
    score += 3;
    reasoning.push(`Growth estimate (${profile.growthRateEstimate}%) (+3)`);
  }

  if (profile.sourceUrl) {
    score += 5;
    reasoning.push("Trusted live source URL (+5)");
  }

  score = clampNumber(score, 0, 100);

  let confidence = 50;
  if (profile.hasFacilitiesRole || profile.hasWorkplaceRole) confidence += 15;
  if (profile.hasOfficeRole) confidence += 10;
  if (profile.sourceUrl) confidence += 10;
  if (profile.knownOfficeActivity) confidence += 10;

  if (
    profile.signalType === "lease_activity" ||
    profile.signalType === "relocation_signal" ||
    profile.signalType === "new_office_signal"
  ) {
    confidence += 15;
  }

  confidence = clampNumber(confidence, 0, 95);

  return { score, confidence, reasoning };
}

function probabilityTier(score: number): "high" | "medium" | "low" {
  if (score >= 65) return "high";
  if (score >= 42) return "medium";
  return "low";
}

function inferProjectType(profile: RawSignalProfile): string {
  if (
    profile.signalType === "relocation_signal" ||
    profile.signalType === "building_move_signal"
  ) {
    return "relocation";
  }

  if (profile.signalType === "new_office_signal") return "new_office";
  if (profile.signalType === "coworking_exit") return "relocation";
  if (profile.signalType === "lease_activity") return "relocation";

  if (profile.hasFacilitiesRole || profile.hasWorkplaceRole || profile.hasOfficeRole) {
    return "fit_out";
  }

  return "redesign";
}

function inferTimeline(profile: RawSignalProfile, score: number): string {
  if (profile.signalType === "lease_activity") return "0-6 months";
  if (profile.signalType === "relocation_signal") return "0-6 months";
  if (profile.signalType === "new_office_signal") return "3-6 months";
  if (profile.hasFacilitiesRole || profile.hasWorkplaceRole) return "3-6 months";
  if (score >= 65) return "3-6 months";
  if (score >= 45) return "6-12 months";
  return "12+ months";
}

function estimateWorkspaceSqm(employees: number, projectType: string): number {
  const safeEmployees = Math.max(10, employees || 50);
  const sqmPerPerson =
    projectType === "new_office" ? 12 : projectType === "relocation" ? 11 : 10;
  return Math.round(safeEmployees * sqmPerPerson);
}

function estimateProjectValue(sqm: number, tier: string): number {
  const ratePerSqm = tier === "high" ? 1200 : tier === "medium" ? 900 : 650;
  const base = sqm * ratePerSqm;
  return Math.round(base / 5000) * 5000;
}

function buildOutreachDraft(
  profile: RawSignalProfile,
  projectType: string,
  timeline: string
): string {
  const greetingContext: Record<string, string> = {
    relocation: "preparing for an office relocation",
    expansion: "expanding your team and workspace",
    new_office: "setting up a new office",
    fit_out: "planning an office fit-out or workplace upgrade",
    redesign: "reviewing your current workspace setup",
  };

  const context = greetingContext[projectType] ?? "planning a workspace change";

  return `Hi,

I noticed ${profile.companyName} may be ${context} based on recent hiring and workplace signals. With a likely ${timeline} planning window, I thought it made sense to reach out early.

At The Corporate Desk, we help Australian businesses with premium commercial office furniture, fit-outs, and workspace planning.

If useful, we can provide a complimentary workspace strategy session, early budget guidance, and an indicative layout direction for your ${profile.city} team.

Would you be open to a short call this week?

Warm regards,
The Corporate Desk Team
thecorporatedesk.com.au`;
}

function buildRecommendedAction(
  score: number,
  timeline: string,
  profile: RawSignalProfile
): string {
  if (score >= 65 || timeline === "0-6 months" || timeline === "3-6 months") {
    return `PRIORITY: ${
      profile.hasFacilitiesRole || profile.hasWorkplaceRole
        ? "Approach Facilities / Workplace leadership first"
        : "Approach Operations / Office leadership first"
    } — push to pipeline and prepare outreach`;
  }

  if (score >= 40) {
    return "Add to pipeline — prepare outreach and monitor for added move or growth signals";
  }

  return "Keep in watch list — monitor for stronger office or relocation indicators";
}

function buildOutreachAngle(profile: RawSignalProfile, projectType: string): string {
  if (projectType === "relocation") {
    return "Relocation workspace planning — site assessment, budget range, and indicative layout";
  }
  if (projectType === "new_office") {
    return "End-to-end new office setup — workplace planning, furniture supply, and install";
  }
  if (projectType === "fit_out") {
    return "Office fit-out and workplace refresh — early planning before procurement starts";
  }
  return "Workspace strategy session — identify scope, timing, and indicative furniture budget";
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

async function isDeduped(profile: RawSignalProfile): Promise<boolean> {
  const existing = await storage.findDuplicateDealHunterSignal(
    profile.companyName,
    profile.city,
    profile.signalType
  );

  if (!existing) return false;
  return daysSince(existing.createdAt) < RAW_DEDUPE_TTL_DAYS;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export async function runDealHunterScan(
  count = 10
): Promise<{
  created: number;
  deduplicated: number;
  signals: DealHunterSignal[];
}> {
  console.log("[DealHunter] 🚀 STARTING REAL ENGINE");

  const [jobSignals, propertySignals] = await Promise.all([
    fetchJobSignals(),
    fetchPropertyLeaseSignals(),
  ]);

  const rawSignals = uniqueBy([...propertySignals, ...jobSignals], buildRawSignalKey);

  if (!rawSignals.length) {
    console.log("[DealHunter] ❌ No real signals found");
    return { created: 0, deduplicated: 0, signals: [] };
  }

  const ranked = rawSignals
    .map((profile) => {
      const scored = scoreSignal(profile);
      return { profile, ...scored };
    })
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;

      const confidenceDiff = b.confidence - a.confidence;
      if (confidenceDiff !== 0) return confidenceDiff;

      const aAge = daysSince(a.profile.publishedAt);
      const bAge = daysSince(b.profile.publishedAt);
      return aAge - bAge;
    });

  const selected = ranked.slice(0, Math.max(1, count)).map((item) => item.profile);

  let created = 0;
  let deduplicated = 0;
  const results: DealHunterSignal[] = [];

  for (let i = 0; i < selected.length; i += DEFAULT_SCAN_BATCH_SIZE) {
    const batch = selected.slice(i, i + DEFAULT_SCAN_BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (profile) => {
        try {
          assertRealSignal(profile);

          const duplicate = await isDeduped(profile);
          if (duplicate) {
            deduplicated++;
            console.log(
              `[DealHunter] 🟡 DEDUPED: ${profile.companyName} (${profile.city})`
            );
            return null;
          }

          const { score, confidence, reasoning } = scoreSignal(profile);
          const tier = probabilityTier(score);
          const projectType = inferProjectType(profile);
          const timeline = inferTimeline(profile, score);

          const inferredSqm =
            profile.estimatedWorkspaceSqmHint && profile.estimatedWorkspaceSqmHint > 0
              ? profile.estimatedWorkspaceSqmHint
              : null;

          const sqm =
            inferredSqm ??
            estimateWorkspaceSqm(safeNumber(profile.employeeEstimate, 50), projectType);

          const value =
            profile.estimatedProjectValueHint && profile.estimatedProjectValueHint > 0
              ? profile.estimatedProjectValueHint
              : estimateProjectValueFromPropertySignal(sqm, profile.signalType) ??
                estimateProjectValue(sqm, tier);

          let decisionMakers: DecisionMakerCandidate[] = [];
          try {
            decisionMakers = await findDecisionMakers(
              profile.companyName,
              profile.companyDomain
            );
          } catch {
            decisionMakers = [];
          }

          const bestDecisionMaker = pickBestDecisionMaker(decisionMakers);

          const action = bestDecisionMaker?.publiclyListedEmail
            ? `Direct outreach ready → ${bestDecisionMaker.role}${
                bestDecisionMaker.email ? ` (${bestDecisionMaker.email})` : ""
              }`
            : buildRecommendedAction(score, timeline, profile);

          const angle = buildOutreachAngle(profile, projectType);
          const outreach = buildOutreachDraft(profile, projectType, timeline);

          if (!profile.companyName || !profile.city || !profile.sourceUrl) {
            throw new Error("Invalid final payload");
          }

          const signal = await storage.createDealHunterSignal({
            companyName: profile.companyName,
            companyDomain: profile.companyDomain || null,
            city: profile.city,
            state: profile.state || null,
            country: COUNTRY,
            industry: profile.industry,
            employeeEstimate: safeNumber(profile.employeeEstimate, 0),
            growthRateEstimate: safeNumber(profile.growthRateEstimate, 0),
            signalType: profile.signalType,
            signalSubtype: profile.signalSubtype,
            signalSource: profile.signalSource,
            sourceUrl: profile.sourceUrl,
            rawPayloadSummary: profile.rawPayloadSummary,

            signalStrengthScore: typeof  score,
            signalConfidence: confidence,
            reasoningSummary: reasoning.join(" | "),

            estimatedWorkspaceSqm: sqm,
            estimatedProjectValue: value ? Number(value) || null : null,

            relocationProbability:
              tier === "high"
                ? score
                : tier === "medium"
                ? Math.round(score * 0.7)
                : Math.round(score * 0.4),

            officeChangeProbability: score,
            probabilityTier: tier,
            projectType,
            estimatedTimeline: timeline,

            recommendedAction: action,
            recommendedOutreachAngle: angle,
            recommendedContactRolesJson: safeJsonStringify({
              best: bestDecisionMaker,
              all: decisionMakers,
            }),
            outreachDraft: outreach,

            sourceSignalCount: profile.jobPostingsCount ?? 1,
            isReviewed: false,
            pushedToPipeline: false,
            pushedToRadar: false,
            isDuplicate: false,
            status: "new",
          });

          created++;

          console.log(
            `[DealHunter] ✅ CREATED: ${profile.companyName} | score=${score} | ${tier}`
          );

          return signal;
        } catch (err: any) {
          console.error(
            `[DealHunter] ❌ ERROR (${profile.companyName}):`,
            err?.message ?? err
          );
          return null;
        }
      })
    );

    for (const res of batchResults) {
      if (res.status === "fulfilled" && res.value) {
        results.push(res.value);
      }
    }
  }

  console.log("[DealHunter] 📊 COMPLETE:", {
    created,
    deduplicated,
    totalProcessed: selected.length,
    totalCandidates: rawSignals.length,
  });

  return {
    created,
    deduplicated,
    signals: results,
  };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function pushDealHunterToRadar(
  signalId: string
): Promise<{ radarId: string }> {
  const signal = await storage.getDealHunterSignal(signalId);
  if (!signal) throw new Error("Deal hunter signal not found");
  if (signal.pushedToRadar) throw new Error("Already pushed to radar");

  const radar = await storage.createOfficeMovRadarRecord({
    companyName: signal.companyName,
    industry: signal.industry,
    city: signal.city,
    state: signal.state ?? undefined,
    country: signal.country ?? COUNTRY,
    signalType: signal.signalType,
    signalSubtype: signal.signalSubtype ?? undefined,
    signalSource: signal.signalSource,
    sourceUrl: signal.sourceUrl ?? undefined,
    confidenceLevel: signal.probabilityTier,
    estimatedHeadcount: signal.employeeEstimate
      ? String(signal.employeeEstimate)
      : undefined,
    estimatedOfficeSizeSqm: signal.estimatedWorkspaceSqm
      ? String(signal.estimatedWorkspaceSqm)
      : undefined,
    estimatedProjectValue: signal.estimatedProjectValue
      ? `$${signal.estimatedProjectValue.toLocaleString()}`
      : undefined,
    radarScore: signal.signalStrengthScore,
    priority:
      signal.probabilityTier === "high"
        ? "High"
        : signal.probabilityTier === "medium"
        ? "Medium"
        : "Low",
    recommendedOutreachAngle: signal.recommendedOutreachAngle ?? undefined,
    recommendedOffer: "Free office layout plan + workspace strategy session",
    recommendedNextAction: signal.recommendedAction ?? undefined,
    status: "New",
  });

  await storage.updateDealHunterSignal(signalId, {
    pushedToRadar: true,
    linkedRadarId: radar.id,
    updatedAt: new Date(),
  } as any);

  return { radarId: radar.id };
}

export async function pushDealHunterToPipeline(
  signalId: string
): Promise<{ prospectId: string }> {
  const signal = await storage.getDealHunterSignal(signalId);
  if (!signal) throw new Error("Deal hunter signal not found");
  if (signal.pushedToPipeline) throw new Error("Already pushed to pipeline");

  const parsed = parseStoredDecisionMakers(signal.recommendedContactRolesJson);
  const best = parsed.best;
  const all = parsed.all;

  const prospect = await storage.createProspectedLead({
    company: signal.companyName,
    domain: signal.companyDomain ?? undefined,
    website: signal.companyDomain ? `https://${signal.companyDomain}` : null,
    location: `${signal.city}, ${signal.state ?? "AU"}`,
    industry: signal.industry,
    estimatedTeamSize: signal.employeeEstimate
      ? String(signal.employeeEstimate)
      : "Unknown",
    likelyOfficeNeed: signal.projectType ?? undefined,
    signalsDetected: [signal.signalType],
    estimatedProjectValue: signal.estimatedProjectValue
      ? `$${signal.estimatedProjectValue.toLocaleString()}`
      : "$0",
    score: signal.signalStrengthScore,
    priority:
      signal.probabilityTier === "high"
        ? "High"
        : signal.probabilityTier === "medium"
        ? "Medium"
        : "Low",
    decisionMakers: safeJsonStringify(
      all.map((dm) => ({
        role: dm.role,
        name: dm.fullName ?? "Unknown",
        email: dm.email ?? null,
        source: dm.source,
        publiclyListedEmail: dm.publiclyListedEmail,
      }))
    ),
    outreachMessage:
      signal.outreachDraft ??
      `Outreach to ${signal.companyName} regarding ${signal.projectType ?? "office project"}`,
    reasoning:
      signal.reasoningSummary ??
      `${signal.signalType} signal detected from ${signal.signalSource}`,
    rawInput: safeJsonStringify({
      signalId: signal.id,
      source: signal.signalSource,
      payload: signal.rawPayloadSummary,
      bestDecisionMaker: best,
      allDecisionMakers: all,
    }),
    sourceType: "deal_hunter",
    sourceUrl: signal.sourceUrl ?? null,
    signalType: signal.signalType,
    city: signal.city,
    contactEmail: best?.email ?? null,
    contactRole: best?.role ?? null,
    dealProbability: signal.officeChangeProbability ?? null,
    estimatedOfficeSqm: signal.estimatedWorkspaceSqm
      ? String(signal.estimatedWorkspaceSqm)
      : null,
    estimatedHeadcount: signal.employeeEstimate
      ? String(signal.employeeEstimate)
      : null,
    recommendedNextAction: signal.recommendedAction ?? null,
    outreachSubject: `${signal.companyName} — workspace opportunity`,
    scanBatchId: null,
  });

  await storage.updateDealHunterSignal(signalId, {
    pushedToPipeline: true,
    linkedProspectId: prospect.id,
    status: "pushed",
    isReviewed: true,
    updatedAt: new Date(),
  } as any);

  return { prospectId: prospect.id };
}

export async function reviewDealHunterSignal(
  signalId: string
): Promise<DealHunterSignal> {
  const updated = await storage.updateDealHunterSignal(signalId, {
    isReviewed: true,
    status: "reviewed",
    updatedAt: new Date(),
  } as any);

  if (!updated) throw new Error("Signal not found");
  return updated;
}

export async function dismissDealHunterSignal(
  signalId: string
): Promise<DealHunterSignal> {
  const updated = await storage.updateDealHunterSignal(signalId, {
    status: "dismissed",
    isReviewed: true,
    updatedAt: new Date(),
  } as any);

  if (!updated) throw new Error("Signal not found");
  return updated;
}

export async function markDealHunterSignalDuplicate(
  signalId: string
): Promise<DealHunterSignal> {
  const updated = await storage.updateDealHunterSignal(signalId, {
    isDuplicate: true,
    status: "dismissed",
    isReviewed: true,
    updatedAt: new Date(),
  } as any);

  if (!updated) throw new Error("Signal not found");
  return updated;
}

export async function getDealHunterStats() {
  return storage.getDealHunterStats();
}