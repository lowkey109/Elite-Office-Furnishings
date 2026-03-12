export const FINANCE_RATE_FACTORS: Record<number, number> = {
  24: 0.0465,
  36: 0.0325,
  48: 0.0255,
  60: 0.0215,
};

export const FINANCE_TERM_OPTIONS = [24, 36, 48, 60] as const;

export const FINANCE_THRESHOLD = 15000;

export function calcMonthly(amount: number, termMonths: number): number {
  const factor = FINANCE_RATE_FACTORS[termMonths] ?? FINANCE_RATE_FACTORS[36];
  return Math.round(amount * factor);
}

export function fmtFinance(v: number): string {
  return v.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
}

export const FINANCE_DISCLAIMER =
  "Indicative only. Subject to lender credit assessment, business trading history, and final approval. Not financial advice. Consult your accountant.";
