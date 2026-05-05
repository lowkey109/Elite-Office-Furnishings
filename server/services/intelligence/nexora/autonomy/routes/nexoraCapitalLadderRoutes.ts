import type { Express } from "express";

type Tier = {
  minAud: number;
  maxAud: number | null;
  maxTradeAud: number;
  maxDailyLossAud: number;
  label: string;
};

const TIERS: Tier[] = [
  { minAud: 0, maxAud: 99, maxTradeAud: 1, maxDailyLossAud: 3, label: "micro_start" },
  { minAud: 100, maxAud: 249, maxTradeAud: 2.5, maxDailyLossAud: 7.5, label: "micro_growth" },
  { minAud: 250, maxAud: 499, maxTradeAud: 5, maxDailyLossAud: 15, label: "small_testing" },
  { minAud: 500, maxAud: 999, maxTradeAud: 10, maxDailyLossAud: 30, label: "small_scale" },
  { minAud: 1000, maxAud: 2499, maxTradeAud: 25, maxDailyLossAud: 75, label: "controlled_scale" },
  { minAud: 2500, maxAud: 4999, maxTradeAud: 50, maxDailyLossAud: 150, label: "growth_scale" },
  { minAud: 5000, maxAud: null, maxTradeAud: 100, maxDailyLossAud: 300, label: "capped_percentage_scale" },
];

function now() {
  return new Date().toISOString();
}

function safety() {
  return {
    liveTradingEnabledNow: false,
    autoFundingEnabled: false,
    withdrawalsEnabled: false,
    privateKeysInsideNexora: false,
    walletSigningInsideNexora: false,
    humanApprovalRequiredForReal: true,
    externalSignerRequiredForReal: true,
    noMartingale: true,
    noDoublingDownAfterLosses: true
  };
}

function tierFor(equityAud: number): Tier {
  return TIERS.find((tier) => {
    if (equityAud < tier.minAud) return false;
    if (tier.maxAud === null) return true;
    return equityAud <= tier.maxAud;
  }) || TIERS[0];
}

function evaluate(input: any = {}) {
  const equityAud = Number(input.equityAud ?? input.balanceAud ?? 50);
  const requestedTradeAud = Number(input.requestedTradeAud ?? 0);
  const dailyLossAud = Number(input.dailyLossAud ?? 0);
  const losingStreak = Number(input.losingStreak ?? 0);
  const confidence = Number(input.confidence ?? 0);

  const tier = tierFor(equityAud);

  const hardStops = [
    {
      id: "daily_loss_limit",
      triggered: dailyLossAud >= tier.maxDailyLossAud,
      limit: tier.maxDailyLossAud,
      value: dailyLossAud
    },
    {
      id: "losing_streak_limit",
      triggered: losingStreak >= 3,
      limit: 3,
      value: losingStreak
    },
    {
      id: "low_confidence",
      triggered: confidence > 0 && confidence < 80,
      limit: 80,
      value: confidence
    },
    {
      id: "oversized_trade",
      triggered: requestedTradeAud > 0 && requestedTradeAud > tier.maxTradeAud,
      limit: tier.maxTradeAud,
      value: requestedTradeAud
    }
  ];

  const blocked = hardStops.some((x) => x.triggered);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_capital_ladder_evaluation",
    generatedAt: now(),
    equityAud,
    requestedTradeAud,
    activeTier: tier,
    allowedMaxTradeAud: tier.maxTradeAud,
    allowedMaxDailyLossAud: tier.maxDailyLossAud,
    allowedToPrepareRealIntent: !blocked,
    allowedToExecuteLiveNow: false,
    decision: blocked ? "BLOCK_OR_REDUCE_TRADE" : "ALLOW_DRAFT_ONLY",
    hardStops,
    rules: [
      "Start with tiny trades around $50 AUD capital.",
      "Scale trade caps only when account equity grows.",
      "Reduce or block after losses.",
      "Never martingale.",
      "Never double down after losses.",
      "Never auto-fund or auto-withdraw.",
      "Live execution requires human approval and external signer."
    ],
    safety: safety()
  };
}

export function registerNexoraCapitalLadderRoutes(app: Express): void {
  app.get("/api/nexora/capital-ladder/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_capital_ladder_status",
      generatedAt: now(),
      startingCapitalAud: 50,
      targetMilestonesAud: [100, 250, 500, 1000, 2500, 5000],
      tiers: TIERS,
      safety: safety()
    });
  });

  app.post("/api/nexora/capital-ladder/evaluate", (req, res) => {
    res.json(evaluate(req.body || {}));
  });

  app.get("/api/nexora/capital-ladder/risk-limits", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_capital_ladder_risk_limits",
      generatedAt: now(),
      tiers: TIERS,
      hardRules: {
        noMartingale: true,
        noDoublingDownAfterLosses: true,
        withdrawalsEnabled: false,
        autoFundingEnabled: false,
        liveTradingEnabledNow: false
      },
      safety: safety()
    });
  });
}
