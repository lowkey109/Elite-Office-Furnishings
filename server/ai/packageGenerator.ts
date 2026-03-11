/**
 * Package & Quote Generation Engine
 * Transforms AI space planning output into a structured furniture package and quote-ready proposal.
 * Called after the AI planning recommendation is generated — never replaces the core planner.
 */

interface ProductRec {
  zone: string;
  sku: string;
  category: string;
  productName: string;
  seriesRecommendation: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  rationale: string;
}

interface CostBreakdown {
  furniture: number;
  installation: number;
  delivery: number;
  total: number;
  perStaff?: number;
}

interface AiRec {
  clientBrief?: string;
  officeType?: string;
  estimatedProjectValue?: string;
  leadScore?: number;
  implementationTimeline?: string;
  productRecommendations?: ProductRec[];
  costBreakdown?: CostBreakdown;
  styleDirection?: string;
  keyConsiderations?: string[];
  recommendedNextStep?: string;
  urgencyNote?: string;
}

export interface PackageItem {
  sku: string;
  productName: string;
  category: string;
  series: string;
  zone: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  rationale: string;
}

export interface FurniturePackage {
  packageName: string;
  packageTier: "Foundation" | "Professional" | "Executive";
  workspaceType: string;
  totalItems: number;
  furnitureSubtotal: number;
  installationEstimate: number;
  deliveryEstimate: number;
  projectTotal: number;
  projectTotalRange: string;
  perStaffCost?: number;
  monthlyFinanceEstimate: string;
  financeNote: string;
  items: PackageItem[];
  upsellOpportunities: string[];
  whyThisPackage: string;
  generatedAt: string;
}

export interface QuoteSummary {
  quoteReference: string;
  status: "draft" | "ready" | "issued";
  clientBrief: string;
  workspaceType: string;
  packageTier: string;
  packageName: string;
  productSchedule: PackageItem[];
  costSummary: {
    furnitureSubtotal: number;
    installation: number;
    delivery: number;
    projectTotal: number;
    projectTotalRange: string;
    gst: number;
    totalIncGst: number;
  };
  financeOption: {
    monthlyEstimate: string;
    term: string;
    note: string;
  };
  addOnOpportunities: string[];
  recommendedNextStep: string;
  urgencyNote?: string;
  implementationTimeline?: string;
  styleDirection?: string;
  preparedFor: string;
  preparedBy: string;
  generatedAt: string;
}

/**
 * Determines the package tier based on total project cost and lead score.
 */
function determineTier(total: number, leadScore?: number): "Foundation" | "Professional" | "Executive" {
  if (total >= 150000 || (leadScore && leadScore >= 80)) return "Executive";
  if (total >= 60000 || (leadScore && leadScore >= 50)) return "Professional";
  return "Foundation";
}

/**
 * Generates a package name based on client, office type and tier.
 */
function buildPackageName(clientName: string, officeType: string, tier: string): string {
  const prefix = tier === "Executive" ? "Executive Workspace" : tier === "Professional" ? "Professional Workspace" : "Foundation Workspace";
  const type = officeType ? ` — ${officeType}` : "";
  return `${prefix} Package${type}`;
}

/**
 * Calculates a finance estimate (monthly repayment) using flat rate interest.
 * Uses 7.5% per annum over 48 months as a safe commercial estimate.
 */
function calcMonthlyFinance(total: number): string {
  const annualRate = 0.075;
  const months = 48;
  const monthly = (total * (1 + annualRate * (months / 12))) / months;
  return `$${Math.round(monthly).toLocaleString("en-AU")}/month`;
}

/**
 * Identifies upsell opportunities from the product recommendations and office type.
 */
function buildUpsellOpportunities(aiRec: AiRec): string[] {
  const upsells: string[] = [];
  const products = aiRec.productRecommendations || [];
  const categories = new Set(products.map((p) => p.category.toLowerCase()));

  if (!categories.has("lounge & soft seating") && !categories.has("lounge seating")) {
    upsells.push("Premium lounge & soft seating for breakout and reception zones");
  }
  if (!categories.has("acoustic panels") && !categories.has("screen & partition")) {
    upsells.push("Acoustic privacy panels for open-plan focus areas");
  }
  if (!categories.has("monitor arms") && !categories.has("desk accessories")) {
    upsells.push("Monitor arms and ergonomic desktop accessories per workstation");
  }
  if (!categories.has("credenza") && !categories.has("storage cabinets")) {
    upsells.push("Executive credenza storage to complement desk specification");
  }
  if (!categories.has("whiteboards") && !categories.has("presentation")) {
    upsells.push("Whiteboard / presentation wall for meeting and boardroom zones");
  }
  if (!categories.has("lighting") && !categories.has("task lighting")) {
    upsells.push("Premium task and ambient lighting package");
  }

  const officeType = (aiRec.officeType || "").toLowerCase();
  if (officeType.includes("law") || officeType.includes("legal") || officeType.includes("financial")) {
    upsells.push("Premium visitor chair upgrade — critical for client-facing professional firms");
  }
  if (officeType.includes("tech") || officeType.includes("scale")) {
    upsells.push("Height-adjustable / sit-stand workstation upgrade for tech culture alignment");
  }

  return upsells.slice(0, 5);
}

/**
 * Builds the rationale paragraph explaining why this package fits the brief.
 */
function buildWhyThisPackage(aiRec: AiRec, tier: string): string {
  const officeType = aiRec.officeType || "the specified workspace";
  const staff = aiRec.productRecommendations?.reduce((acc, p) => acc + p.quantity, 0) || 0;
  const style = aiRec.styleDirection
    ? aiRec.styleDirection.split(".")[0] + "."
    : "Premium commercial-grade materials have been specified throughout.";

  return `This ${tier} package has been structured specifically for ${officeType}, ` +
    `covering ${staff} total furniture items across all specified zones. ` +
    `${style} ` +
    `Every product has been selected from The Corporate Desk catalogue to ensure ` +
    `quality consistency, warranty coverage, and coordinated delivery and installation.`;
}

/**
 * Generates a unique internal quote reference.
 */
function generateQuoteRef(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `TCD-${yy}${mm}${dd}-${rand}`;
}

/**
 * Main package generation function.
 * Takes the parsed AI recommendation JSON and client metadata, returns package + quote objects.
 */
export function generatePackageAndQuote(
  aiRec: AiRec,
  clientName: string,
  clientCompany: string,
  staffCount?: string
): { package: FurniturePackage; quote: QuoteSummary } {
  const products = aiRec.productRecommendations || [];
  const cost = aiRec.costBreakdown;

  const furnitureSubtotal = cost?.furniture ?? products.reduce((acc, p) => acc + (p.totalCost || 0), 0);
  const installation = cost?.installation ?? Math.round(furnitureSubtotal * 0.12);
  const delivery = cost?.delivery ?? Math.round(furnitureSubtotal * 0.04);
  const projectTotal = cost?.total ?? furnitureSubtotal + installation + delivery;

  const staff = staffCount ? parseInt(staffCount, 10) : undefined;
  const perStaffCost = staff && staff > 0 ? Math.round(projectTotal / staff) : undefined;

  const tier = determineTier(projectTotal, aiRec.leadScore);
  const packageName = buildPackageName(clientName, aiRec.officeType || "", tier);

  const lowRange = Math.round(projectTotal * 0.92);
  const highRange = Math.round(projectTotal * 1.12);
  const projectTotalRange = `$${lowRange.toLocaleString("en-AU")} – $${highRange.toLocaleString("en-AU")} AUD`;

  const monthlyFinance = calcMonthlyFinance(projectTotal);
  const upsells = buildUpsellOpportunities(aiRec);
  const whyThis = buildWhyThisPackage(aiRec, tier);

  const items: PackageItem[] = products.map((p) => ({
    sku: p.sku,
    productName: p.productName,
    category: p.category,
    series: p.seriesRecommendation || "",
    zone: p.zone,
    quantity: p.quantity,
    unitCost: p.unitCost,
    totalCost: p.totalCost,
    rationale: p.rationale,
  }));

  const gst = Math.round(projectTotal * 0.1);
  const totalIncGst = projectTotal + gst;

  const pkg: FurniturePackage = {
    packageName,
    packageTier: tier,
    workspaceType: aiRec.officeType || "Office Workspace",
    totalItems: products.reduce((acc, p) => acc + p.quantity, 0),
    furnitureSubtotal,
    installationEstimate: installation,
    deliveryEstimate: delivery,
    projectTotal,
    projectTotalRange,
    perStaffCost,
    monthlyFinanceEstimate: monthlyFinance,
    financeNote: "Estimate based on 7.5% p.a. over 48 months. Subject to approval by finance partner.",
    items,
    upsellOpportunities: upsells,
    whyThisPackage: whyThis,
    generatedAt: new Date().toISOString(),
  };

  const quote: QuoteSummary = {
    quoteReference: generateQuoteRef(),
    status: "draft",
    clientBrief: aiRec.clientBrief || "",
    workspaceType: aiRec.officeType || "Office Workspace",
    packageTier: tier,
    packageName,
    productSchedule: items,
    costSummary: {
      furnitureSubtotal,
      installation,
      delivery,
      projectTotal,
      projectTotalRange,
      gst,
      totalIncGst,
    },
    financeOption: {
      monthlyEstimate: monthlyFinance,
      term: "48 months",
      note: "Indicative commercial finance estimate. Subject to lender approval.",
    },
    addOnOpportunities: upsells,
    recommendedNextStep: aiRec.recommendedNextStep || "Schedule a site visit and finalise specification.",
    urgencyNote: aiRec.urgencyNote,
    implementationTimeline: aiRec.implementationTimeline,
    styleDirection: aiRec.styleDirection,
    preparedFor: `${clientName}${clientCompany ? " — " + clientCompany : ""}`,
    preparedBy: "The Corporate Desk — Workplace Design Team",
    generatedAt: new Date().toISOString(),
  };

  return { package: pkg, quote };
}
