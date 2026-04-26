import { db } from "../../db";
import { buildingSignals, relocationSignals } from "../../../shared/schema";
import { desc } from "drizzle-orm";
import type { RadarSignalLike } from "./nexora/nexora-types";

export async function runNewsFeedScan(): Promise<{ signals: RadarSignalLike[] }> {
  try {
    const rows = await db
      .select()
      .from(buildingSignals)
      .orderBy(desc(buildingSignals.createdAt))
      .limit(100);

    const signals: RadarSignalLike[] = rows.map((r) => ({
      id: r.id,
      companyName: ((r as any).companyName ?? (r as any).observedCompany) ?? null,
      city: r.city ?? null,
      state: null,
      industry: null,
      signalType: r.signalType ?? "news",
      signalSubtype: null,
      radarScore: (r as any).confidenceScore ?? null,
      confidenceLevel: null,
      estimatedProjectValue: null,
      sourceUrl: r.sourceUrl ?? null,
      sourcePublishedAt: null,
      sourceTitle: ((r as any).headline ?? (r as any).buildingName) ?? null,
      rawPayloadSummary: ((r as any).summary ?? (r as any).notes) ?? null,
      signalSource: "news",
    }));

    return { signals };
  } catch {
    return { signals: [] };
  }
}

export async function runJobSignalScan(): Promise<{ signals: RadarSignalLike[] }> {
  try {
    return { signals: [] };
  } catch {
    return { signals: [] };
  }
}

export async function runPredictiveScan(): Promise<{ signals: RadarSignalLike[] }> {
  try {
    const rows = await db
      .select()
      .from(relocationSignals)
      .orderBy(desc(relocationSignals.createdAt))
      .limit(100);

    const signals: RadarSignalLike[] = rows.map((r) => ({
      id: r.id,
      companyName: ((r as any).companyName ?? (r as any).observedCompany) ?? null,
      city: r.city ?? null,
      state: r.state ?? null,
      industry: r.industry ?? null,
      signalType: r.signalType ?? "relocation",
      signalSubtype: null,
      radarScore: (r as any).confidenceScore ?? null,
      confidenceLevel: r.probabilityTier ?? null,
      estimatedProjectValue: r.estimatedProjectValue ?? null,
      sourceUrl: r.sourceUrl ?? null,
      sourcePublishedAt: null,
      sourceTitle: null,
      rawPayloadSummary: ((r as any).rawNotes ?? (r as any).notes) ?? null,
      signalSource: "predictive",
    }));

    return { signals };
  } catch {
    return { signals: [] };
  }
}
