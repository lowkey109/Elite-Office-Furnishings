type OrderSide = "BUY" | "SELL";

interface LiveOrderAttempt {
  id: string;
  productId: string;
  side: OrderSide;
  createdAt: number;
}

const recentOrders: LiveOrderAttempt[] = [];

const DUPLICATE_WINDOW_MS = 15000;

function cleanup() {
  const cutoff = Date.now() - DUPLICATE_WINDOW_MS;

  while (recentOrders.length > 0) {
    if (recentOrders[0].createdAt >= cutoff) break;
    recentOrders.shift();
  }
}

export function validateDuplicateOrderRisk(input: {
  productId: string;
  side: OrderSide;
}) {
  cleanup();

  const existing = recentOrders.find(
    (o) =>
      o.productId === input.productId &&
      o.side === input.side
  );

  if (existing) {
    return {
      ok: false,
      reason: "duplicate_order_risk",
      existing,
    };
  }

  return {
    ok: true,
  };
}

export function registerLiveOrder(input: {
  productId: string;
  side: OrderSide;
}) {
  const order: LiveOrderAttempt = {
    id:
      "live_" +
      Math.random().toString(36).slice(2),
    productId: input.productId,
    side: input.side,
    createdAt: Date.now(),
  };

  recentOrders.push(order);

  return order;
}

export function getExecutionGuardState() {
  cleanup();

  return {
    ok: true,
    duplicateWindowMs: DUPLICATE_WINDOW_MS,
    activeRecentOrders: recentOrders,
  };
}
