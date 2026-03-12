// ─── AI Workspace Profit Optimisation Engine ─────────────────────────────────
// Calculates cost stacks, compares package tiers, and optimises supplier mixes
// for maximum margin on commercial fitout projects.

import supplierPricingData from "../data/supplierPricing.json";

interface PricingRecord {
  id: string;
  supplier_id: string;
  supplier_name: string;
  category: string;
  product_description: string;
  series: string;
  moq: number;
  unit_price_cny: number;
  unit_price_aud_landed: number;
  sell_price_aud: number;
  gross_margin_pct: number;
  lead_time_days: number;
  quote_date: string;
  confidence: string;
  notes: string;
  freight_per_cbm_aud: number;
}

interface CategoryBenchmark {
  category: string;
  low_aud: number;
  mid_aud: number;
  high_aud: number;
  typical_margin_pct: number;
  preferred_suppliers: string[];
}

interface PackageLineItem {
  category: string;
  description: string;
  supplier: string;
  quantity: number;
  unitLandedCost: number;
  unitSellPrice: number;
  totalLandedCost: number;
  totalSellPrice: number;
  marginPct: number;
}

export interface CostStack {
  packageTier: "premium" | "balanced" | "value";
  packageName: string;
  lineItems: PackageLineItem[];
  totalLandedCost: number;
  installationCost: number;
  totalLandedWithInstall: number;
  quotedPrice: number;
  grossProfit: number;
  marginPercent: number;
  confidenceLevel: "high" | "medium" | "low";
  supplierMix: Record<string, string[]>;
  keyStrengths: string[];
}

export interface PackageComparison {
  officeSqm: number;
  staffCount: number;
  premium: CostStack;
  balanced: CostStack;
  value: CostStack;
  recommendation: string;
  bestMarginTier: "premium" | "balanced" | "value";
}

// ─── Supplier routing rules ──────────────────────────────────────────────────

const SUPPLIER_ROUTING: Record<string, string[]> = {
  "BOKE": ["Office Seating", "Executive Seating", "Meeting Seating", "Lounge Seating"],
  "MEIYI": ["Workstations", "Manager Desks", "Meeting Tables", "Reception Desks", "Storage"],
  "XITIAN": ["Executive Desks", "Reception Desks", "Boardroom Tables", "Premium Furniture"],
  "DENNY": ["General", "Sourcing"],
};

const SUPPLIER_NAMES: Record<string, string> = {
  BOKE: "Boke Furniture",
  MEIYI: "Guangzhou Meiyi (Asya)",
  XITIAN: "Ruby / Xitian",
  DENNY: "Denny Sourcing",
};

// ─── Core calculation helpers ─────────────────────────────────────────────────

function getPricingRecords(): PricingRecord[] {
  return (supplierPricingData as any).pricing_records || [];
}

// category_benchmarks is an object: { "Office Seating": { landed_range_aud, sell_range_aud, typical_gm }, ... }
function getRawBenchmarks(): Record<string, { landed_range_aud: string; sell_range_aud: string; typical_gm: string }> {
  return (supplierPricingData as any).category_benchmarks || {};
}

function findBestRecord(category: string, tier: "premium" | "balanced" | "value"): PricingRecord | null {
  const records = getPricingRecords().filter(
    (r) => r.category.toLowerCase().includes(category.toLowerCase()) ||
           category.toLowerCase().includes(r.category.toLowerCase())
  );
  if (records.length === 0) return null;

  const sorted = [...records].sort((a, b) => {
    if (tier === "premium") return b.sell_price_aud - a.sell_price_aud;
    if (tier === "value") return a.sell_price_aud - b.sell_price_aud;
    return 0;
  });

  return sorted[0];
}

function getBenchmarkRaw(category: string): { landed_range_aud: string; sell_range_aud: string; typical_gm: string } | null {
  const benchmarks = getRawBenchmarks();
  const key = Object.keys(benchmarks).find(
    (k) => k.toLowerCase().includes(category.toLowerCase()) ||
           category.toLowerCase().includes(k.toLowerCase())
  );
  return key ? benchmarks[key] : null;
}

function parseRangeHigh(range: string): number {
  const match = range.replace(/\$|,/g, "").match(/(\d+)(?:–(\d+))?/);
  if (!match) return 1000;
  return match[2] ? parseInt(match[2]) : parseInt(match[1]);
}

function parseRangeMid(range: string): number {
  const match = range.replace(/\$|,/g, "").match(/(\d+)(?:–(\d+))?/);
  if (!match) return 800;
  const low = parseInt(match[1]);
  const high = match[2] ? parseInt(match[2]) : low;
  return Math.round((low + high) / 2);
}

function parseRangeLow(range: string): number {
  const match = range.replace(/\$|,/g, "").match(/(\d+)/);
  return match ? parseInt(match[1]) : 500;
}

function parseMarginMid(gm: string): number {
  const match = gm.replace(/%/g, "").match(/(\d+)(?:–(\d+))?/);
  if (!match) return 52;
  const low = parseInt(match[1]);
  const high = match[2] ? parseInt(match[2]) : low;
  return Math.round((low + high) / 2);
}

function getBenchmarkPrice(category: string, tier: "premium" | "balanced" | "value"): number {
  const b = getBenchmarkRaw(category);
  if (!b) return tier === "premium" ? 2000 : tier === "balanced" ? 1200 : 700;
  const range = b.sell_range_aud;
  return tier === "premium" ? parseRangeHigh(range) : tier === "balanced" ? parseRangeMid(range) : parseRangeLow(range);
}

function getBenchmarkMargin(category: string): number {
  const b = getBenchmarkRaw(category);
  return b ? parseMarginMid(b.typical_gm) : 50;
}

function getPreferredSupplier(category: string): string {
  for (const [supplierId, categories] of Object.entries(SUPPLIER_ROUTING)) {
    if (categories.some((c) => c.toLowerCase().includes(category.toLowerCase()) ||
                              category.toLowerCase().includes(c.toLowerCase()))) {
      return SUPPLIER_NAMES[supplierId] || supplierId;
    }
  }
  return SUPPLIER_NAMES["MEIYI"];
}

// ─── Package definitions by office characteristics ────────────────────────────

interface OfficePackageSpec {
  workstations: number;
  managerDesks: number;
  executiveDesks: number;
  meetingChairs: number;
  taskChairs: number;
  executiveChairs: number;
  meetingTables: number;
  receptionDesks: number;
  loungeSeats: number;
  storageUnits: number;
  meetingRooms: number;
}

function derivePackageSpec(officeSqm: number, staffCount: number): OfficePackageSpec {
  const sqmPerPerson = officeSqm / Math.max(staffCount, 1);
  const hasReception = officeSqm > 150;
  const managerRatio = sqmPerPerson > 12 ? 0.15 : 0.1;
  const execRatio = sqmPerPerson > 18 ? 0.05 : 0.02;

  const workstations = Math.round(staffCount * (1 - managerRatio - execRatio));
  const managerDesks = Math.max(1, Math.round(staffCount * managerRatio));
  const executiveDesks = Math.max(0, Math.round(staffCount * execRatio));
  const meetingRooms = Math.max(1, Math.round(officeSqm / 80));

  return {
    workstations,
    managerDesks,
    executiveDesks,
    meetingChairs: meetingRooms * 6,
    taskChairs: workstations,
    executiveChairs: managerDesks + executiveDesks,
    meetingTables: meetingRooms,
    receptionDesks: hasReception ? 1 : 0,
    loungeSeats: hasReception ? 4 : 0,
    storageUnits: Math.max(2, Math.round(staffCount / 8)),
    meetingRooms,
  };
}

function buildLineItem(
  category: string,
  quantity: number,
  tier: "premium" | "balanced" | "value"
): PackageLineItem {
  const record = findBestRecord(category, tier);
  const supplier = getPreferredSupplier(category);

  let unitLandedCost: number;
  let unitSellPrice: number;
  let marginPct: number;

  if (record) {
    const tierMultiplier = tier === "premium" ? 1.2 : tier === "value" ? 0.8 : 1.0;
    unitLandedCost = Math.round(record.unit_price_aud_landed * tierMultiplier);
    unitSellPrice = Math.round(record.sell_price_aud * tierMultiplier);
    marginPct = record.gross_margin_pct;
  } else {
    unitSellPrice = getBenchmarkPrice(category, tier);
    marginPct = getBenchmarkMargin(category);
    unitLandedCost = Math.round(unitSellPrice * (1 - marginPct / 100));
  }

  return {
    category,
    description: `${tier.charAt(0).toUpperCase() + tier.slice(1)} ${category}`,
    supplier,
    quantity,
    unitLandedCost,
    unitSellPrice,
    totalLandedCost: unitLandedCost * quantity,
    totalSellPrice: unitSellPrice * quantity,
    marginPct,
  };
}

// ─── Main cost stack calculator ───────────────────────────────────────────────

export function calculateCostStack(
  officeSqm: number,
  staffCount: number,
  tier: "premium" | "balanced" | "value"
): CostStack {
  const spec = derivePackageSpec(officeSqm, staffCount);

  const lineItems: PackageLineItem[] = [];

  if (spec.workstations > 0)
    lineItems.push(buildLineItem("Workstations", spec.workstations, tier));
  if (spec.taskChairs > 0)
    lineItems.push(buildLineItem("Office Seating", spec.taskChairs, tier));
  if (spec.managerDesks > 0)
    lineItems.push(buildLineItem("Manager Desks", spec.managerDesks, tier));
  if (spec.executiveDesks > 0)
    lineItems.push(buildLineItem("Executive Desks", spec.executiveDesks, tier));
  if (spec.executiveChairs > 0)
    lineItems.push(buildLineItem("Executive Seating", spec.executiveChairs, tier));
  if (spec.meetingTables > 0)
    lineItems.push(buildLineItem("Meeting Tables", spec.meetingTables, tier));
  if (spec.meetingChairs > 0)
    lineItems.push(buildLineItem("Meeting Seating", spec.meetingChairs, tier));
  if (spec.receptionDesks > 0)
    lineItems.push(buildLineItem("Reception Desks", spec.receptionDesks, tier));
  if (spec.loungeSeats > 0)
    lineItems.push(buildLineItem("Lounge Seating", spec.loungeSeats, tier));
  if (spec.storageUnits > 0)
    lineItems.push(buildLineItem("Storage & Cabinets", spec.storageUnits, tier));

  const totalLandedCost = lineItems.reduce((s, i) => s + i.totalLandedCost, 0);
  const totalSellPrice = lineItems.reduce((s, i) => s + i.totalSellPrice, 0);

  const installationRate = tier === "premium" ? 0.06 : tier === "balanced" ? 0.05 : 0.04;
  const installationCost = Math.round(totalSellPrice * installationRate);
  const quotedPrice = Math.round(totalSellPrice + installationCost);
  const grossProfit = quotedPrice - totalLandedCost - installationCost;
  const marginPercent = Math.round((grossProfit / quotedPrice) * 100);

  // Build supplier mix summary
  const supplierMix: Record<string, string[]> = {};
  lineItems.forEach((item) => {
    if (!supplierMix[item.supplier]) supplierMix[item.supplier] = [];
    supplierMix[item.supplier].push(item.category);
  });

  // Determine confidence
  const hasRealRecords = lineItems.filter((i) => findBestRecord(i.category, tier)).length;
  const confidence: "high" | "medium" | "low" =
    hasRealRecords >= lineItems.length * 0.7 ? "high" :
    hasRealRecords >= lineItems.length * 0.4 ? "medium" : "low";

  const tierNames = {
    premium: "Premium Fitout Package",
    balanced: "Balanced Fitout Package",
    value: "Value-Engineered Package",
  };

  const tierStrengths = {
    premium: [
      "Highest visual impact and client impression",
      "Best suited for law, finance, and executive offices",
      "Strongest margin with premium product positioning",
    ],
    balanced: [
      "Optimal margin-to-quality balance",
      "Strongest conversion rate across office types",
      "Broad supplier compatibility and lead-time reliability",
    ],
    value: [
      "Maximum volume opportunity",
      "Best suited for cost-sensitive SME and government projects",
      "Fastest lead time with standard configurations",
    ],
  };

  return {
    packageTier: tier,
    packageName: tierNames[tier],
    lineItems,
    totalLandedCost,
    installationCost,
    totalLandedWithInstall: totalLandedCost + installationCost,
    quotedPrice,
    grossProfit,
    marginPercent,
    confidenceLevel: confidence,
    supplierMix,
    keyStrengths: tierStrengths[tier],
  };
}

// ─── Package comparison engine ─────────────────────────────────────────────────

export function comparePackageOptions(
  officeSqm: number,
  staffCount: number
): PackageComparison {
  const premium = calculateCostStack(officeSqm, staffCount, "premium");
  const balanced = calculateCostStack(officeSqm, staffCount, "balanced");
  const value = calculateCostStack(officeSqm, staffCount, "value");

  const tiers = [
    { tier: "premium" as const, stack: premium },
    { tier: "balanced" as const, stack: balanced },
    { tier: "value" as const, stack: value },
  ];

  const bestMargin = tiers.reduce((best, cur) =>
    cur.stack.marginPercent > best.stack.marginPercent ? cur : best
  );

  const recommendation =
    premium.quotedPrice > 200000
      ? `For a ${officeSqm}sqm, ${staffCount}-person office at this scale, the Balanced Package delivers the strongest commercial outcome — reliable margin, quality product mix, and broad client appeal. Premium is available for high-end sectors.`
      : balanced.marginPercent >= 50
      ? `The Balanced Package is the recommended default for this project size. It delivers strong margin (${balanced.marginPercent}%) with commercially appropriate quality for a ${officeSqm}sqm fitout.`
      : `For a project of this scale (${officeSqm}sqm, ${staffCount} people), the Balanced Package maximises margin opportunity while keeping the price competitive.`;

  return {
    officeSqm,
    staffCount,
    premium,
    balanced,
    value,
    recommendation,
    bestMarginTier: bestMargin.tier,
  };
}

// ─── Supplier mix optimiser ────────────────────────────────────────────────────

export interface SupplierMixRecommendation {
  categories: string[];
  supplierAssignments: Record<string, string>;
  reasoning: string;
  leadTimeRisk: "low" | "medium" | "high";
  marginProtection: "strong" | "moderate" | "weak";
}

export function optimiseSupplierMix(categories: string[]): SupplierMixRecommendation {
  const assignments: Record<string, string> = {};

  for (const category of categories) {
    assignments[category] = getPreferredSupplier(category);
  }

  const uniqueSuppliers = new Set(Object.values(assignments)).size;
  const leadTimeRisk: "low" | "medium" | "high" =
    uniqueSuppliers <= 2 ? "low" : uniqueSuppliers <= 3 ? "medium" : "high";
  const marginProtection: "strong" | "moderate" | "weak" =
    categories.length <= 5 ? "strong" : categories.length <= 8 ? "moderate" : "weak";

  const reasoning =
    `Routing ${categories.length} categories across ${uniqueSuppliers} supplier(s). ` +
    `Seating routed to Boke (specialist, best margin). ` +
    `Desks and workstations to Guangzhou Meiyi/Asya (primary desk supplier). ` +
    `Executive and reception to Ruby/Xitian (premium project specialist). ` +
    `This mix aligns with established routing rules and protects lead times.`;

  return { categories, supplierAssignments: assignments, reasoning, leadTimeRisk, marginProtection };
}

// ─── Layout profit patterns ───────────────────────────────────────────────────

export interface LayoutProfitPattern {
  layoutType: string;
  avgMarginPct: number;
  avgProjectValue: number;
  bestIndustries: string[];
  packageRecommendation: string;
  notes: string;
}

export function getLayoutProfitPatterns(): LayoutProfitPattern[] {
  return [
    {
      layoutType: "Open Plan — Dense Workstation",
      avgMarginPct: 52,
      avgProjectValue: 85000,
      bestIndustries: ["technology", "startups", "media", "general business"],
      packageRecommendation: "balanced",
      notes: "High volume, moderate margin. Strongest conversion rate due to price accessibility.",
    },
    {
      layoutType: "Premium Executive",
      avgMarginPct: 58,
      avgProjectValue: 220000,
      bestIndustries: ["legal", "financial services", "consulting", "private equity"],
      packageRecommendation: "premium",
      notes: "Highest margin opportunity. Clients prioritise quality over price.",
    },
    {
      layoutType: "Collaborative Startup",
      avgMarginPct: 48,
      avgProjectValue: 65000,
      bestIndustries: ["technology", "creative agencies", "startups"],
      packageRecommendation: "balanced",
      notes: "Design-forward but budget-aware. Emphasis on breakout and flexible zones.",
    },
    {
      layoutType: "Reception-Heavy Client-Facing",
      avgMarginPct: 55,
      avgProjectValue: 140000,
      bestIndustries: ["real estate", "legal", "financial services", "retail"],
      packageRecommendation: "premium",
      notes: "Reception and lounge areas drive higher per-unit margin. Visual impact critical.",
    },
    {
      layoutType: "Acoustic / Privacy-Focused",
      avgMarginPct: 56,
      avgProjectValue: 110000,
      bestIndustries: ["healthcare", "legal", "HR consultancies", "government"],
      packageRecommendation: "balanced",
      notes: "Acoustic pods and privacy panels increase project value and margin.",
    },
    {
      layoutType: "Government / Education Standard",
      avgMarginPct: 44,
      avgProjectValue: 75000,
      bestIndustries: ["government", "education", "not-for-profit"],
      packageRecommendation: "value",
      notes: "Tendered projects with price-sensitive brief. Volume and reliability are key.",
    },
  ];
}

// ─── Margin health check ──────────────────────────────────────────────────────

export interface MarginHealthCheck {
  marginPct: number;
  status: "excellent" | "good" | "acceptable" | "warning" | "critical";
  label: string;
  suggestion: string;
}

export function checkMarginHealth(marginPct: number, packageTier: string): MarginHealthCheck {
  if (marginPct >= 58)
    return { marginPct, status: "excellent", label: "Excellent", suggestion: "Strong commercial outcome. Proceed confidently." };
  if (marginPct >= 52)
    return { marginPct, status: "good", label: "Good", suggestion: "Healthy margin. Consider upselling premium seating or acoustic zones." };
  if (marginPct >= 45)
    return { marginPct, status: "acceptable", label: "Acceptable", suggestion: "Margin is within acceptable range. Review supplier mix for improvement." };
  if (marginPct >= 38)
    return { marginPct, status: "warning", label: "Low — Review Required", suggestion: "Margin is below target. Consider upgrading to a higher-tier package or adjusting supplier mix." };
  return {
    marginPct,
    status: "critical",
    label: "Critical — Action Required",
    suggestion: "This package is not commercially viable at the current quoted price. Reprice immediately or escalate.",
  };
}
