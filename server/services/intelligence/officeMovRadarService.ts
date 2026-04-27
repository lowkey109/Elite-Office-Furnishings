import { db } from "../../db";
import { officeMovRadar } from "../../../shared/schema";
import { desc } from "drizzle-orm";
import type { RadarSignalLike } from "./nexora/nexora-types";

export async function runOfficeMovRadarScan(): Promise<RadarSignalLike[]> {
  // SYNTHETIC_OFFICE_MOV_RADAR_DISABLED_FOR_AUTONOMY
  // This legacy scanner was synthetic/demo-oriented and must not feed production autonomy.
  // Use real scanners such as news/job/predictive ingestion instead.
  if (process.env.TCD_ALLOW_LEGACY_SYNTHETIC_RADAR !== "true") {
    console.warn("[officeMovRadarService] Legacy synthetic radar scanner is disabled.");
    return [];
  }

  throw new Error("Legacy synthetic radar scanner is disabled for autonomy readiness.");
}
