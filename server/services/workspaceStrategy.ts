// AI Workspace Strategy Engine
// Generates optimal office layout, furniture package, and commercial strategy
// recommendations by learning from accumulated workspace data, profit records,
// quotes, and project outcomes.

import { storage } from "../storage";
import type { InsertWorkspaceStrategy, WorkspaceStrategyRecommendation } from "@shared/schema";

// ─── Layout Type Definitions ──────────────────────────────────────────────────
const LAYOUT_TYPES = {
  open_plan:      { sqmPerPerson: 8,  zones: { workstations: 60, meeting: 15, breakout: 10, reception: 10, storage: 5 } },
  hybrid:         { sqmPerPerson: 11, zones: { workstations: 45, meeting: 20, collaborative: 15, breakout: 10, reception: 7, storage: 3 } },
  executive:      { sqmPerPerson: 18, zones: { workstations: 35, executive: 25, meeting: 20, reception: 12, breakout: 5, storage: 3 } },
  collaborative:  { sqmPerPerson: 10, zones: { workstations: 40, collaborative: 25, meeting: 15, breakout: 15, storage: 5 } },
  cellular:       { sqmPerPerson: 15, zones: { offices: 50, meeting: 20, reception: 15, breakout: 10, storage: 5 } },
  mixed:          { sqmPerPerson: 12, zones: { workstations: 40, meeting: 18, executive: 12, collaborative: 15, reception: 10, storage: 5 } },
};

type LayoutType = keyof typeof LAYOUT_TYPES;

// ─── Package Tier → Margin Map ────────────────────────────────────────────────
const PACKAGE_MARGINS: Record<string, number> = {
  Premium: 42,
  Balanced: 34,
  Value: 26,
};

// ─── Determine Best Layout Type ───────────────────────────────────────────────
function recommendLayoutType(input: {
  sqm: number;
  staffCount: number;
  projectType?: string | null;
  industryContext?: string | null;
}): LayoutType {
  const density = input.sqm / Math.max(input.staffCount, 1);

  if (["Legal", "Finance", "Consulting"].some(i => input.industryContext?.includes(i))) {
    return density >= 16 ? "executive" : density >= 12 ? "mixed" : "hybrid";
  }
  if (["Technology", "Media", "Startup"].some(i => input.industryContext?.includes(i))) {
    return density <= 9 ? "open_plan" : density <= 13 ? "collaborative" : "hybrid";
  }
  if (input.projectType === "executive_suite") return "executive";
  if (input.projectType === "hot_desk") return "open_plan";

  // Default by density
  if (density <= 8) return "open_plan";
  if (density <= 11) "collaborative";
  if (density <= 14) return "hybrid";
  if (density <= 17) return "mixed";
  return "cellular";
}

// ─── Calculate Project Value From Learning Data ────────────────────────────────
async function getAverageMetricsFromLearning(sqm: number, staffCount: number): Promise<{
  avgValuePerSqm: number;
  avgMargin: number;
  sampleSize: number;
}> {
  const [learningRecords, profitRecords] = await Promise.all([
    storage.getWorkspaceLearningRecords(),
    storage.getProfitRecords(100),
  ]);

  // Filter to similar-sized projects (within 50% of target size)
  const similarLearning = learningRecords.filter(r => {
    if (!Number(r.officeSqm ?? 0)) return false;
    const diff = Math.abs(Number(r.officeSqm ?? 0) - sqm) / sqm;
    return diff <= 0.5;
  });

  const avgMargin = profitRecords.length > 0
    ? Math.round(profitRecords.reduce((s, r) => s + (r.estimatedMarginPercent ?? 30), 0) / profitRecords.length)
    : 30;

  // Industry average AU: ~$700-1200/sqm for office furniture
  const baseRate = sqm <= 100 ? 1000 : sqm <= 300 ? 850 : sqm <= 600 ? 750 : 680;
  const avgValuePerSqm = similarLearning.length >= 3
    ? Math.round(similarLearning.reduce((s, r) => {
        const cost = r.estimatedCost ? parseFloat(String(r.estimatedCost).replace(/[^0-9.]/g, "")) : baseRate * sqm;
        return s + (cost / (Number(r.officeSqm ?? 0) ?? sqm));
      }, 0) / similarLearning.length)
    : baseRate;

  return { avgValuePerSqm, avgMargin, sampleSize: similarLearning.length };
}

// ─── Generate Strategy Recommendation ─────────────────────────────────────────
export async function generateStrategyRecommendation(input: {
  planningRequestId?: string;
  officeSqm: number;
  staffCount: number;
  projectType?: string;
  industryContext?: string;
  budgetRange?: string;
  stylePreference?: string;
}): Promise<WorkspaceStrategyRecommendation> {
  const layoutType = recommendLayoutType({ sqm: input.officeSqm, staffCount: input.staffCount, projectType: input.projectType, industryContext: input.industryContext });
  const layoutConfig = LAYOUT_TYPES[layoutType];

  const { avgValuePerSqm, avgMargin, sampleSize } = await getAverageMetricsFromLearning(input.officeSqm, input.staffCount);

  // Package tier from budget signal
  let packageTier: "Premium" | "Balanced" | "Value" = "Balanced";
  const budget = input.budgetRange?.toLowerCase() ?? "";
  const style = input.stylePreference?.toLowerCase() ?? "";
  if (budget.includes("premium") || style.includes("premium") || style.includes("executive") || style.includes("luxury")) {
    packageTier = "Premium";
  } else if (budget.includes("value") || budget.includes("budget") || budget.includes("low")) {
    packageTier = "Value";
  }

  // Project value estimates
  const midValuePerSqm = avgValuePerSqm;
  const predictedValue = Math.round(input.officeSqm * midValuePerSqm);
  const predictedMargin = PACKAGE_MARGINS[packageTier];
  const predictedProfit = Math.round(predictedValue * predictedMargin / 100);

  const budgetLow = Math.round(predictedValue * 0.75 / 1000) * 1000;
  const budgetHigh = Math.round(predictedValue * 1.3 / 1000) * 1000;

  // Recommended desk density
  const deskDensity = `${layoutConfig.sqmPerPerson} sqm per person`;

  // Zone recommendations
  const zones = Object.entries(layoutConfig.zones).map(([zone, pct]) => ({
    zone: zone.replace(/_/g, " "),
    percentage: pct,
    sqm: Math.round(input.officeSqm * pct / 100),
  }));

  // Furniture recommendations by zone
  const furnitureRecs: Array<{ category: string; suggestion: string; quantity: number }> = [];
  for (const zone of zones) {
    if (zone.zone === "workstations") {
      furnitureRecs.push({ category: "Workstations", suggestion: `Height-adjustable sit-stand desks — ${packageTier} tier`, quantity: input.staffCount });
      furnitureRecs.push({ category: "Task Seating", suggestion: `Ergonomic mesh chairs — ${packageTier} tier`, quantity: input.staffCount });
    } else if (zone.zone.includes("meeting")) {
      const tables = Math.max(1, Math.round(zone.sqm / 25));
      furnitureRecs.push({ category: "Meeting Tables", suggestion: "Modular boardroom tables with cable management", quantity: tables });
      furnitureRecs.push({ category: "Meeting Chairs", suggestion: "Executive meeting chairs", quantity: tables * 8 });
    } else if (zone.zone.includes("collaborative") || zone.zone.includes("breakout")) {
      furnitureRecs.push({ category: "Soft Seating", suggestion: "Lounge sofas and modular seating", quantity: Math.max(1, Math.round(zone.sqm / 15)) });
      furnitureRecs.push({ category: "Collaborative Tables", suggestion: "Standing-height collaboration tables", quantity: Math.max(1, Math.round(zone.sqm / 20)) });
    } else if (zone.zone.includes("reception")) {
      furnitureRecs.push({ category: "Reception Desk", suggestion: `${packageTier === "Premium" ? "Custom stone-top" : "Modern laminate"} reception counter`, quantity: 1 });
    }
  }

  // Supplier mix (based on package)
  const supplierMix = packageTier === "Premium"
    ? { workstations: "Fessenz Design Collection", seating: "Presidia Executive Collection", storage: "Alto Premium Storage" }
    : packageTier === "Value"
    ? { workstations: "CoreWork Series", seating: "ActivePro Task Seating", storage: "Modular Storage Solutions" }
    : { workstations: "Latitude Workstation Series", seating: "Catalyst Ergonomic Collection", storage: "Structured Storage Systems" };

  // Workspace concept
  const concept = `${packageTier} ${layoutType.replace(/_/g, " ")} workspace for ${input.staffCount} staff across ${input.officeSqm}sqm. `
    + `${input.industryContext ? `Designed for the ${input.industryContext} sector. ` : ""}`
    + `Centred on a ${Math.round(zones[0]?.percentage ?? 45)}% workstation core with dedicated ${zones.slice(1, 3).map(z => z.zone).join(" and ")} zones. `
    + `${packageTier === "Premium" ? "Premium materials throughout with executive-grade finishes." : packageTier === "Value" ? "Cost-effective solutions prioritising function and durability." : "Balanced quality and commercial efficiency."}`;

  // Key insights
  const insights: string[] = [
    `${layoutType.replace(/_/g, " ")} layout recommended based on ${input.officeSqm}sqm ÷ ${input.staffCount} staff = ${Math.round(input.officeSqm / input.staffCount)}sqm/person density`,
    `${packageTier} package projected to deliver ${predictedMargin}% gross margin`,
    `Based on ${sampleSize} similar projects in learning database`,
    `Estimated project value: $${predictedValue.toLocaleString()} (range: $${budgetLow.toLocaleString()} – $${budgetHigh.toLocaleString()})`,
  ];
  if (input.industryContext) {
    insights.push(`${input.industryContext} sector typically requires ${layoutConfig.sqmPerPerson}sqm per person — this project is ${Math.round(input.officeSqm / input.staffCount) > layoutConfig.sqmPerPerson ? "above" : "below"} average`);
  }

  const proposal = `The Corporate Desk recommends a ${packageTier.toLowerCase()} ${layoutType.replace(/_/g, "-")} configuration for your ${input.officeSqm}sqm workspace. `
    + `At ${input.staffCount} staff, we recommend ${deskDensity} with ${zones.slice(0, 3).map(z => `${z.percentage}% ${z.zone}`).join(", ")}. `
    + `Estimated investment range: $${budgetLow.toLocaleString()} – $${budgetHigh.toLocaleString()} inc. GST, with an expected gross margin of ${predictedMargin}%.`;

  const confidenceScore = Math.min(95, 40 + sampleSize * 5 + (input.industryContext ? 10 : 0) + (input.planningRequestId ? 10 : 0));

  const record: InsertWorkspaceStrategy = {
    planningRequestId: input.planningRequestId ?? null,
    officeSqm: input.officeSqm,
    staffCount: input.staffCount,
    projectType: input.projectType ?? null,
    industryContext: input.industryContext ?? null,
    recommendedLayoutType: layoutType,
    recommendedDeskDensity: deskDensity,
    recommendedZonesJson: JSON.stringify(zones),
    recommendedPackageTier: packageTier,
    recommendedFurnitureJson: JSON.stringify(furnitureRecs),
    predictedProjectValue: predictedValue,
    predictedGrossProfit: predictedProfit,
    predictedMarginPct: predictedMargin,
    supplierMixJson: JSON.stringify(supplierMix),
    workspaceConcept: concept,
    budgetEstimateLow: budgetLow,
    budgetEstimateHigh: budgetHigh,
    proposalSummary: proposal,
    keyInsights: insights,
    confidenceScore,
    dataSourcesUsed: sampleSize,
    outcomeTracked: false,
    actualProjectValue: null,
  };

  return await storage.createWorkspaceStrategy(record);
}

// ─── Learning Insights from Historical Data ────────────────────────────────────
export async function getLearningInsights(): Promise<{
  totalRecords: number;
  avgMarginPct: number;
  avgProjectValue: number;
  topLayoutType: string;
  topPackageTier: string;
  topIndustry: string;
  avgSqmPerPerson: number;
  recentStrategies: WorkspaceStrategyRecommendation[];
  layoutBreakdown: Array<{ layout: string; count: number; avgMargin: number }>;
  packageBreakdown: Array<{ package: string; count: number; avgValue: number }>;
}> {
  const [strategies, learning, profits] = await Promise.all([
    storage.getWorkspaceStrategies(50),
    storage.getWorkspaceLearningRecords(),
    storage.getProfitRecords(100),
  ]);

  const avgMargin = profits.length > 0
    ? Math.round(profits.reduce((s, r) => s + (r.estimatedMarginPercent ?? 0), 0) / profits.length)
    : 30;

  const avgValue = learning.length > 0
    ? Math.round(learning.filter(r => r.estimatedCost).reduce((s, r) => {
        const v = parseFloat(String(r.estimatedCost ?? "0").replace(/[^0-9.]/g, ""));
        return s + v;
      }, 0) / Math.max(learning.filter(r => r.estimatedCost).length, 1))
    : 0;

  const avgDensity = learning.filter(r => Number(r.officeSqm ?? 0) && r.staffCount).length > 0
    ? Math.round(learning.filter(r => Number(r.officeSqm ?? 0) && r.staffCount)
        .reduce((s, r) => s + (Number(r.officeSqm ?? 0)! / Math.max(parseInt(String(r.staffCount ?? "1")), 1)), 0)
        / learning.filter(r => Number(r.officeSqm ?? 0) && r.staffCount).length)
    : 12;

  // Layout breakdown from strategies
  const layoutMap = new Map<string, { count: number; marginSum: number }>();
  for (const s of strategies) {
    if (s.recommendedLayoutType) {
      const e = layoutMap.get(s.recommendedLayoutType) ?? { count: 0, marginSum: 0 };
      e.count++; e.marginSum += (s.predictedMarginPct ?? 0);
      layoutMap.set(s.recommendedLayoutType, e);
    }
  }
  const layoutBreakdown = Array.from(layoutMap.entries())
    .map(([layout, d]) => ({ layout, count: d.count, avgMargin: Math.round(d.marginSum / d.count) }))
    .sort((a, b) => b.count - a.count);

  // Package breakdown
  const pkgMap = new Map<string, { count: number; valueSum: number }>();
  for (const s of strategies) {
    if (s.recommendedPackageTier) {
      const e = pkgMap.get(s.recommendedPackageTier) ?? { count: 0, valueSum: 0 };
      e.count++; e.valueSum += (s.predictedProjectValue ?? 0);
      pkgMap.set(s.recommendedPackageTier, e);
    }
  }
  const packageBreakdown = Array.from(pkgMap.entries())
    .map(([pkg, d]) => ({ package: pkg, count: d.count, avgValue: Math.round(d.valueSum / d.count) }))
    .sort((a, b) => b.avgValue - a.avgValue);

  const topLayout = layoutBreakdown[0]?.layout ?? "hybrid";
  const topPackage = packageBreakdown[0]?.package ?? "Balanced";

  // Top industry from learning
  const indMap = new Map<string, number>();
  for (const r of learning) {
    if (r.keyInsight) {
      // Extract industry signals from key insights
      for (const ind of ["Technology", "Finance", "Legal", "Healthcare", "Consulting"]) {
        if (r.keyInsight.includes(ind)) indMap.set(ind, (indMap.get(ind) ?? 0) + 1);
      }
    }
  }
  const topIndustry = [...indMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Technology";

  return {
    totalRecords: learning.length,
    avgMarginPct: avgMargin,
    avgProjectValue: avgValue,
    topLayoutType: topLayout,
    topPackageTier: topPackage,
    topIndustry,
    avgSqmPerPerson: avgDensity,
    recentStrategies: strategies.slice(0, 5),
    layoutBreakdown,
    packageBreakdown,
  };
}
