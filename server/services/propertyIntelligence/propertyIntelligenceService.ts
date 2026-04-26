import { scorePropertyOpportunity } from "./propertyScoring";

export type PropertyOpportunity = {
  id: string;
  companyName?: string | null;
  builderName?: string | null;
  developerName?: string | null;
  agencyName?: string | null;
  projectName?: string | null;
  propertyName?: string | null;
  address?: string | null;
  suburb?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  propertyType?: string | null;
  listingType?: string | null;
  signalType?: string | null;
  opportunityType?: string | null;
  estimatedProjectValue?: number | null;
  estimatedFurnitureValue?: number | null;
  estimatedFitoutValue?: number | null;
  estimatedSeats?: number | null;
  estimatedSqm?: number | null;
  listingStatus?: string | null;
  projectStage?: string | null;
  confidenceScore: number;
  opportunityScore: number;
  urgencyScore: number;
  sourceUrl?: string | null;
  sourceName?: string | null;
  sourceType?: string | null;
  sourcePublishedAt?: string | null;
  extractedAt: string;
  createdAt: string;
  updatedAt: string;
  notes?: string | null;
  nextBestAction?: string | null;
  suggestedOutreach?: any;
  assignedTier?: "free" | "starter" | "growth" | "enterprise";
  subscriptionVisibility?: "public_sample" | "client" | "admin_only";
  status: "new" | "reviewing" | "outreach_ready" | "pushed_to_radar" | "dismissed";
  scoreBreakdown?: Record<string, unknown>;
};

const manualStore = new Map<string, PropertyOpportunity>();

function id(prefix = "prop") {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function now() {
  return new Date().toISOString();
}

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchLocalJson(path: string) {
  const port = process.env.PORT || "5000";
  const url = `http://localhost:${port}${path}`;
  try {
    const res = await fetch(url, { headers: { "x-tcd-admin-auth": "true" } });
    const text = await res.text();
    if (!res.ok) return { connected: false, path, status: res.status, error: text.slice(0, 300), data: null };
    try {
      return { connected: true, path, status: res.status, data: JSON.parse(text) };
    } catch {
      return { connected: false, path, status: res.status, error: "not_json", data: null };
    }
  } catch (error: any) {
    return { connected: false, path, error: error?.message || String(error), data: null };
  }
}

function fromMarketMarker(m: any): PropertyOpportunity {
  const t = now();
  const estimatedSeats = num(m.estimatedHeadcount, 0) || null;
  const estimatedSqm = num(m.estimatedOfficeSizeSqm, 0) || null;
  const estimatedProjectValue = num(m.estimatedProjectValue, 0) || null;

  const score = scorePropertyOpportunity({
    signalType: m.signalType,
    sourceType: "market_map",
    sourceUrl: m.sourceUrl,
    city: m.city,
    state: m.state,
    estimatedSeats,
    estimatedSqm,
    estimatedProjectValue,
    sourcePublishedAt: m.dateDetected,
    extractedAt: t,
  });

  return {
    id: String(m.id || id("map")),
    companyName: m.companyName || null,
    projectName: m.companyName ? `${m.companyName} workspace opportunity` : null,
    city: m.city || null,
    state: m.state || null,
    country: "Australia",
    propertyType: "commercial_office",
    listingType: "opportunity_signal",
    signalType: m.signalType || "unknown",
    opportunityType: "workspace_fitout_furniture_finance",
    estimatedProjectValue,
    estimatedFurnitureValue: estimatedSeats ? estimatedSeats * 2500 : null,
    estimatedFitoutValue: estimatedSqm ? estimatedSqm * 900 : null,
    estimatedSeats,
    estimatedSqm,
    listingStatus: m.status || "New",
    projectStage: "signal_detected",
    sourceUrl: m.sourceUrl || null,
    sourceName: "Market Map / Office Move Radar",
    sourceType: "market_map",
    sourcePublishedAt: m.dateDetected || null,
    extractedAt: t,
    createdAt: m.dateDetected || t,
    updatedAt: t,
    notes: null,
    nextBestAction: "Review public signal, verify company context, then prepare cautious outreach.",
    suggestedOutreach: null,
    assignedTier: score.opportunityScore >= 75 ? "enterprise" : score.opportunityScore >= 55 ? "growth" : "starter",
    subscriptionVisibility: "client",
    status: "new",
    ...score,
  };
}

function fromRadarRecord(r: any): PropertyOpportunity {
  const t = now();
  const estimatedSeats = num(r.estimatedHeadcount || r.staffCount, 0) || null;
  const estimatedSqm = num(r.estimatedOfficeSizeSqm || r.officeSizeSqm, 0) || null;
  const estimatedProjectValue = num(String(r.estimatedProjectValue || "0").replace(/[^0-9.]/g, ""), 0) || null;

  const score = scorePropertyOpportunity({
    signalType: r.signalType,
    sourceType: "office_move_radar",
    sourceUrl: r.sourceUrl,
    city: r.city,
    state: r.state,
    estimatedSeats,
    estimatedSqm,
    estimatedProjectValue,
    sourcePublishedAt: r.dateDetected || r.createdAt,
    extractedAt: t,
  });

  return {
    id: String(r.id || id("radar")),
    companyName: r.companyName || null,
    projectName: r.companyName ? `${r.companyName} move / fitout opportunity` : null,
    city: r.city || null,
    state: r.state || null,
    country: "Australia",
    propertyType: "commercial_office",
    listingType: "radar_signal",
    signalType: r.signalType || "office_move",
    opportunityType: "office_move_radar",
    estimatedProjectValue,
    estimatedFurnitureValue: estimatedSeats ? estimatedSeats * 2500 : null,
    estimatedFitoutValue: estimatedSqm ? estimatedSqm * 900 : null,
    estimatedSeats,
    estimatedSqm,
    listingStatus: r.status || "New",
    projectStage: "radar_detected",
    sourceUrl: r.sourceUrl || null,
    sourceName: "Office Move Radar",
    sourceType: "office_move_radar",
    sourcePublishedAt: r.dateDetected || r.createdAt || null,
    extractedAt: t,
    createdAt: r.createdAt || r.dateDetected || t,
    updatedAt: t,
    notes: r.notes || null,
    nextBestAction: "Qualify relocation/furniture need and decide whether to push to pipeline.",
    suggestedOutreach: null,
    assignedTier: score.opportunityScore >= 75 ? "enterprise" : score.opportunityScore >= 55 ? "growth" : "starter",
    subscriptionVisibility: "client",
    status: r.status || "new",
    ...score,
  };
}

export async function listPropertyOpportunities(filters: any = {}) {
  const sources: any[] = [];
  const opportunities: PropertyOpportunity[] = [];

  const market = await fetchLocalJson("/api/market-map");
  sources.push({ name: "market_map", ...market, data: undefined });
  const markers = Array.isArray(market.data?.markers) ? market.data.markers : [];
  opportunities.push(...markers.map(fromMarketMarker));

  const radar = await fetchLocalJson("/api/admin/office-move-radar");
  sources.push({ name: "office_move_radar", ...radar, data: undefined });
  const radarRows = Array.isArray(radar.data) ? radar.data : Array.isArray(radar.data?.records) ? radar.data.records : [];
  opportunities.push(...radarRows.map(fromRadarRecord));

  opportunities.push(...manualStore.values());

  let rows = opportunities;
  if (filters.city) rows = rows.filter((o) => String(o.city || "").toLowerCase().includes(String(filters.city).toLowerCase()));
  if (filters.state) rows = rows.filter((o) => String(o.state || "").toLowerCase() === String(filters.state).toLowerCase());
  if (filters.signalType) rows = rows.filter((o) => String(o.signalType || "") === String(filters.signalType));
  if (filters.status) rows = rows.filter((o) => String(o.status || "") === String(filters.status));
  if (filters.minScore) rows = rows.filter((o) => o.opportunityScore >= Number(filters.minScore));

  rows = rows.sort((a, b) => (b.opportunityScore + b.urgencyScore) - (a.opportunityScore + a.urgencyScore));

  return {
    ok: true,
    connected: true,
    generatedAt: now(),
    dataMode: "real_sources_with_clear_fallbacks",
    sources,
    opportunities: rows,
  };
}

export async function getPropertyIntelligenceStats() {
  const data = await listPropertyOpportunities();
  const rows = data.opportunities;
  return {
    ok: true,
    generatedAt: now(),
    totalOpportunities: rows.length,
    highScore: rows.filter((o) => o.opportunityScore >= 70).length,
    outreachReady: rows.filter((o) => o.opportunityScore >= 60 && o.confidenceScore >= 45).length,
    officeMoveSignals: rows.filter((o) => String(o.signalType).includes("office") || String(o.signalType).includes("lease")).length,
    builderListingSignals: rows.filter((o) => String(o.signalType).includes("listing") || String(o.signalType).includes("builder")).length,
    topCities: Object.entries(rows.reduce((acc: any, o) => {
      const key = o.city || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).sort((a: any, b: any) => b[1] - a[1]).slice(0, 8),
    sourceHealth: data.sources,
  };
}

export async function getPropertyIntelligenceDashboard() {
  const [list, stats] = await Promise.all([listPropertyOpportunities(), getPropertyIntelligenceStats()]);
  return {
    ok: true,
    connected: true,
    generatedAt: now(),
    title: "Nexora Property Intelligence",
    productName: "Property Intelligence Pro",
    stats,
    opportunities: list.opportunities.slice(0, 50),
    sources: list.sources,
  };
}

export async function createPropertyOpportunity(input: Partial<PropertyOpportunity>) {
  const t = now();
  const score = scorePropertyOpportunity({
    signalType: input.signalType,
    sourceType: input.sourceType || "manual",
    sourceUrl: input.sourceUrl,
    city: input.city,
    state: input.state,
    estimatedSeats: input.estimatedSeats,
    estimatedSqm: input.estimatedSqm,
    estimatedProjectValue: input.estimatedProjectValue,
    sourcePublishedAt: input.sourcePublishedAt,
    extractedAt: t,
  });

  const row: PropertyOpportunity = {
    id: id("manual-prop"),
    companyName: input.companyName || null,
    builderName: input.builderName || null,
    developerName: input.developerName || null,
    agencyName: input.agencyName || null,
    projectName: input.projectName || null,
    propertyName: input.propertyName || null,
    address: input.address || null,
    suburb: input.suburb || null,
    city: input.city || null,
    state: input.state || null,
    country: input.country || "Australia",
    propertyType: input.propertyType || "commercial_office",
    listingType: input.listingType || "manual_opportunity",
    signalType: input.signalType || "manual_property_signal",
    opportunityType: input.opportunityType || "workspace_fitout_furniture_finance",
    estimatedProjectValue: input.estimatedProjectValue || null,
    estimatedFurnitureValue: input.estimatedFurnitureValue || null,
    estimatedFitoutValue: input.estimatedFitoutValue || null,
    estimatedSeats: input.estimatedSeats || null,
    estimatedSqm: input.estimatedSqm || null,
    listingStatus: input.listingStatus || "new",
    projectStage: input.projectStage || "manual_review",
    sourceUrl: input.sourceUrl || null,
    sourceName: input.sourceName || "Manual Entry",
    sourceType: input.sourceType || "manual",
    sourcePublishedAt: input.sourcePublishedAt || null,
    extractedAt: t,
    createdAt: t,
    updatedAt: t,
    notes: input.notes || null,
    nextBestAction: input.nextBestAction || "Review and qualify opportunity.",
    suggestedOutreach: null,
    assignedTier: input.assignedTier || "starter",
    subscriptionVisibility: input.subscriptionVisibility || "client",
    status: input.status || "new",
    ...score,
  };

  manualStore.set(row.id, row);
  return { ok: true, opportunity: row };
}

export async function updatePropertyOpportunity(id: string, patch: Partial<PropertyOpportunity>) {
  const existing = manualStore.get(id);
  if (!existing) return { ok: false, error: "Only manual in-memory opportunities can be updated in this local build." };
  const updated = { ...existing, ...patch, updatedAt: now() };
  manualStore.set(id, updated);
  return { ok: true, opportunity: updated };
}

export function generatePropertyOpportunityOutreach(opportunity: PropertyOpportunity) {
  const company = opportunity.companyName || opportunity.builderName || opportunity.developerName || "your team";
  const signal = opportunity.signalType || "workspace/property signal";
  const city = opportunity.city ? ` in ${opportunity.city}` : "";

  return {
    email: `Subject: Workspace planning support${city}\n\nHi ${company},\n\nI noticed a public signal that may suggest upcoming workspace, property, fitout or furniture planning activity: ${signal}.\n\nIf you are reviewing office requirements, furniture procurement, display suites, relocation planning or finance options, The Corporate Desk can help with layout planning, product selection, procurement and staged finance options.\n\nWould it be useful to compare options before decisions are locked in?\n\nRegards,\nThe Corporate Desk`,
    linkedIn: `Hi ${company}, I noticed a public workspace/property signal${city}. If you are reviewing office furniture, fitout planning or finance options, happy to share options.`,
    phoneScript: `Call ${company}. Reference the public ${signal} signal carefully. Ask whether they are reviewing workspace, fitout, furniture or finance requirements. Do not claim private knowledge.`,
    nextBestAction: "Verify source, qualify need, then send cautious outreach.",
  };
}
