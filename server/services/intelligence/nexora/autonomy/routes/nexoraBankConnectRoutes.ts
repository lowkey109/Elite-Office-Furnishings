import type { Express } from "express";
import fs from "fs";
import path from "path";

type R = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "bank-connect");
const STATE = path.join(ROOT, "state.json");
const EVENTS = path.join(ROOT, "events.jsonl");

function now() {
  return new Date().toISOString();
}

function ensure() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safety() {
  return {
    mode: "read_only_bank_connect_scaffold",
    rawCardNumbersStored: false,
    cvvStored: false,
    bankPasswordsStored: false,
    rawBankLoginStored: false,
    rawProviderAccessTokenStored: false,
    automaticTransfersEnabled: false,
    automaticDepositsEnabled: false,
    automaticWithdrawalsEnabled: false,
    liveTradingFundingEnabled: false,
    providerTokenMetadataOnly: true,
    humanApprovalRequired: true,
    externalBankProviderRequired: true,
  };
}

function readState(): R {
  ensure();
  try {
    if (fs.existsSync(STATE)) return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {}

  return {
    ok: true,
    service: "nexora_bank_connect_state",
    createdAt: now(),
    updatedAt: now(),
    sessions: [],
    connections: [],
    fundingRequests: [],
    latestSession: null,
    latestConnection: null,
    latestFundingReadiness: null,
    status: "ready",
    safety: safety(),
  };
}

function save(patch: R): R {
  ensure();
  const next = {
    ...readState(),
    ...patch,
    updatedAt: now(),
    safety: safety(),
  };
  fs.writeFileSync(STATE, JSON.stringify(next, null, 2));
  return next;
}

function event(type: string, payload: R) {
  ensure();
  fs.appendFileSync(EVENTS, JSON.stringify({ ts: now(), type, ...payload }) + "\n");
}

function createSession(input: R = {}) {
  const session = {
    id: `bank-session-${Date.now()}`,
    provider: input.provider || "provider_placeholder",
    country: input.country || "AU",
    mode: "read_only",
    status: "created",
    providerLinkRef: `link-ref-${Date.now()}`,
    redirectUrl: null,
    note: "A real bank/card provider link URL goes here later. Nexora never collects card numbers, CVV, or bank passwords.",
    createdAt: now(),
  };

  const state = readState();
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];

  const next = save({
    sessions: [...sessions, session].slice(-20),
    latestSession: session,
    status: "session_created",
  });

  event("bank_session_created", {
    id: session.id,
    provider: session.provider,
    country: session.country,
    mode: session.mode,
  });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_bank_connect_session_create",
    generatedAt: now(),
    session,
    state: next,
    safety: safety(),
  };
}

function callback(input: R = {}) {
  const connection = {
    id: input.connectionId || `bank-connection-${Date.now()}`,
    provider: input.provider || "provider_placeholder",
    providerCustomerRef: input.providerCustomerRef || null,
    providerConnectionRef: input.providerConnectionRef || `provider-connection-${Date.now()}`,
    institutionName: input.institutionName || "Demo Bank",
    accountName: input.accountName || "Read-only account",
    accountMask: input.accountMask || "****0000",
    accountType: input.accountType || "checking",
    currency: input.currency || "AUD",
    status: "connected_read_only",
    permissions: ["accounts:read", "balances:read"],
    createdAt: now(),
    storedFields: [
      "provider",
      "providerCustomerRef",
      "providerConnectionRef",
      "institutionName",
      "accountName",
      "accountMask",
      "accountType",
      "currency",
      "status",
    ],
    neverStored: [
      "raw card number",
      "CVV",
      "bank password",
      "raw bank login",
      "raw provider access token",
    ],
  };

  const state = readState();
  const connections = Array.isArray(state.connections) ? state.connections : [];

  const next = save({
    connections: [...connections, connection].slice(-20),
    latestConnection: connection,
    status: "connected_read_only",
  });

  event("bank_connection_callback", {
    id: connection.id,
    provider: connection.provider,
    institutionName: connection.institutionName,
    accountMask: connection.accountMask,
    status: connection.status,
  });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_bank_connect_callback",
    generatedAt: now(),
    connection,
    state: next,
    safety: safety(),
  };
}

function accounts() {
  const state = readState();
  const list = Array.isArray(state.connections) ? state.connections : [];

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_bank_connect_accounts",
    generatedAt: now(),
    accounts: list.map((a: R) => ({
      id: a.id,
      provider: a.provider,
      institutionName: a.institutionName,
      accountName: a.accountName,
      accountMask: a.accountMask,
      accountType: a.accountType,
      currency: a.currency,
      status: a.status,
    })),
    safety: safety(),
  };
}

function balances() {
  const state = readState();
  const list = Array.isArray(state.connections) ? state.connections : [];

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_bank_connect_balances",
    generatedAt: now(),
    balances: list.map((a: R) => ({
      connectionId: a.id,
      institutionName: a.institutionName,
      accountMask: a.accountMask,
      currency: a.currency || "AUD",
      availableBalance: null,
      currentBalance: null,
      note: "Balance must come from real provider later. This scaffold stores no credentials.",
    })),
    safety: safety(),
  };
}

function fundingReadiness(input: R = {}) {
  const state = readState();
  const connections = Array.isArray(state.connections) ? state.connections : [];
  const connected = connections.length > 0;

  const readiness = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_bank_funding_readiness",
    generatedAt: now(),
    connected,
    readyToFund: false,
    canAutoTransfer: false,
    canAutoDeposit: false,
    canAutoWithdraw: false,
    liveTradingFundingEnabled: false,
    requiresHumanApproval: true,
    requiresExternalProvider: true,
    reason: connected
      ? "Read-only bank metadata exists. Funding still requires human approval and external provider execution."
      : "No read-only bank connection yet.",
    checks: [
      { id: "read_only_connection", passed: connected },
      { id: "no_raw_credentials", passed: true },
      { id: "no_raw_card_numbers", passed: true },
      { id: "human_approval_required", passed: true },
      { id: "external_provider_required", passed: true },
      { id: "no_autonomous_transfers", passed: true },
      { id: "no_live_trading_funding", passed: true },
    ],
    requested: input,
    safety: safety(),
  };

  const fundingRequests = Array.isArray(state.fundingRequests) ? state.fundingRequests : [];
  const next = save({
    latestFundingReadiness: readiness,
    fundingRequests: [...fundingRequests, readiness].slice(-20),
    status: "funding_readiness_checked",
  });

  event("funding_readiness_checked", {
    connected,
    readyToFund: readiness.readyToFund,
    canAutoTransfer: readiness.canAutoTransfer,
  });

  return { ...readiness, state: next };
}

export function registerNexoraBankConnectRoutes(app: Express): void {
  app.get("/api/nexora/bank-connect/status", (_req, res) => {
    res.json({
      ok: true,
      nexoraBrain: true,
      service: "nexora_bank_connect_status",
      generatedAt: now(),
      state: readState(),
      safety: safety(),
    });
  });

  app.post("/api/nexora/bank-connect/session/create", (req, res) => {
    res.json(createSession((req.body || {}) as R));
  });

  app.post("/api/nexora/bank-connect/callback", (req, res) => {
    res.json(callback((req.body || {}) as R));
  });

  app.get("/api/nexora/bank-connect/accounts", (_req, res) => {
    res.json(accounts());
  });

  app.get("/api/nexora/bank-connect/balances", (_req, res) => {
    res.json(balances());
  });

  app.post("/api/nexora/bank-connect/funding-readiness", (req, res) => {
    res.json(fundingReadiness((req.body || {}) as R));
  });
}
