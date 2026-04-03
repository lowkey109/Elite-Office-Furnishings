import { db } from "../../db";
import { assetRiskProfiles } from "@shared/schema";

export interface AssetCluster {
  name: string;
  symbols: string[];
  correlationWeight: number;
}

const STATIC_CLUSTERS: AssetCluster[] = [
  { name: "crypto", symbols: ["BTC", "ETH", "SOL"], correlationWeight: 0.85 },
  { name: "macro", symbols: ["XAUUSD"], correlationWeight: 1.0 },
];

export function getClusterForSymbol(symbol: string): string {
  for (const cluster of STATIC_CLUSTERS) {
    if (cluster.symbols.includes(symbol)) return cluster.name;
  }
  return "uncategorized";
}

export function getClusterSymbols(clusterName: string): string[] {
  const cluster = STATIC_CLUSTERS.find(c => c.name === clusterName);
  return cluster ? cluster.symbols : [];
}

export function getCorrelationWeight(clusterName: string): number {
  const cluster = STATIC_CLUSTERS.find(c => c.name === clusterName);
  return cluster ? cluster.correlationWeight : 1.0;
}

export function getAllClusters(): AssetCluster[] {
  return [...STATIC_CLUSTERS];
}

export function areCorrelated(symbolA: string, symbolB: string): boolean {
  const clusterA = getClusterForSymbol(symbolA);
  const clusterB = getClusterForSymbol(symbolB);
  return clusterA === clusterB && clusterA !== "uncategorized";
}

export function getCorrelationAdjustedExposure(
  exposureBySymbol: Record<string, number>,
): Record<string, number> {
  const clusterExposure: Record<string, number> = {};

  for (const [symbol, exposure] of Object.entries(exposureBySymbol)) {
    const cluster = getClusterForSymbol(symbol);
    const weight = getCorrelationWeight(cluster);
    if (!clusterExposure[cluster]) clusterExposure[cluster] = 0;
    clusterExposure[cluster] += Math.abs(exposure) * weight;
  }

  return clusterExposure;
}

export async function getAssetRiskProfiles(): Promise<Record<string, { cluster: string; volatilityClass: string; maxDefaultRisk: number }>> {
  const rows = await db.select().from(assetRiskProfiles);
  const profiles: Record<string, { cluster: string; volatilityClass: string; maxDefaultRisk: number }> = {};
  for (const r of rows) {
    profiles[r.symbol] = { cluster: r.cluster, volatilityClass: r.volatilityClass, maxDefaultRisk: r.maxDefaultRisk };
  }
  return profiles;
}
