import type { VenueAdapter, OrderRequest, OrderResponse } from "./baseVenueAdapter";

export class DryRunVenueAdapter implements VenueAdapter {
  name = "dry_run";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    return {
      success: true,
      venueOrderId: `dryrun_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      filledPrice: request.price || 0,
      filledQuantity: request.quantity,
      status: "filled",
      rawResponse: {
        mode: "dry_run",
        note: "Order simulated — not sent to any venue",
        request,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async cancelOrder(_venueOrderId: string): Promise<boolean> {
    return true;
  }

  async getOrderStatus(_venueOrderId: string): Promise<OrderResponse> {
    return {
      success: true,
      status: "filled",
      rawResponse: { mode: "dry_run", note: "Status check simulated" },
    };
  }

  async getAccountBalance(): Promise<{ available: number; total: number }> {
    return { available: 0, total: 0 };
  }
}
