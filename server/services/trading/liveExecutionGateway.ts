import { db } from "../../db";
import { executionAttemptLogs, liveOrders } from "@shared/schema";
import { getLiveExecutionConfig, getExecutionMode } from "./liveExecutionConfig";
import { checkLiveGuardrails } from "./liveExecutionGuardrails";
import { DryRunVenueAdapter } from "./venues/dryRunAdapter";
import { desc, eq } from "drizzle-orm";

export interface ExecutionRequest {
  decisionId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  orderType: "market" | "limit";
  stopPrice?: number;
  targetPrice?: number;
}

export interface ExecutionResult {
  executed: boolean;
  mode: string;
  blockedReasons: string[];
  orderId?: string;
  venueOrderId?: string;
  dryRunPayload?: Record<string, any>;
}

export async function submitToGateway(request: ExecutionRequest): Promise<ExecutionResult> {
  const mode = getExecutionMode();
  const config = getLiveExecutionConfig();

  if (mode === "paper_only") {
    await logAttempt(request, "paper_only", false, null, { note: "paper_only mode — not sent to any venue" });
    return {
      executed: false,
      mode: "paper_only",
      blockedReasons: ["Execution mode is paper_only"],
    };
  }

  const guardrails = await checkLiveGuardrails({
    symbol: request.symbol,
    side: request.side,
    quantity: request.quantity,
    price: request.price,
    decisionId: request.decisionId,
  });

  if (!guardrails.passed) {
    await logAttempt(request, mode, true, guardrails.blockedReasons.join("; "), {
      guardrailChecks: guardrails.checks,
    });
    return {
      executed: false,
      mode,
      blockedReasons: guardrails.blockedReasons,
    };
  }

  if (mode === "dry_run") {
    const adapter = new DryRunVenueAdapter();
    const result = await adapter.placeOrder({
      symbol: request.symbol,
      side: request.side,
      quantity: request.quantity,
      price: request.price,
      orderType: request.orderType,
    });

    const [order] = await db.insert(liveOrders).values({
      decisionId: request.decisionId,
      venue: "dry_run",
      symbol: request.symbol,
      side: request.side,
      orderType: request.orderType,
      quantity: request.quantity,
      requestedPrice: request.price,
      submittedPrice: request.price,
      filledPrice: result.filledPrice,
      status: "dry_run_filled",
      venueOrderId: result.venueOrderId,
      rawResponseJson: result.rawResponse || {},
      submittedAt: new Date(),
      filledAt: new Date(),
    }).returning({ id: liveOrders.id });

    await logAttempt(request, "dry_run", false, null, {
      venueOrderId: result.venueOrderId,
      note: "Dry run — payload built and simulated, not sent to real venue",
    });

    return {
      executed: true,
      mode: "dry_run",
      blockedReasons: [],
      orderId: order.id,
      venueOrderId: result.venueOrderId,
      dryRunPayload: result.rawResponse,
    };
  }

  await logAttempt(request, mode, true, "tiny_live mode not yet implemented", {});
  return {
    executed: false,
    mode,
    blockedReasons: ["tiny_live mode not yet implemented"],
  };
}

async function logAttempt(
  request: ExecutionRequest,
  mode: string,
  wasBlocked: boolean,
  blockReason: string | null,
  payload: Record<string, any>,
): Promise<void> {
  try {
    await db.insert(executionAttemptLogs).values({
      decisionId: request.decisionId,
      mode,
      venue: null,
      symbol: request.symbol,
      requestedAction: `${request.side} ${request.quantity} ${request.symbol} @ ${request.price}`,
      wasBlocked,
      blockReason,
      payloadJson: payload,
    });
  } catch (err) {
    console.error("[liveGateway] Failed to log execution attempt:", request.decisionId, request.symbol, err instanceof Error ? err.message : err);
  }
}

export async function getRecentAttemptLogs(limit = 30): Promise<any[]> {
  return db.select().from(executionAttemptLogs).orderBy(desc(executionAttemptLogs.createdAt)).limit(limit);
}

export async function getRecentLiveOrders(limit = 20): Promise<any[]> {
  return db.select().from(liveOrders).orderBy(desc(liveOrders.createdAt)).limit(limit);
}

export async function getLivePositionsSummary(): Promise<any[]> {
  const { livePositions } = await import("@shared/schema");
  return db.select().from(livePositions).where(eq(livePositions.status, "open")).orderBy(desc(livePositions.createdAt));
}
