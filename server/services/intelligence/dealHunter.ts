import { db } from "../../db";
import { dealHunterSignals } from "../../../shared/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import type { DealHunterSignalLike } from "./nexora/nexora-types";

export async function runDealHunterScan(): Promise<DealHunterSignalLike[]> {
  try {
    const rows = await db
      .select()
      .from(dealHunterSignals)
      .where(
        and(
          eq(dealHunterSignals.pushedToPipeline, false),
          eq(dealHunterSignals.pushedToRadar, false),
        ),
      )
      .orderBy(desc(dealHunterSignals.signalStrengthScore), desc(dealHunterSignals.createdAt))
      .limit(100);

    return rows.map((r) => ({
      id: r.id,
      companyName: r.companyName ?? null,
      city: r.city ?? null,
      state: r.state ?? null,
      industry: r.industry ?? null,
      signalType: r.signalType ?? null,
      signalSubtype: (r as any).signalSubtype ?? null,
      signalStrengthScore: r.signalStrengthScore ?? null,
      signalConfidence: (r as any).signalConfidence ?? null,
      estimatedProjectValue: r.estimatedProjectValue ?? null,
      estimatedWorkspaceSqm: r.estimatedWorkspaceSqm ?? null,
      employeeEstimate: r.employeeEstimate ?? null,
      probabilityTier: r.probabilityTier ?? null,
      rawPayloadSummary: r.rawPayloadSummary ?? null,
      sourceTitle: r.sourceTitle ?? null,
      sourcePublishedAt: (r as any).sourcePublishedAt ?? null,
      sourceUrl: r.sourceUrl ?? null,
      signalSource: r.signalSource ?? null,
      pushedToPipeline: r.pushedToPipeline ?? false,
      pushedToRadar: r.pushedToRadar ?? false,
    }));
  } catch {
    return [];
  }
}

export async function pushDealHunterToPipeline(id: string): Promise<void> {
  await db
    .update(dealHunterSignals)
    .set({ pushedToPipeline: true, updatedAt: new Date() })
    .where(eq(dealHunterSignals.id, id));
}

export async function pushDealHunterToRadar(id: string): Promise<void> {
  await db
    .update(dealHunterSignals)
    .set({ pushedToRadar: true, updatedAt: new Date() })
    .where(eq(dealHunterSignals.id, id));
}
