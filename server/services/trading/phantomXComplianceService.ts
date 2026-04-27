import fs from "fs/promises";
import path from "path";

export type PhantomXApplicationStatus =
  | "draft"
  | "submitted"
  | "reviewing"
  | "more_info_required"
  | "approved_for_readiness_only"
  | "declined"
  | "closed";

export type PhantomXLiveReadinessApplication = {
  id: string;
  tenantId: string;
  clientUserId: string;
  clientEmail: string;
  clientCompanyName: string;
  status: PhantomXApplicationStatus;
  requestedMode: "paper_review" | "live_readiness" | "exchange_connection_review";
  tradingExperience: string;
  understandsRisk: boolean;
  acceptsNoFinancialAdvice: boolean;
  acceptsNoProfitGuarantee: boolean;
  acceptsPaperFirst: boolean;
  acceptsKillSwitch: boolean;
  confirmsOwnFunds: boolean;
  confirmsNoBorrowedFunds: boolean;
  maxMonthlyLossLimit?: string;
  maxDailyLossLimit?: string;
  preferredExchange?: string;
  notes?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
};

type Store = {
  applications: PhantomXLiveReadinessApplication[];
};

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const STORE_FILE = path.join(DATA_DIR, "phantomx-compliance-store.json");

function now() {
  return new Date().toISOString();
}

function id(prefix = "phantomx-app") {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

async function loadStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
    };
  } catch {
    return { applications: [] };
  }
}

async function saveStore(store: Store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function submitPhantomXApplication(input: any) {
  const requiredBooleans = [
    "understandsRisk",
    "acceptsNoFinancialAdvice",
    "acceptsNoProfitGuarantee",
    "acceptsPaperFirst",
    "acceptsKillSwitch",
    "confirmsOwnFunds",
    "confirmsNoBorrowedFunds",
  ];

  const missing = requiredBooleans.filter((key) => input[key] !== true);

  if (missing.length) {
    return {
      ok: false,
      error: "All risk and compliance acknowledgements are required before submitting.",
      missing,
    };
  }

  const store = await loadStore();

  const application: PhantomXLiveReadinessApplication = {
    id: id(),
    tenantId: input.tenantId,
    clientUserId: input.clientUserId,
    clientEmail: input.clientEmail || "",
    clientCompanyName: input.clientCompanyName || "",
    status: "submitted",
    requestedMode: input.requestedMode || "live_readiness",
    tradingExperience: String(input.tradingExperience || ""),
    understandsRisk: true,
    acceptsNoFinancialAdvice: true,
    acceptsNoProfitGuarantee: true,
    acceptsPaperFirst: true,
    acceptsKillSwitch: true,
    confirmsOwnFunds: true,
    confirmsNoBorrowedFunds: true,
    maxMonthlyLossLimit: String(input.maxMonthlyLossLimit || ""),
    maxDailyLossLimit: String(input.maxDailyLossLimit || ""),
    preferredExchange: String(input.preferredExchange || ""),
    notes: String(input.notes || ""),
    adminNotes: "",
    createdAt: now(),
    updatedAt: now(),
  };

  store.applications.unshift(application);
  await saveStore(store);

  return {
    ok: true,
    application,
    message: "PhantomX live-readiness application submitted. This does not enable live trading.",
  };
}

export async function listClientPhantomXApplications(tenantId: string) {
  const store = await loadStore();
  return {
    ok: true,
    applications: store.applications.filter((app) => app.tenantId === tenantId),
  };
}

export async function listAdminPhantomXApplications(filters: any = {}) {
  const store = await loadStore();
  let rows = store.applications;

  if (filters.status) rows = rows.filter((row) => row.status === filters.status);

  return {
    ok: true,
    count: rows.length,
    applications: rows,
    stats: {
      total: store.applications.length,
      submitted: store.applications.filter((a) => a.status === "submitted").length,
      reviewing: store.applications.filter((a) => a.status === "reviewing").length,
      approvedForReadinessOnly: store.applications.filter((a) => a.status === "approved_for_readiness_only").length,
      declined: store.applications.filter((a) => a.status === "declined").length,
    },
  };
}

export async function updateAdminPhantomXApplication(id: string, patch: Partial<PhantomXLiveReadinessApplication>) {
  const store = await loadStore();
  const index = store.applications.findIndex((app) => app.id === id);

  if (index === -1) {
    return { ok: false, error: "Application not found" };
  }

  store.applications[index] = {
    ...store.applications[index],
    ...patch,
    updatedAt: now(),
  };

  await saveStore(store);

  return {
    ok: true,
    application: store.applications[index],
  };
}

export function getPhantomXComplianceRules() {
  return {
    ok: true,
    product: "PhantomX Live Readiness",
    liveTradingEnabled: false,
    liveTradingDefault: "disabled",
    publicCheckoutEnabled: false,
    rules: [
      "Paper trading is free and must remain separate from live-money trading.",
      "No customer receives financial advice from PhantomX.",
      "No profit is guaranteed.",
      "Live exchange connection requires private review.",
      "Customer must own and control their exchange account.",
      "Withdrawal permissions should not be granted to API keys.",
      "Daily and monthly loss limits must be configured before any live-readiness pathway.",
      "Kill switch must remain available.",
      "Audit logs must record decisions, limits and actions.",
      "Approval for live readiness does not mean live trading is enabled.",
    ],
  };
}
