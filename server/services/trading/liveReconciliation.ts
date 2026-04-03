import { db } from "../../db";
import { liveOrders } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface ReconciliationResult {
  ordersChecked: number;
  mismatches: string[];
  lastSyncAt: string;
  status: "healthy" | "stale" | "error" | "no_live_orders";
}

export async function reconcileLiveState(): Promise<ReconciliationResult> {
  const pendingOrders = await db.select().from(liveOrders).where(
    and(
      eq(liveOrders.status, "pending"),
    ),
  );

  if (pendingOrders.length === 0) {
    return {
      ordersChecked: 0,
      mismatches: [],
      lastSyncAt: new Date().toISOString(),
      status: "no_live_orders",
    };
  }

  const mismatches: string[] = [];
  for (const order of pendingOrders) {
    if (order.venue === "dry_run") {
      continue;
    }
    const age = Date.now() - (order.createdAt ? new Date(order.createdAt).getTime() : Date.now());
    if (age > 300_000) {
      mismatches.push(`Order ${order.id} pending for ${Math.round(age / 60000)}m`);
    }
  }

  return {
    ordersChecked: pendingOrders.length,
    mismatches,
    lastSyncAt: new Date().toISOString(),
    status: mismatches.length > 0 ? "stale" : "healthy",
  };
}
