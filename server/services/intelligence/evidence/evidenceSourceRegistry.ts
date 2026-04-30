export type EvidenceSourceType =
  | "company_event"
  | "job_ad"
  | "lease_signal"
  | "building_data"
  | "supplier_quote"
  | "customer_quote_upload"
  | "reply_event"
  | "payment_event"
  | "manual_admin"
  | "synthetic_demo";

export type EvidenceSourcePolicy = {
  sourceType: EvidenceSourceType;
  productionAllowed: boolean;
  requiresRealSourceUrl: boolean;
  requiresObservedAt: boolean;
  confidenceCap: number;
  notes: string;
};

export const EVIDENCE_SOURCE_POLICIES: EvidenceSourcePolicy[] = [
  { sourceType: "company_event", productionAllowed: true, requiresRealSourceUrl: true, requiresObservedAt: true, confidenceCap: 95, notes: "Real company/news/event evidence." },
  { sourceType: "job_ad", productionAllowed: true, requiresRealSourceUrl: true, requiresObservedAt: true, confidenceCap: 90, notes: "Real hiring/job expansion signal." },
  { sourceType: "lease_signal", productionAllowed: true, requiresRealSourceUrl: true, requiresObservedAt: true, confidenceCap: 90, notes: "Real lease/office movement evidence." },
  { sourceType: "building_data", productionAllowed: true, requiresRealSourceUrl: true, requiresObservedAt: true, confidenceCap: 85, notes: "Real property/building evidence." },
  { sourceType: "supplier_quote", productionAllowed: true, requiresRealSourceUrl: false, requiresObservedAt: true, confidenceCap: 95, notes: "Supplier/manufacturer quote evidence." },
  { sourceType: "customer_quote_upload", productionAllowed: true, requiresRealSourceUrl: false, requiresObservedAt: true, confidenceCap: 95, notes: "Customer uploaded quote or project evidence." },
  { sourceType: "reply_event", productionAllowed: true, requiresRealSourceUrl: false, requiresObservedAt: true, confidenceCap: 95, notes: "Inbound reply/outcome evidence." },
  { sourceType: "payment_event", productionAllowed: true, requiresRealSourceUrl: false, requiresObservedAt: true, confidenceCap: 100, notes: "Revenue/payment outcome evidence." },
  { sourceType: "manual_admin", productionAllowed: true, requiresRealSourceUrl: false, requiresObservedAt: true, confidenceCap: 80, notes: "Admin-entered evidence." },
  { sourceType: "synthetic_demo", productionAllowed: false, requiresRealSourceUrl: false, requiresObservedAt: false, confidenceCap: 20, notes: "Demo/synthetic evidence only; cannot trigger production autonomy." },
];

export function getEvidencePolicy(sourceType: string): EvidenceSourcePolicy {
  return (
    EVIDENCE_SOURCE_POLICIES.find(p => p.sourceType === sourceType) ??
    { sourceType: "synthetic_demo", productionAllowed: false, requiresRealSourceUrl: false, requiresObservedAt: false, confidenceCap: 20, notes: "Unknown evidence source treated as synthetic/demo." }
  );
}

export function normalizeEvidenceConfidence(input: {
  sourceType: string;
  confidence?: number | null;
  sourceUrl?: string | null;
  observedAt?: string | Date | null;
}): {
  ok: boolean;
  confidence: number;
  policy: EvidenceSourcePolicy;
  blockedReasons: string[];
} {
  const policy = getEvidencePolicy(input.sourceType);
  const blockedReasons: string[] = [];

  if (!policy.productionAllowed) blockedReasons.push("source_not_production_allowed");
  if (policy.requiresRealSourceUrl && !input.sourceUrl) blockedReasons.push("missing_source_url");
  if (policy.requiresObservedAt && !input.observedAt) blockedReasons.push("missing_observed_at");

  const raw = Number(input.confidence ?? 0);
  const confidence = Math.max(0, Math.min(policy.confidenceCap, Number.isFinite(raw) ? raw : 0));

  return {
    ok: blockedReasons.length === 0,
    confidence,
    policy,
    blockedReasons,
  };
}
