import fs from "fs/promises";
import path from "path";
import { listPropertyOpportunities } from "./propertyIntelligenceService";

type Territory = {
  id: string;
  tenantId: string;
  name: string;
  city?: string;
  state?: string;
  suburbs?: string[];
  signalTypes?: string[];
  minScore?: number;
  createdAt: string;
};

type LeaseHawkAction = {
  id: string;
  tenantId: string;
  opportunityId: string;
  actionType: "request_quote" | "request_intro" | "save_opportunity" | "dismiss" | "request_report";
  notes?: string;
  createdAt: string;
};

type Store = {
  territories: Territory[];
  actions: LeaseHawkAction[];
};

const DATA_DIR = path.resolve(process.cwd(), ".nexora-data");
const STORE_FILE = path.join(DATA_DIR, "leasehawk-store.json");

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function text(value: any) {
  return String(value || "").trim();
}

function lower(value: any) {
  return text(value).toLowerCase();
}

async function loadStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      territories: Array.isArray(parsed.territories) ? parsed.territories : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    return { territories: [], actions: [] };
  }
}

async function saveStore(store: Store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export function getLeaseHawkPlanLimits(plan: string) {
  const limits: Record<string, any> = {
    free: { locked: true, maxOpportunities: 5, maxTerritories: 0, exports: false, reports: false, outreach: false, label: "Sample only" },
    starter: { locked: true, maxOpportunities: 10, maxTerritories: 0, exports: false, reports: false, outreach: false, label: "Upgrade required" },
    growth: { locked: true, maxOpportunities: 15, maxTerritories: 0, exports: false, reports: false, outreach: false, label: "Upgrade required" },
    "leasehawk-pro": { locked: false, maxOpportunities: 50, maxTerritories: 1, exports: false, reports: true, outreach: true, label: "LeaseHawk Pro" },
    "leasehawk-plus": { locked: false, maxOpportunities: 250, maxTerritories: 5, exports: true, reports: true, outreach: true, label: "LeaseHawk Pro Plus" },
    enterprise: { locked: false, maxOpportunities: 1000, maxTerritories: 999, exports: true, reports: true, outreach: true, label: "Enterprise" },
    "phantomx-paper": { locked: true, maxOpportunities: 5, maxTerritories: 0, exports: false, reports: false, outreach: false, label: "PhantomX only" },
    "phantomx-pro": { locked: true, maxOpportunities: 5, maxTerritories: 0, exports: false, reports: false, outreach: false, label: "PhantomX only" },
    "phantomx-live-readiness": { locked: true, maxOpportunities: 5, maxTerritories: 0, exports: false, reports: false, outreach: false, label: "Private review" },
  };

  return limits[plan] || limits.free;
}

export function enhanceLeaseHawkOpportunity(raw: any) {
  const signal = lower(raw.signalType);
  const score = Number(raw.opportunityScore || 0);
  const urgency = Number(raw.urgencyScore || 0);
  const confidence = Number(raw.confidenceScore || 0);

  const commercialWeight =
    signal.includes("lease") ? 20 :
    signal.includes("relocation") ? 18 :
    signal.includes("office") ? 14 :
    signal.includes("expansion") ? 12 :
    signal.includes("fitout") ? 10 :
    4;

  const residentialWeight =
    signal.includes("house_for_sale") ? 22 :
    signal.includes("unit_for_sale") ? 18 :
    signal.includes("townhouse_for_sale") ? 18 :
    signal.includes("land_for_sale") ? 16 :
    signal.includes("residential_listing") ? 20 :
    signal.includes("new_home_listing") ? 20 :
    signal.includes("builder_inventory") ? 22 :
    signal.includes("display_home") ? 18 :
    signal.includes("development_site") ? 20 :
    signal.includes("project_marketing") ? 16 :
    0;

  const leasehawkScore = Math.max(
    0,
    Math.min(100, Math.round(score * 0.5 + urgency * 0.22 + confidence * 0.18 + commercialWeight + residentialWeight)),
  );

  const salesReadiness =
    leasehawkScore >= 80 && confidence >= 50 ? "hot" :
    leasehawkScore >= 60 ? "warm" :
    "watch";

  const recommendedAction =
    residentialWeight > 0 && salesReadiness === "hot"
      ? "Verify the property listing source, then prepare buyer/seller/property-service outreach within 24 hours."
      : residentialWeight > 0 && salesReadiness === "warm"
        ? "Review listing details, suburb demand and contact opportunity before outreach."
        : salesReadiness === "hot"
          ? "Prepare quote/intro outreach within 24 hours."
          : salesReadiness === "warm"
            ? "Verify public source and prepare cautious outreach."
            : "Monitor for stronger confirmation before outreach.";

  return {
    ...raw,
    leasehawkScore,
    salesReadiness,
    recommendedAction,
    subscriptionValue:
      residentialWeight > 0
        ? "Residential/property listing opportunity for LeaseHawk users."
        : "Commercial lease/workspace opportunity for LeaseHawk users.",
    displayLocation: [raw.city, raw.state].filter(Boolean).join(", "),
    customerSafe: true,
  };
}

function filterForTerritories(rows: any[], territories: Territory[]) {
  if (!territories.length) return rows;

  return rows.filter((row) =>
    territories.some((t) => {
      const cityOk = !t.city || lower(row.city) === lower(t.city);
      const stateOk = !t.state || lower(row.state) === lower(t.state);
      const scoreOk = !t.minScore || Number(row.leasehawkScore || row.opportunityScore || 0) >= Number(t.minScore);
      const signalOk = !t.signalTypes?.length || t.signalTypes.some((sig) => lower(row.signalType).includes(lower(sig)));
      const suburbOk = !t.suburbs?.length || t.suburbs.some((suburb) => lower(row.suburb || row.address || row.city).includes(lower(suburb)));
      return cityOk && stateOk && scoreOk && signalOk && suburbOk;
    }),
  );
}

export async function getLeaseHawkFeedForTenant(options: {
  tenantId: string;
  plan: string;
  city?: string;
  state?: string;
  minScore?: number;
  signalType?: string;
}) {
  const store = await loadStore();
  const limits = getLeaseHawkPlanLimits(options.plan);
  const data = await listPropertyOpportunities({});

  const territories = store.territories.filter((t) => t.tenantId === options.tenantId);

  let rows = (data.opportunities || []).map(enhanceLeaseHawkOpportunity);

  if (options.city) rows = rows.filter((o: any) => lower(o.city) === lower(options.city));
  if (options.state) rows = rows.filter((o: any) => lower(o.state) === lower(options.state));
  if (options.signalType) rows = rows.filter((o: any) => lower(o.signalType).includes(lower(options.signalType)));
  if (options.minScore) rows = rows.filter((o: any) => Number(o.leasehawkScore || 0) >= Number(options.minScore));

  rows = filterForTerritories(rows, territories)
    .sort((a: any, b: any) => Number(b.leasehawkScore || 0) - Number(a.leasehawkScore || 0))
    .slice(0, limits.maxOpportunities)
    .map((o: any) => ({
      id: o.id,
      companyName: o.companyName,
      projectName: o.projectName,
      propertyName: o.propertyName,
      city: o.city,
      state: o.state,
      displayLocation: o.displayLocation,
      signalType: o.signalType,
      opportunityType: o.opportunityType,
      opportunityScore: o.opportunityScore,
      urgencyScore: o.urgencyScore,
      confidenceScore: o.confidenceScore,
      leasehawkScore: o.leasehawkScore,
      salesReadiness: o.salesReadiness,
      recommendedAction: o.recommendedAction,
      subscriptionValue: o.subscriptionValue,
      estimatedSeats: o.estimatedSeats,
      estimatedSqm: o.estimatedSqm,
      sourceName: o.sourceName,
      assignedTier: o.assignedTier,
      status: o.status,
    }));

  return {
    ok: true,
    product: "Nexora LeaseHawk",
    plan: options.plan,
    limits,
    locked: Boolean(limits.locked),
    generatedAt: now(),
    territories,
    opportunities: rows,
    sourceHealth: data.sources || [],
    actions: store.actions.filter((a) => a.tenantId === options.tenantId).slice(-100),
    upgradeMessage: limits.locked
      ? "Upgrade to LeaseHawk Pro to unlock full opportunity intelligence, saved territories, reports and outreach tools."
      : null,
  };
}

export async function createLeaseHawkTerritory(input: any) {
  const store = await loadStore();
  const limits = getLeaseHawkPlanLimits(input.plan);
  const current = store.territories.filter((t) => t.tenantId === input.tenantId);

  if (limits.locked || current.length >= limits.maxTerritories) {
    return { ok: false, upgradeRequired: true, error: "Your current plan does not allow another saved territory.", limits };
  }

  const territory: Territory = {
    id: id("territory"),
    tenantId: input.tenantId,
    name: input.name || "Saved territory",
    city: input.city || "",
    state: input.state || "",
    suburbs: Array.isArray(input.suburbs) ? input.suburbs : [],
    signalTypes: Array.isArray(input.signalTypes) ? input.signalTypes : [],
    minScore: Number(input.minScore || 50),
    createdAt: now(),
  };

  store.territories.push(territory);
  await saveStore(store);
  return { ok: true, territory, limits };
}

export async function recordLeaseHawkAction(input: any) {
  const store = await loadStore();

  const action: LeaseHawkAction = {
    id: id("lh-action"),
    tenantId: input.tenantId,
    opportunityId: input.opportunityId,
    actionType: input.actionType,
    notes: input.notes || "",
    createdAt: now(),
  };

  store.actions.push(action);
  await saveStore(store);
  return { ok: true, action };
}

export async function generateLeaseHawkReport(options: { tenantId: string; plan: string }) {
  const feed = await getLeaseHawkFeedForTenant(options);

  if (!feed.limits.reports) {
    return { ok: false, upgradeRequired: true, error: "Reports require LeaseHawk Pro or higher." };
  }

  const hot = feed.opportunities.filter((o: any) => o.salesReadiness === "hot");
  const warm = feed.opportunities.filter((o: any) => o.salesReadiness === "warm");

  return {
    ok: true,
    reportName: "Nexora LeaseHawk Weekly Opportunity Report",
    generatedAt: now(),
    summary: {
      totalVisible: feed.opportunities.length,
      hot: hot.length,
      warm: warm.length,
      watch: feed.opportunities.length - hot.length - warm.length,
      topCity: feed.opportunities[0]?.city || null,
    },
    topOpportunities: feed.opportunities.slice(0, 10),
    recommendedFocus:
      hot.length > 0
        ? "Prioritise hot opportunities and verify public source evidence before outreach."
        : warm.length > 0
          ? "Work through warm opportunities and monitor for confirmation signals."
          : "Continue monitoring territories until stronger signals emerge.",
  };
}

export async function exportLeaseHawkCsv(options: { tenantId: string; plan: string }) {
  const feed = await getLeaseHawkFeedForTenant(options);

  if (!feed.limits.exports) {
    return { ok: false, upgradeRequired: true, error: "CSV export requires LeaseHawk Pro Plus or Enterprise." };
  }

  const headers = ["Company", "Project", "City", "State", "Signal", "LeaseHawk Score", "Readiness", "Recommended Action"];

  const lines = [
    headers.join(","),
    ...feed.opportunities.map((o: any) =>
      [
        o.companyName || "",
        o.projectName || "",
        o.city || "",
        o.state || "",
        o.signalType || "",
        o.leasehawkScore || "",
        o.salesReadiness || "",
        o.recommendedAction || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    ),
  ];

  return { ok: true, fileName: "leasehawk-opportunities.csv", contentType: "text/csv", csv: lines.join("\n") };
}

export async function getAdminLeaseHawkOverview() {
  const data = await listPropertyOpportunities({});
  const rows = (data.opportunities || []).map(enhanceLeaseHawkOpportunity);
  const hot = rows.filter((o: any) => o.salesReadiness === "hot");
  const warm = rows.filter((o: any) => o.salesReadiness === "warm");

  return {
    ok: true,
    product: "Nexora LeaseHawk",
    generatedAt: now(),
    stats: {
      total: rows.length,
      hot: hot.length,
      warm: warm.length,
      watch: rows.length - hot.length - warm.length,
      averageScore: rows.length
        ? Math.round(rows.reduce((sum: number, o: any) => sum + Number(o.leasehawkScore || 0), 0) / rows.length)
        : 0,
    },
    topOpportunities: rows.sort((a: any, b: any) => b.leasehawkScore - a.leasehawkScore).slice(0, 25),
    sourceHealth: data.sources || [],
  };
}
