import type { Express } from "express";

function nowIso(): string {
  return new Date().toISOString();
}

function safety() {
  return {
    currentMode: "paper_learning",
    targetMode: "supervised_real_money_after_approval",
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    externalSignerRequired: true,
    humanApprovalRequired: true,
  };
}

export function registerNexoraPolyOperatorControlRoutes(app: Express): void {
  app.get("/api/nexora/poly-operator/control", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_operator_control",
      generatedAt: nowIso(),
      title: "Phantom X / Polymarket Control",
      mode: "paper_learning_to_supervised_real_money",
      cards: [
        {
          id: "poly_app",
          title: "Poly App Core",
          route: "/api/nexora/poly-app/status",
          status: "wired",
        },
        {
          id: "risk_loop",
          title: "Risk / Kill Switch Loop",
          route: "/api/nexora/poly-builds/bash2/loop/latest",
          status: "wired",
        },
        {
          id: "final_readiness",
          title: "Final Readiness",
          route: "/api/nexora/poly-builds/final/latest",
          status: "wired",
        },
        {
          id: "trade_intent",
          title: "Trade Intent Draft",
          route: "/api/nexora/poly-builds/final/trade-intent-draft",
          status: "draft_only",
        },
        {
          id: "real_money_gate",
          title: "Real Money Gate",
          route: "/api/nexora/poly-builds/final/promotion-gate",
          status: "locked_until_human_approval",
        },
      ],
      nextHumanActions: [
        "Review paper learning evidence",
        "Review risk and kill-switch evidence",
        "Review final readiness",
        "Only later approve external signer preparation",
      ],
      safety: safety(),
    });
  });
}
