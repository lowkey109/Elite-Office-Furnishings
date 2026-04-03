export interface OrderRequest {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price?: number;
  orderType: "market" | "limit";
  timeInForce?: string;
  reduceOnly?: boolean;
}

export interface OrderResponse {
  success: boolean;
  venueOrderId?: string;
  filledPrice?: number;
  filledQuantity?: number;
  status: "filled" | "partial" | "pending" | "rejected" | "error";
  rawResponse?: Record<string, any>;
  errorMessage?: string;
}

export interface VenueAdapter {
  name: string;
  isAvailable(): Promise<boolean>;
  placeOrder(request: OrderRequest): Promise<OrderResponse>;
  cancelOrder(venueOrderId: string): Promise<boolean>;
  getOrderStatus(venueOrderId: string): Promise<OrderResponse>;
  getAccountBalance(): Promise<{ available: number; total: number }>;
}
