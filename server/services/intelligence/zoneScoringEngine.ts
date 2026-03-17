// ─── Zone Scoring Engine ──────────────────────────────────────────────────────
// Computes and aggregates zone-level opportunity scores from intelligence signals
// and demand forecasts.

import { db } from "../../db";
import {
  companyZoneScores,
  suburbDemandSnapshots,
  officeMovRadar,
  intelligenceSignals,
  InsertCompanyZoneScore,
} from "@shared/schema";
import { desc, sql } from "drizzle-orm";
import { normalizeCompanyName, normalizeCity } from "./signalIngestionService";

export interface ZoneScore {
  suburb: string;
  city: string;
  state?: string;
  lat?: number;
  lng?: number;
  zoneScore: number;
  demandScore: number;
  activeCompanies: number;
  recentSignals: number;
  demandTier: string;
}

const SUBURB_COORDS: Record<string, { lat: number; lng: number }> = {
  "Sydney CBD": { lat: -33.8688, lng: 151.2093 },
  "North Sydney": { lat: -33.8404, lng: 151.2070 },
  "Parramatta": { lat: -33.8150, lng: 151.0010 },
  "Melbourne CBD": { lat: -37.8136, lng: 144.9631 },
  "Southbank": { lat: -37.8228, lng: 144.9606 },
  "Richmond": { lat: -37.8182, lng: 144.9999 },
  "Brisbane CBD": { lat: -27.4698, lng: 153.0251 },
  "Fortitude Valley": { lat: -27.4558, lng: 153.0383 },
  "Perth CBD": { lat: -31.9505, lng: 115.8605 },
  "Subiaco": { lat: -31.9487, lng: 115.8267 },
  "Adelaide CBD": { lat: -34.9285, lng: 138.6007 },
};

export async function computeZoneScores(): Promise<ZoneScore[]> {
  const demandSnaps = await db
    .select()
    .from(suburbDemandSnapshots)
    .orderBy(desc(suburbDemandSnapshots.demandScore))
    .limit(100);

  const intelligenceSigs = await db
    .select({
      city: intelligenceSignals.city,
      zoneScore: intelligenceSignals.zoneScore,
      opportunityScore: intelligenceSignals.opportunityScore,
    })
    .from(intelligenceSignals)
    .where(sql`${intelligenceSignals.status} = 'active'`)
    .limit(500);

  const cityZoneMap = new Map<string, { zoneScores: number[]; count: number }>();
  for (const sig of intelligenceSigs) {
    const key = sig.city.toLowerCase();
    const existing = cityZoneMap.get(key) ?? { zoneScores: [], count: 0 };
    existing.zoneScores.push(sig.zoneScore);
    existing.count++;
    cityZoneMap.set(key, existing);
  }

  const zones: ZoneScore[] = [];

  for (const snap of demandSnaps) {
    const cityKey = snap.city.toLowerCase();
    const intelData = cityZoneMap.get(cityKey);
    const avgZoneScore = intelData
      ? intelData.zoneScores.reduce((a, b) => a + b, 0) / intelData.zoneScores.length
      : 0;

    const coords = SUBURB_COORDS[snap.suburb] ?? SUBURB_COORDS[snap.city] ?? null;

    zones.push({
      suburb: snap.suburb,
      city: snap.city,
      state: snap.state ?? undefined,
      lat: coords?.lat,
      lng: coords?.lng,
      zoneScore: Math.round((snap.demandScore * 0.6 + avgZoneScore * 0.4)),
      demandScore: snap.demandScore,
      activeCompanies: snap.activeCompanies,
      recentSignals: snap.recentSignals,
      demandTier: snap.demandTier,
    });
  }

  return zones.sort((a, b) => b.zoneScore - a.zoneScore);
}

export async function upsertCompanyZoneScore(params: {
  companyName: string;
  suburb: string;
  city: string;
  state?: string;
  zoneScore: number;
  demandSignals: number;
}): Promise<void> {
  const values: InsertCompanyZoneScore = {
    companyName: params.companyName,
    normalizedCompanyName: normalizeCompanyName(params.companyName),
    suburb: params.suburb,
    city: params.city,
    state: params.state,
    zoneScore: params.zoneScore,
    demandSignals: params.demandSignals,
    competitorPresence: 0,
    amenityScore: 0,
    transitScore: 0,
    computedAt: new Date(),
  };

  await db.insert(companyZoneScores).values(values).onConflictDoNothing();
}

export async function getTopZones(limit = 10): Promise<ZoneScore[]> {
  const zones = await computeZoneScores();
  return zones.slice(0, limit);
}
