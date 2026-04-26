import { db } from "../../db";
import { officeMovRadar } from "../../../shared/schema";
import { desc } from "drizzle-orm";
import type { RadarSignalLike } from "./nexora/nexora-types";

export async function runOfficeMovRadarScan(): Promise<RadarSignalLike[]> {
  try {
    const rows = await db
      .select()
      .from(officeMovRadar)
      .orderBy(desc(officeMovRadar.radarScore), desc(officeMovRadar.createdAt))
      .limit(200);

    return rows.map((r) => ({
      id: r.id,
      companyName: r.companyName ?? null,
      city: r.city ?? null,
      state: r.state ?? null,
      industry: r.industry ?? null,
      signalType: r.signalType ?? null,
      signalSubtype: (r as any).signalSubtype ?? null,
      radarScore: r.radarScore ?? null,
      confidenceLevel: r.priority ?? null,
      estimatedProjectValue: r.estimatedProjectValue ?? null,
      sourceUrl: r.sourceUrl ?? null,
      sourcePublishedAt: (r as any).sourcePublishedAt ?? null,
      sourceTitle: (r as any).sourceTitle ?? null,
      rawPayloadSummary: (r as any).rawPayloadSummary ?? null,
      signalSource: "officeMov",
    }));
  } catch {
    return [];
  }
}
