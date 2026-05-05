import type { Express } from "express";

function now() {
  return new Date().toISOString();
}

function safety() {
  return {
    rawCardNumbersStored: false,
    cvvStored: false,
    bankPasswordsStored: false,
    rawBankLoginStored: false,
    automaticTransfersEnabled: false,
    automaticDepositsEnabled: false,
    automaticWithdrawalsEnabled: false,
    liveTradingFundingEnabled: false,
    providerMetadataOnly: true,
    humanApprovalRequired: true,
    externalProviderRequired: true
  };
}

export function registerNexoraBankProviderPlanRoutes(app: Express): void {
  app.get("/api/nexora/bank-provider-plan/status", (_req, res) => {
    res.json({
      ok: true,
      service: "nexora_bank_provider_plan_status",
      generatedAt: now(),
      status: "provider_planning_ready",
      recommendedOrder: [
        "Basiq or Australian Open Banking provider for read-only bank data",
        "Stripe only if customer subscriptions/card payments are needed",
        "Binance for exchange market/account readiness",
        "External signer for wallet-based execution later"
      ],
      safety: safety()
    });
  });

  app.get("/api/nexora/bank-provider-plan/checklist", (_req, res) => {
    res.json({
      ok: true,
      service: "nexora_bank_provider_plan_checklist",
      generatedAt: now(),
      checklist: [
        "Choose provider jurisdiction: AU first",
        "Use OAuth/provider-hosted connection only",
        "Store provider customer/connection IDs only",
        "Never store raw card numbers",
        "Never store CVV",
        "Never store bank passwords",
        "Never enable automatic transfers",
        "Use read-only account/balance scopes first",
        "Require human approval for funding",
        "Keep live trading funding disabled"
      ],
      requiredEnvLater: [
        "BANK_PROVIDER_NAME",
        "BANK_PROVIDER_CLIENT_ID",
        "BANK_PROVIDER_WEBHOOK_SECRET"
      ],
      neverStoreInEnv: [
        "bank_login_password",
        "raw_card_number",
        "cvv",
        "seed_phrase",
        "private_key"
      ],
      safety: safety()
    });
  });

  app.post("/api/nexora/bank-provider-plan/readiness", (req, res) => {
    const provider = String(req.body?.provider || "provider_not_selected");
    const country = String(req.body?.country || "AU");
    res.json({
      ok: true,
      service: "nexora_bank_provider_readiness",
      generatedAt: now(),
      provider,
      country,
      readyForReadOnlyScaffold: true,
      readyForMoneyMovement: false,
      blockersForMoneyMovement: [
        "No human approval workflow selected",
        "No provider production contract confirmed",
        "No funding limits confirmed",
        "No live trading approval",
        "No external signer/payment execution review"
      ],
      safety: safety()
    });
  });
}
