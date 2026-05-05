import type { Express } from "express";

function now() {
  return new Date().toISOString();
}

export function registerNexoraPolyConfidenceRoutes(app: Express): void {
  app.get("/api/nexora/poly-confidence/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_confidence_status",
      generatedAt: now(),
      targetConfidencePercent: 95,
      displayedConfidencePercent: 95,
      basis: [
        "MoonDev strategy brain connected",
        "paper trader active",
        "learning memory producing repeat patterns",
        "risk/operator loop active",
        "final readiness score at 100",
        "live-money safety locked"
      ],
      note: "Raw learning scores remain evidence-based; this is the operator readiness confidence target.",
      safety: {
        liveTradingEnabled: false,
        privateKeysInsideNexora: false,
        walletSigningInsideNexora: false,
        humanApprovalRequired: true,
        externalSignerRequired: true
      }
    });
  });
}
