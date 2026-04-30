// server/services/intelligence/realEvidencePolicy.ts

export type RealEvidenceDecision = {
  ok: boolean;
  reason: string;
  evidenceMode: "real" | "synthetic" | "demo" | "unknown";
  severity: "low" | "medium" | "high" | "critical";
};

function evidenceText(evidence: Record<string, unknown> = {}): string {
  try {
    return JSON.stringify(evidence).toLowerCase();
  } catch {
    return "";
  }
}

export function evaluateRealEvidencePolicy(input: {
  moduleKey: string;
  intent: string;
  evidence?: Record<string, unknown>;
}): RealEvidenceDecision {
  const evidence = input.evidence || {};
  const text = evidenceText(evidence);

  const synthetic =
    evidence.synthetic === true ||
    evidence.isSynthetic === true ||
    evidence.demo === true ||
    evidence.demoMode === true ||
    text.includes("synthetic") ||
    text.includes("demo signal") ||
    text.includes("mock") ||
    text.includes("placeholder");

  const explicitReal =
    evidence.realEvidence === true ||
    evidence.sourceVerified === true ||
    evidence.evidenceMode === "real" ||
    evidence.dataMode === "real";

  if (synthetic) {
    const allowedIntent = ["scan", "learn"].includes(String(input.intent));

    if (!allowedIntent) {
      return {
        ok: false,
        reason: "Synthetic/demo evidence cannot trigger autonomous execution.",
        evidenceMode: text.includes("demo") ? "demo" : "synthetic",
        severity: "critical",
      };
    }

    return {
      ok: true,
      reason: "Synthetic/demo evidence allowed only for scan/learn, not outbound execution.",
      evidenceMode: text.includes("demo") ? "demo" : "synthetic",
      severity: "medium",
    };
  }

  if (explicitReal) {
    return {
      ok: true,
      reason: "Evidence is explicitly marked as real/verified.",
      evidenceMode: "real",
      severity: "low",
    };
  }

  return {
    ok: true,
    reason: "Evidence mode unknown; allowed but should be upgraded to realEvidence/sourceVerified lineage.",
    evidenceMode: "unknown",
    severity: "medium",
  };
}
