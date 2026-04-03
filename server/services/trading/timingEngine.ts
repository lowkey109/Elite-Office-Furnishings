import { db } from "../../db";
import { executionTimingLogs } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

export interface TimingMeasurement {
  decisionId?: string;
  symbol: string;
  phase: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
}

export async function recordTiming(measurement: TimingMeasurement): Promise<void> {
  try {
    await db.insert(executionTimingLogs).values({
      decisionId: measurement.decisionId || null,
      symbol: measurement.symbol,
      phase: measurement.phase,
      startedAt: measurement.startedAt,
      completedAt: measurement.completedAt,
      durationMs: measurement.durationMs,
    });
  } catch (err) {
    console.error("[timing] Failed to record timing:", err instanceof Error ? err.message : err);
  }
}

export function createTimer(symbol: string, phase: string, decisionId?: string): () => Promise<TimingMeasurement> {
  const startedAt = new Date();
  return async () => {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const measurement: TimingMeasurement = { decisionId, symbol, phase, startedAt, completedAt, durationMs };
    await recordTiming(measurement);
    return measurement;
  };
}

export async function getTimingAnalytics(): Promise<{
  byPhase: Record<string, { avgMs: number; p95Ms: number; count: number }>;
  bySymbol: Record<string, { avgMs: number; count: number }>;
  recentTimings: any[];
  totalMeasurements: number;
  overallAvgMs: number;
}> {
  const logs = await db.select().from(executionTimingLogs).orderBy(desc(executionTimingLogs.createdAt)).limit(500);

  if (logs.length === 0) {
    return { byPhase: {}, bySymbol: {}, recentTimings: [], totalMeasurements: 0, overallAvgMs: 0 };
  }

  const byPhase: Record<string, { durations: number[]; count: number }> = {};
  const bySymbol: Record<string, { total: number; count: number }> = {};
  let totalDuration = 0;

  for (const log of logs) {
    if (!byPhase[log.phase]) byPhase[log.phase] = { durations: [], count: 0 };
    byPhase[log.phase].durations.push(log.durationMs);
    byPhase[log.phase].count += 1;

    if (!bySymbol[log.symbol]) bySymbol[log.symbol] = { total: 0, count: 0 };
    bySymbol[log.symbol].total += log.durationMs;
    bySymbol[log.symbol].count += 1;

    totalDuration += log.durationMs;
  }

  const formattedByPhase: Record<string, { avgMs: number; p95Ms: number; count: number }> = {};
  for (const [phase, data] of Object.entries(byPhase)) {
    const sorted = data.durations.sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    formattedByPhase[phase] = {
      avgMs: Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length),
      p95Ms: Math.round(sorted[p95Index] || sorted[sorted.length - 1]),
      count: data.count,
    };
  }

  const formattedBySymbol: Record<string, { avgMs: number; count: number }> = {};
  for (const [sym, data] of Object.entries(bySymbol)) {
    formattedBySymbol[sym] = { avgMs: Math.round(data.total / data.count), count: data.count };
  }

  return {
    byPhase: formattedByPhase,
    bySymbol: formattedBySymbol,
    recentTimings: logs.slice(0, 20),
    totalMeasurements: logs.length,
    overallAvgMs: Math.round(totalDuration / logs.length),
  };
}
