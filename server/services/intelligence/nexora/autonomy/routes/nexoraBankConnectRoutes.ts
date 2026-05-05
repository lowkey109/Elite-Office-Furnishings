import type { Express } from "express";
import fs from "fs";
import path from "path";

type JsonRecord = Record<string, any>;

const ROOT = path.join(process.cwd(), "data", "nexora", "local", "bank-connect");
const STATE_FILE = path.join(ROOT, "state.json");
const EVENTS_FILE = path.join(ROOT, "events.jsonl");

function now() {
  return new Date().toISOString();
}

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function safety() {
  return {
    mode: "read_only_bank_connect",
    rawCardNumbersStored: false,
    cvvStored: false,
    bankPasswordsStored: false,
    rawBankLoginStored: false,
    automaticTransfersEnabled: false,
    automaticDepositsEnabled: false,
    automaticWithdrawalsEnabled: false,
    liveTradingFundingEnabled: false,
    humanApprovalRequired: true,
    externalBankProviderRequired: true
  };
}

function readState(): JsonRecord {
  ensureRoot();

  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
  } catch {}

  return {
    ok: true,
    service: "nexora_bank_connect_state",
    createdAt: now(),
    updatedAt: now(),
    sessions: [],
    connections: [],
    latestSession: null,
    latestConnection: null,
    latestFundingReadiness: null,
    status: "ready",
    safety: safety()
  };
}

function saveState(patch: JsonRecord): JsonRecord {
  ensureRoot();

  const next = {
    ...readState(),
    ...patch,
    updatedAt: now(),
    safety: safety()
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  return next;
}

function logEvent(type: string, payload: JsonRecord) {
  ensureRoot();
  fs.appendFileSync(EVENTS_FILE, JSON.stringify({ ts: now(), type, ...payload, safety: safety() }) + "\n");
}

function createSession(input: JsonRecord = {}) {
  const session = {
    id: `bank-session-${Date.now()}`,
    provider: input.provider || "provider_placeholder",
    country: input.country || "AU",
    mode: "read_only",
    status: "created",
    providerLinkRef: `link-ref-${Date.now()}`,
    redirectUrl: null,
    note: "Provider OAuth/link URL goes here later. Nexora never collects card numbers, CVV, or bank passwords.",
    createdAt: now()
  };

  const state = readState();
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];

  const next = saveState({
    sessions: [...sessions, session].slice(-20),
    latestSession: session,
    status: "session_created"
  });

  logEvent("bank_session_created", session);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_bank_connect_session_create",
    generatedAt: now(),
    session,
    state: next,
    safety: safety()
  };
}

function callback(input: JsonRecord = {}) {
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
    createdAt: now()
  };

  const state = readState();
  const connections = Array.isArray(state.connections) ? state.connections : [];

  const next = saveState({
    connections: [...connections, connection].slice(-20),
    latestConnection: connection,
    status: "connected_read_only"
  });

  logEvent("bank_connection_callback", connection);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_bank_connect_callback",
    generatedAt: now(),
    connection,
    state: next,
    safety: safety()
  };
}

function accounts() {
  const state = readState();
  const connections = Array.isArray(state.connections) ? state.connections : [];

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_bank_connect_accounts",
    generatedAt: now(),
    accounts: connections.map((account: JsonRecord) => ({
      id: account.id,
      provider: account.provider,
      institutionName: account.institutionName,
      accountName: account.accountName,
      accountMask: account.accountMask,
      accountType: account.accountType,
      currency: account.currency,
      status: account.status
    })),
    safety: safety()
  };
}

function balances() {
  const state = readState();
  const connections = Array.isArray(state.connections) ? state.connections : [];

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_bank_connect_balances",
    generatedAt: now(),
    balances: connections.map((account: JsonRecord) => ({
      connectionId: account.id,
      institutionName: account.institutionName,
      accountMask: account.accountMask,
      currency: account.currency || "AUD",
      availableBalance: null,
      currentBalance: null,
      note: "Balance must come from a real provider later. This scaffold stores no credentials."
    })),
    safety: safety()
  };
}

function fundingReadiness(input: JsonRecord = {}) {
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
      { id: "no_live_trading_funding", passed: true }
    ],
    requested: input,
    safety: safety()
  };

  const next = saveState({
    latestFundingReadiness: readiness,
    status: "funding_readiness_checked"
  });

  logEvent("funding_readiness_checked", {
    connected,
    readyToFund: readiness.readyToFund,
    canAutoTransfer: readiness.canAutoTransfer
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
      safety: safety()
    });
  });

  app.post("/api/nexora/bank-connect/session/create", (req, res) => {
    res.json(createSession(req.body || {}));
  });

  app.post("/api/nexora/bank-connect/callback", (req, res) => {
    res.json(callback(req.body || {}));
  });

  app.get("/api/nexora/bank-connect/accounts", (_req, res) => {
    res.json(accounts());
  });

  app.get("/api/nexora/bank-connect/balances", (_req, res) => {
    res.json(balances());
  });

  app.post("/api/nexora/bank-connect/funding-readiness", (req, res) => {
    res.json(fundingReadiness(req.body || {}));
  });
}
