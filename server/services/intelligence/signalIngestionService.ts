// ─── Signal Ingestion Engine ──────────────────────────────────────────────────
// Full pipeline: source connector → raw capture → dedupe → normalization
// → classification → confidence scoring → entity matching → persistence
// → opportunity evaluation.
//
// CRITICAL: Synthetic scanners are downgraded to demo mode.

import crypto from "crypto";
import { db } from "../../db";
import {
  rawSignals,
  intelligenceSignals,
  intelligenceSources,
  signalEvidence,
  InsertRawSignal,
  InsertIntelligenceSignal,
  InsertSignalEvidence,
  InsertIntelligenceSource,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import OpenAI from "openai";

function getOpenAI(): OpenAI {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

const SAFE_MODE = process.env.SAFE_MODE === "true";

// ─── Normalizers ──────────────────────────────────────────────────────────────

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(pty|ltd|limited|inc|corp|corporation|co|group|holdings|australia|au)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCity(city: string): string {
  return city.toLowerCase().replace(/\s+/g, " ").trim();
}

export function signalWindowBucket(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const week = Math.ceil(
    ((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + new Date(year, 0, 1).getDay() + 1) / 7
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function contentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// ─── Signal Types ─────────────────────────────────────────────────────────────

export type RawSignalInput = {
  sourceType: "rss" | "job_board" | "property_feed" | "sublease" | "funding" | "visitor_intent" | "manual";
  rawContent: string;
  url?: string;
  publishedAt?: Date;
  sourceId?: string;
};

export type ClassifiedSignal = {
  companyName: string;
  city: string;
  state?: string;
  country: string;
  signalType: string;
  classification: string;
  evidenceSummary: string;
  signalStrength: number;
  confidenceScore: number;
  relocationProbability: number;
  commercialTier: string;
  url?: string;
  publishedAt?: Date;
};

// ─── STEP 1: Source Connector ─────────────────────────────────────────────────

export async function fetchFromSource(source: {
  id: string;
  type: string;
  url?: string;
  config?: string;
}): Promise<RawSignalInput[]> {
  if (SAFE_MODE) {
    console.log(`[SignalIngestion] SAFE_MODE active — skipping live fetch for source ${source.id}`);
    return [];
  }

  const signals: RawSignalInput[] = [];

  if (source.type === "rss" && source.url) {
    try {
      const res = await fetch(source.url, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const xml = await res.text();
        const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? [];
        for (const item of items.slice(0, 20)) {
          const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[1] ?? "";
          const link = item.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
          const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
          const description = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/)?.[1] ?? "";
          signals.push({
            sourceType: "rss",
            rawContent: `${title}\n${description}`.slice(0, 2000),
            url: link,
            publishedAt: pubDate ? new Date(pubDate) : undefined,
            sourceId: source.id,
          });
        }
      }
    } catch (err) {
      console.warn(`[SignalIngestion] RSS fetch failed for ${source.url}:`, err);
    }
  }

  return signals;
}

// ─── STEP 2: Raw Signal Capture ───────────────────────────────────────────────

export async function captureRawSignal(input: RawSignalInput): Promise<string | null> {
  const hash = contentHash(input.rawContent);

  const existing = await db
    .select({ id: rawSignals.id })
    .from(rawSignals)
    .where(eq(rawSignals.contentHash, hash))
    .limit(1);

  if (existing.length > 0) {
    return null;
  }

  const [inserted] = await db
    .insert(rawSignals)
    .values({
      sourceType: input.sourceType,
      rawContent: input.rawContent,
      url: input.url,
      publishedAt: input.publishedAt,
      sourceId: input.sourceId,
      contentHash: hash,
      isProcessed: false,
    })
    .returning({ id: rawSignals.id });

  return inserted?.id ?? null;
}

// ─── STEP 3 + 4: Normalize + Classify via AI ─────────────────────────────────

export async function classifySignal(rawContent: string, url?: string): Promise<ClassifiedSignal | null> {
  const openai = getOpenAI();

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an Australian commercial real estate intelligence analyst.
Extract workspace intelligence signals from text.
Return JSON with exactly these fields:
{
  "companyName": "string or null",
  "city": "string or null",
  "state": "string or null",
  "country": "Australia",
  "signalType": "hiring_growth|funding|lease_activity|relocation_signal|new_office_signal|sublease|other",
  "classification": "office_move|expansion|sublease|new_market|consolidation|unknown",
  "evidenceSummary": "1-2 sentence summary",
  "signalStrength": 0-100,
  "confidenceScore": 0-100,
  "relocationProbability": 0-100,
  "commercialTier": "premium|upper|mid|entry"
}
If no clear company or workspace signal exists, return null for companyName.`,
        },
        {
          role: "user",
          content: `Analyse this content for workspace intelligence signals:\n\n${rawContent.slice(0, 1500)}${url ? `\n\nURL: ${url}` : ""}`,
        },
      ],
    });

    const parsed = JSON.parse(resp.choices[0].message.content ?? "{}");
    if (!parsed.companyName || !parsed.city) return null;

    return {
      companyName: parsed.companyName,
      city: parsed.city,
      state: parsed.state ?? null,
      country: parsed.country ?? "Australia",
      signalType: parsed.signalType ?? "other",
      classification: parsed.classification ?? "unknown",
      evidenceSummary: parsed.evidenceSummary ?? "",
      signalStrength: Number(parsed.signalStrength ?? 0),
      confidenceScore: Number(parsed.confidenceScore ?? 0),
      relocationProbability: Number(parsed.relocationProbability ?? 0),
      commercialTier: parsed.commercialTier ?? "mid",
      url,
    };
  } catch {
    return null;
  }
}

// ─── STEP 5: Dedupe Check ─────────────────────────────────────────────────────

export async function checkDuplicate(
  normalizedCompany: string,
  normalizedCityVal: string,
  signalType: string,
  windowBucket: string
): Promise<string | null> {
  const existing = await db
    .select({ id: intelligenceSignals.id })
    .from(intelligenceSignals)
    .where(
      and(
        eq(intelligenceSignals.normalizedCompanyName, normalizedCompany),
        eq(intelligenceSignals.normalizedCity, normalizedCityVal),
        eq(intelligenceSignals.signalType, signalType),
        eq(intelligenceSignals.signalWindowBucket, windowBucket)
      )
    )
    .limit(1);

  return existing[0]?.id ?? null;
}

// ─── STEP 6-8: Persist ────────────────────────────────────────────────────────

export async function persistSignal(
  classified: ClassifiedSignal,
  rawSignalId: string | null,
  publishedAt?: Date
): Promise<string | null> {
  const normCompany = normalizeCompanyName(classified.companyName);
  const normCity = normalizeCity(classified.city);
  const windowBucket = signalWindowBucket(publishedAt ?? new Date());

  const duplicateId = await checkDuplicate(normCompany, normCity, classified.signalType, windowBucket);
  if (duplicateId) {
    console.log(`[SignalIngestion] Duplicate detected — skipping ${classified.companyName}/${classified.signalType}`);
    return null;
  }

  const tenantMovementScore =
    classified.relocationProbability * 0.5 + classified.signalStrength * 0.3 + classified.confidenceScore * 0.2;
  const opportunityScore =
    tenantMovementScore * 0.4 + classified.signalStrength * 0.35 + classified.confidenceScore * 0.25;

  const values: InsertIntelligenceSignal = {
    rawSignalId: rawSignalId ?? undefined,
    companyName: classified.companyName,
    normalizedCompanyName: normCompany,
    city: classified.city,
    normalizedCity: normCity,
    state: classified.state ?? undefined,
    country: classified.country,
    signalType: classified.signalType,
    signalWindowBucket: windowBucket,
    signalStrength: classified.signalStrength,
    confidenceScore: classified.confidenceScore,
    relocationProbability: classified.relocationProbability,
    tenantMovementScore: Math.min(100, tenantMovementScore),
    vacancyRiskScore: classified.relocationProbability * 0.6,
    suburbDemandScore: classified.signalStrength * 0.5,
    opportunityScore: Math.min(100, opportunityScore),
    zoneScore: classified.signalStrength * 0.4,
    commercialTier: classified.commercialTier,
    classification: classified.classification,
    evidenceSummary: classified.evidenceSummary,
    status: "active",
  };

  try {
    const [inserted] = await db
      .insert(intelligenceSignals)
      .values(values)
      .returning({ id: intelligenceSignals.id });

    return inserted?.id ?? null;
  } catch (err: any) {
    if (err?.code === "23505") {
      console.log(`[SignalIngestion] DB unique constraint hit — dedupe working correctly`);
      return null;
    }
    throw err;
  }
}

// ─── STEP 9: Opportunity Evaluation ──────────────────────────────────────────

export async function evaluateOpportunity(signalId: string, classified: ClassifiedSignal): Promise<void> {
  if (classified.opportunityScore === undefined) return;
  const opportunityScore =
    classified.signalStrength * 0.35 + classified.confidenceScore * 0.25 + classified.relocationProbability * 0.4;

  if (opportunityScore >= 60) {
    console.log(
      `[SignalIngestion] High-value opportunity detected: ${classified.companyName} in ${classified.city} (score: ${opportunityScore.toFixed(1)})`
    );
  }
}

// ─── FULL PIPELINE ────────────────────────────────────────────────────────────

export async function ingestSignal(input: RawSignalInput): Promise<{
  rawId: string | null;
  signalId: string | null;
  skipped: boolean;
}> {
  const rawId = await captureRawSignal(input);
  if (!rawId) {
    return { rawId: null, signalId: null, skipped: true };
  }

  const classified = await classifySignal(input.rawContent, input.url);
  if (!classified) {
    await db
      .update(rawSignals)
      .set({ isProcessed: true, processedAt: new Date(), processingError: "no_signal_detected" })
      .where(eq(rawSignals.id, rawId));
    return { rawId, signalId: null, skipped: false };
  }

  const signalId = await persistSignal(classified, rawId, input.publishedAt);

  await db
    .update(rawSignals)
    .set({ isProcessed: true, processedAt: new Date() })
    .where(eq(rawSignals.id, rawId));

  if (signalId) {
    await evaluateOpportunity(signalId, classified);
  }

  return { rawId, signalId, skipped: false };
}

// ─── Batch Source Ingestion ───────────────────────────────────────────────────

export async function runIngestionCycle(): Promise<{
  sourcesProcessed: number;
  rawCaptured: number;
  signalsPersisted: number;
  duplicatesSkipped: number;
}> {
  const sources = await db
    .select()
    .from(intelligenceSources)
    .where(eq(intelligenceSources.isActive, true));

  let rawCaptured = 0;
  let signalsPersisted = 0;
  let duplicatesSkipped = 0;

  for (const source of sources) {
    const rawInputs = await fetchFromSource(source);

    for (const input of rawInputs) {
      const result = await ingestSignal(input);
      if (result.skipped) {
        duplicatesSkipped++;
      } else {
        if (result.rawId) rawCaptured++;
        if (result.signalId) signalsPersisted++;
      }
    }

    await db
      .update(intelligenceSources)
      .set({
        lastFetchedAt: new Date(),
        totalSignalsIngested: sql`${intelligenceSources.totalSignalsIngested} + ${signalsPersisted}`,
      })
      .where(eq(intelligenceSources.id, source.id));
  }

  console.log(
    `[SignalIngestion] Cycle complete — sources: ${sources.length}, raw: ${rawCaptured}, signals: ${signalsPersisted}, dupes: ${duplicatesSkipped}`
  );

  return { sourcesProcessed: sources.length, rawCaptured, signalsPersisted, duplicatesSkipped };
}

// ─── Manual Signal Injection (for adapters & admin) ──────────────────────────

export async function injectManualSignal(data: {
  companyName: string;
  city: string;
  state?: string;
  signalType: string;
  evidenceSummary: string;
  signalStrength?: number;
  confidenceScore?: number;
  relocationProbability?: number;
  url?: string;
}): Promise<string | null> {
  const classified: ClassifiedSignal = {
    companyName: data.companyName,
    city: data.city,
    state: data.state,
    country: "Australia",
    signalType: data.signalType,
    classification: data.signalType.includes("relocation") ? "office_move" : "expansion",
    evidenceSummary: data.evidenceSummary,
    signalStrength: data.signalStrength ?? 50,
    confidenceScore: data.confidenceScore ?? 50,
    relocationProbability: data.relocationProbability ?? 30,
    commercialTier: "mid",
    url: data.url,
  };

  return persistSignal(classified, null, new Date());
}
