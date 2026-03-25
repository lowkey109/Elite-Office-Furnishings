export const WALKINSHAW_CONFIG = {
  slug: "walkinshaw-2026",
  title: "The Corporate Desk Walkinshaw Reward",
  prizeName: "VL Walkinshaw",
  prizeValueAud: 250000,
  fundingTargetAud: 3000000,
  qldOnly: true, // safest default until permits/legal review are complete
  status: "live",
  startsAt: "2026-04-01T00:00:00.000Z",
  closesAt: "2026-12-31T13:59:59.000Z",
  drawAt: "2027-01-15T00:00:00.000Z",
  termsVersion: "v1",
};

export const ENTRY_RULES: Record<string, number> = {
  enquiry: 1,
  qualified: 5,
  quote: 10,
  deposit_paid: 25,
  won: 100,
};

export const ALLOWED_STATES = ["QLD"];

export function normaliseState(input: string): string {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function isEligibleState(state: string): boolean {
  return ALLOWED_STATES.includes(normaliseState(state));
}