import { db } from "../../db";
import { autonomousModeState, circuitBreakerEvents, paperTradingState, paperPositions } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

const CIRCUIT_BREAKER_RULES = {
  maxDailyLoss: -5000,
  maxDrawdownPct: 20,
  maxConsecutiveLosses: 5,
  maxOpenPositions: 8,
  feedStalenessSec: 300,
};

export interface AutonomousStatus {
  mode: string;
  isRunning: boolean;
  cycleCount: number;
  lastCycleAt: string | null;
  circuitBreakerActive: boolean;
  circuitBreakerReason: string | null;
  config: Record<string, any>;
}

export interface CircuitBreakerCheck {
  triggered: boolean;
  triggers: { type: string; severity: string; reason: string }[];
}

export async function getAutonomousStatus(): Promise<{
  status: AutonomousStatus;
  circuitBreakerCheck: CircuitBreakerCheck;
  recentBreakerEvents: any[];
  rules: typeof CIRCUIT_BREAKER_RULES;
}> {
  const [stateRows, breakerEvents] = await Promise.all([
    db.select().from(autonomousModeState).limit(1),
    db.select().from(circuitBreakerEvents).orderBy(desc(circuitBreakerEvents.createdAt)).limit(20),
  ]);

  const state = stateRows[0];
  const status: AutonomousStatus = {
    mode: state?.mode || "manual",
    isRunning: state?.isRunning || false,
    cycleCount: state?.cycleCount || 0,
    lastCycleAt: state?.lastCycleAt?.toISOString() || null,
    circuitBreakerActive: state?.circuitBreakerActive || false,
    circuitBreakerReason: state?.circuitBreakerReason || null,
    config: (state?.configJson as Record<string, any>) || {},
  };

  const circuitBreakerCheck = await checkCircuitBreakers();

  return {
    status,
    circuitBreakerCheck,
    recentBreakerEvents: breakerEvents,
    rules: CIRCUIT_BREAKER_RULES,
  };
}

export async function checkCircuitBreakers(): Promise<CircuitBreakerCheck> {
  const triggers: { type: string; severity: string; reason: string }[] = [];

  try {
    const [tradingState, positions] = await Promise.all([
      db.select().from(paperTradingState).limit(1),
      db.select().from(paperPositions).where(eq(paperPositions.status, "open")),
    ]);

    const state = tradingState[0];
    if (state) {
      const dailyPnl = state.totalPnl || 0;
      if (dailyPnl < CIRCUIT_BREAKER_RULES.maxDailyLoss) {
        triggers.push({ type: "max_daily_loss", severity: "critical", reason: `Daily PnL $${dailyPnl.toFixed(2)} below limit $${CIRCUIT_BREAKER_RULES.maxDailyLoss}` });
      }

      const drawdown = state.peakCapital && state.currentCapital
        ? ((state.peakCapital - state.currentCapital) / state.peakCapital) * 100
        : 0;
      if (drawdown > CIRCUIT_BREAKER_RULES.maxDrawdownPct) {
        triggers.push({ type: "max_drawdown", severity: "critical", reason: `Drawdown ${drawdown.toFixed(1)}% exceeds ${CIRCUIT_BREAKER_RULES.maxDrawdownPct}%` });
      }
    }

    if (positions.length >= CIRCUIT_BREAKER_RULES.maxOpenPositions) {
      triggers.push({ type: "max_open_positions", severity: "high", reason: `${positions.length} positions at limit` });
    }

    let feedHealthy = false;
    try {
      const { getMarketLoopStatus } = await import("./marketLoop");
      const loopStatus = getMarketLoopStatus();
      feedHealthy = loopStatus.isRunning;
    } catch (err) {
      console.warn("[autonomous] Feed health check failed:", err instanceof Error ? err.message : err);
    }

    if (!feedHealthy) {
      triggers.push({ type: "feed_unhealthy", severity: "high", reason: "Market feed not running" });
    }
  } catch (err) {
    console.error("[autonomous] Circuit breaker check error:", err instanceof Error ? err.message : err);
    triggers.push({ type: "check_error", severity: "high", reason: "Failed to complete circuit breaker checks" });
  }

  if (triggers.length > 0) {
    for (const trigger of triggers) {
      try {
        await db.insert(circuitBreakerEvents).values({
          triggerType: trigger.type, severity: trigger.severity, reason: trigger.reason,
        });
      } catch (err) {
        console.error("[autonomous] Failed to persist circuit breaker event:", trigger.type, err instanceof Error ? err.message : err);
      }
    }
  }

  return { triggered: triggers.length > 0, triggers };
}
