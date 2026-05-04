import type { Express } from "express";

type JsonValue = Record<string, any>;

function nowIso(): string {
  return new Date().toISOString();
}

function paperSafety() {
  return {
    mode: "paper",
    liveTradingEnabled: false,
    liveOrdersEnabled: false,
    privateKeysAllowed: false,
    walletSigningAllowed: false,
    postgresReplayAllowed: false,
    deployAllowed: false,
    humanApprovalRequired: true,
  };
}

function polyAppStatus(): JsonValue {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_app_status",
    generatedAt: nowIso(),
    product: "Phantom X / Polymarket",
    mode: "paper",
    status: "api_online",
    components: {
      marketData: "/api/nexora/market-data/status",
      backtesting: "/api/nexora/backtesting/status",
      tradingExecution: "/api/nexora/trading-execution/status",
      tradingReadiness: "/api/nexora/trading-readiness/status",
      liveMoneyReadiness: "/api/nexora/live-money/status",
      liveExecutionDesign: "/api/nexora/live-execution-design/status",
      polymarketFinal: "/api/nexora/polymarket-final/status",
      polyFive: "/api/nexora/poly-five/status",
      polyNextFive: "/api/nexora/poly-next-five/status",
      polyFinalFive: "/api/nexora/poly-final-five/status",
      moonDevStrategyImport: "/api/nexora/moondev-strategy-import/status",
      moonDevPhase1: "/api/nexora/moondev-phase1/status",
    },
    safety: paperSafety(),
  };
}

function polyAppReadiness(): JsonValue {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_poly_app_readiness",
    generatedAt: nowIso(),
    paperModeReady: true,
    productionLiveMoneyReady: false,
    blockersForLiveMoney: [
      "DB storage upgrade not confirmed",
      "external signer not implemented",
      "human approval gates must remain enforced",
      "live order execution intentionally disabled",
    ],
    requiredBeforeLive: [
      "owner approval",
      "external signer review",
      "kill-switch stress pass",
      "paper evidence pass",
      "auth enforcement",
      "durable storage upgrade",
    ],
    safety: paperSafety(),
  };
}

export function registerNexoraPolyAppRoutes(app: Express): void {
  app.get("/api/nexora/poly-app/status", (_req, res) => {
    res.json(polyAppStatus());
  });

  app.get("/api/nexora/poly-app/readiness", (_req, res) => {
    res.json(polyAppReadiness());
  });

  app.post("/api/nexora/poly-app/cycle", (req, res) => {
    const body = (req.body || {}) as JsonValue;
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_app_cycle",
      generatedAt: nowIso(),
      accepted: true,
      mode: "paper",
      requested: body,
      actions: [
        "checked paper-mode boundary",
        "confirmed live trading remains blocked",
        "confirmed external signing is not performed inside Nexora",
      ],
      nextRoutes: [
        "/api/nexora/poly-app/readiness",
        "/api/nexora/trading-readiness/status",
        "/api/nexora/poly-final-five/status",
      ],
      safety: paperSafety(),
    });
  });

  app.post("/api/nexora/poly-app/batch", (req, res) => {
    const body = (req.body || {}) as JsonValue;
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_poly_app_batch",
      generatedAt: nowIso(),
      accepted: true,
      mode: "paper",
      batch: body.batch || "evidence",
      requested: body,
      evidence: {
        statusRoute: "/api/nexora/poly-app/status",
        readinessRoute: "/api/nexora/poly-app/readiness",
        finalFiveRoute: "/api/nexora/poly-final-five/status",
      },
      safety: paperSafety(),
    });
  });
}
