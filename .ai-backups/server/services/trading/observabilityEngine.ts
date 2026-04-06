import { db } from "../../db";
import {
  systemTraceLogs, paperTradingDecisions, paperPositions,
  paperTradeOutcomes, paperTradingState,
} from "@shared/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function recordTrace(params: {
  traceType: string;
  component: string;
  operation: string;
  status: string;
  durationMs?: number;
  details?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await db.insert(systemTraceLogs).values({
      traceType: params.traceType,
      component: params.component,
      operation: params.operation,
      status: params.status,
      durationMs: params.durationMs || null,
      details: params.details || null,
      errorMessage: params.errorMessage || null,
      metadataJson: params.metadata || {},
    });
  } catch (err) {
    console.error("[observability] Failed to write trace:", err instanceof Error ? err.message : err);
  }
}

export async function getSystemObservability(): Promise<{
  overview: {
    totalDecisions: number;
    totalPositions: number;
    openPositions: number;
    totalOutcomes: number;
    currentCapital: number;
    peakCapital: number;
    totalPnl: number;
  };
  recentTraces: any[];
  tracesByComponent: Record<string, { total: number; errors: number; avgDurationMs: number }>;
  errorRate: number;
  systemHealth: "healthy" | "degraded" | "critical";
  failures: any[];
}> {
  const [decisions, positions, outcomes, stateRows, traces] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(paperTradingDecisions),
    db.select().from(paperPositions),
    db.select({ count: sql<number>`count(*)` }).from(paperTradeOutcomes),
    db.select().from(paperTradingState).limit(1),
    db.select().from(systemTraceLogs).orderBy(desc(systemTraceLogs.createdAt)).limit(200),
  ]);

  const state = stateRows[0];
  const openPositions = positions.filter(p => p.status === "open");

  const tracesByComponent: Record<string, { total: number; errors: number; totalDuration: number }> = {};
  let totalErrors = 0;
  for (const t of traces) {
    if (!tracesByComponent[t.component]) tracesByComponent[t.component] = { total: 0, errors: 0, totalDuration: 0 };
    tracesByComponent[t.component].total += 1;
    if (t.status === "error" || t.status === "failed") {
      tracesByComponent[t.component].errors += 1;
      totalErrors++;
    }
    tracesByComponent[t.component].totalDuration += t.durationMs || 0;
  }

  const formattedByComponent: Record<string, { total: number; errors: number; avgDurationMs: number }> = {};
  for (const [comp, data] of Object.entries(tracesByComponent)) {
    formattedByComponent[comp] = {
      total: data.total, errors: data.errors,
      avgDurationMs: data.total > 0 ? Math.round(data.totalDuration / data.total) : 0,
    };
  }

  const errorRate = traces.length > 0 ? Math.round((totalErrors / traces.length) * 100) : 0;
  const systemHealth = errorRate > 20 ? "critical" : errorRate > 5 ? "degraded" : "healthy";

  const failures = traces.filter(t => t.status === "error" || t.status === "failed").slice(0, 10);

  return {
    overview: {
      totalDecisions: Number(decisions[0]?.count || 0),
      totalPositions: positions.length,
      openPositions: openPositions.length,
      totalOutcomes: Number(outcomes[0]?.count || 0),
      currentCapital: state?.currentCapital || 100000,
      peakCapital: state?.peakCapital || 100000,
      totalPnl: state?.totalPnl || 0,
    },
    recentTraces: traces.slice(0, 30),
    tracesByComponent: formattedByComponent,
    errorRate,
    systemHealth,
    failures,
  };
}
