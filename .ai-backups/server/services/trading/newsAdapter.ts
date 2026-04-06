import type { NewsItem } from "./types";

export interface NewsAdapterResult {
  items: NewsItem[];
  source: string;
  fetchedAt: Date;
  available: boolean;
  error: string | null;
}

let lastFetchTime = 0;
let cachedResult: NewsAdapterResult | null = null;
const CACHE_TTL_MS = 300_000;

export async function fetchRealNews(): Promise<NewsAdapterResult> {
  const now = Date.now();

  if (cachedResult && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedResult;
  }

  const result: NewsAdapterResult = {
    items: [],
    source: "none",
    fetchedAt: new Date(),
    available: false,
    error:
      "No real-time crypto news API configured. Awaiting news feed integration (e.g., CryptoPanic, NewsAPI, or custom RSS adapter).",
  };

  cachedResult = result;
  lastFetchTime = now;
  return result;
}

export function getNewsAdapterStatus(): {
  available: boolean;
  source: string;
  lastFetched: string | null;
  error: string | null;
} {
  return {
    available: cachedResult?.available ?? false,
    source: cachedResult?.source ?? "none",
    lastFetched: cachedResult?.fetchedAt?.toISOString() ?? null,
    error: cachedResult?.error ?? "Not yet fetched",
  };
}

export async function getLatestNews(): Promise<NewsItem[]> {
  const result = await fetchRealNews();
  return result.items;
}
