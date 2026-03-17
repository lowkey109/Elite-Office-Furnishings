import Stripe from "stripe";

export interface StripeConfig {
  enabled: boolean;
  testMode: boolean;
  safeMode: boolean;
  currency: string;
  modeLabel: string;
}

export function getStripeConfig(): StripeConfig {
  const hasKey = !!process.env.STRIPE_SECRET_KEY;
  const testMode = (process.env.STRIPE_MODE || "test") !== "live";
  const safeMode = process.env.SAFE_MODE === "true";
  const currency = (process.env.STRIPE_CURRENCY || "AUD").toLowerCase();

  return {
    enabled: hasKey,
    testMode,
    safeMode,
    currency,
    modeLabel: safeMode ? "SAFE MODE" : testMode ? "TEST MODE" : "LIVE",
  };
}

export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2024-06-20" } as any);
}

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function isLiveMode(): boolean {
  return process.env.STRIPE_MODE === "live" && process.env.SAFE_MODE !== "true";
}

export function auditableAction(action: string, safeMode: boolean): string {
  return safeMode ? `[SAFE_MODE] ${action} (simulated)` : action;
}
