import fs from "fs";
import path from "path";

const KNOWLEDGE_BASE_PATH = path.join(process.cwd(), "ai/knowledge");

function safeReadJson(filePath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function compactJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 0);
}

function sectionHeader(title: string): string {
  return `\n### ${title.toUpperCase()}\n`;
}

let _compiled: string | null = null;
let _compiledAt: number | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

const BUSINESS_FILES: Array<[string, string]> = [
  ["companyProfile.json", "Company Profile"],
  ["businessRules.json", "Business Rules and Operations"],
  ["pricingStrategy.json", "Pricing Strategy"],
  ["supplierStrategy.json", "Supplier Strategy"],
  ["clientProfiles.json", "Ideal Client Profiles"],
  ["offerStructure.json", "Offer Structure"],
  ["projectQualificationRules.json", "Lead Qualification and Scoring"],
  ["brandVoice.json", "Brand Voice and Communication"],
  ["serviceAreas.json", "Service Areas"],
];

const INDUSTRY_FILES: Array<[string, string]> = [
  ["officeFurnitureIndustry.json", "Office Furniture Industry Knowledge"],
  ["workplaceDesign.json", "Workplace Design Principles"],
  ["officeFitoutProcess.json", "Office Fitout Process"],
  ["constructionWorkflow.json", "Construction Workflow"],
  ["commercialFurnitureSales.json", "Commercial Furniture Sales"],
  ["logisticsAndSupplyChain.json", "Logistics and Supply Chain"],
  ["projectManagement.json", "Project Management"],
  ["australianWHS.json", "Australian WHS Safety"],
  ["australianBuildingCompliance.json", "Australian Building Compliance"],
  ["accessibilityAndInclusiveDesign.json", "Accessibility and Inclusive Design"],
  ["commercialRealEstateSignals.json", "Commercial Real Estate Signals"],
];

const PSYCHOLOGY_FILES: Array<[string, string]> = [
  ["b2bBuyingPsychology.json", "B2B Buying Psychology"],
  ["procurementBehaviour.json", "Procurement Behaviour"],
  ["negotiationPsychology.json", "Negotiation Psychology"],
  ["stakeholderDynamics.json", "Stakeholder Dynamics"],
  ["valuePerception.json", "Value Perception and Premium Positioning"],
  ["constructionDecisionPsychology.json", "Construction Decision Psychology"],
];

const FINANCE_FILES: Array<[string, string]> = [
  ["commercialPricing.json", "Commercial Pricing"],
  ["marginStrategy.json", "Margin Strategy"],
  ["projectValueAssessment.json", "Project Value Assessment"],
  ["cashflowSensitivity.json", "Cashflow Sensitivity"],
  ["financePositioning.json", "Finance Positioning"],
];

const GROWTH_FILES: Array<[string, string]> = [
  ["b2bMarketingStrategy.json", "B2B Marketing Strategy"],
  ["leadGenerationStrategy.json", "Lead Generation Strategy"],
  ["partnershipStrategy.json", "Partnership Strategy"],
  ["contentStrategy.json", "Content Strategy"],
  ["marketPositioning.json", "Market Positioning"],
];

const MARKET_FILES: Array<[string, string]> = [
  ["highValueLeadSignals.json", "High Value Lead Signals"],
  ["industryTargeting.json", "Industry Targeting"],
  ["companyGrowthSignals.json", "Company Growth Signals"],
  ["officeMoveIndicators.json", "Office Move Indicators"],
];

function buildSection(
  files: Array<[string, string]>,
  subdir: string | null
): string {
  const basePath = subdir
    ? path.join(KNOWLEDGE_BASE_PATH, subdir)
    : KNOWLEDGE_BASE_PATH;
  return files
    .map(([file, label]) => {
      const data = safeReadJson(path.join(basePath, file));
      return data ? sectionHeader(label) + compactJson(data) : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function getCompiledKnowledge(): string {
  const now = Date.now();
  if (_compiled && _compiledAt && now - _compiledAt < CACHE_TTL_MS) {
    return _compiled;
  }

  _compiled = [
    buildSection(BUSINESS_FILES, null),
    buildSection(INDUSTRY_FILES, "industry"),
    buildSection(PSYCHOLOGY_FILES, "psychology"),
    buildSection(FINANCE_FILES, "finance"),
    buildSection(GROWTH_FILES, "growth"),
    buildSection(MARKET_FILES, "market"),
  ]
    .filter(Boolean)
    .join("\n");

  _compiledAt = now;
  return _compiled;
}

export function getWorkplaceDesignKnowledge(): string {
  return [
    buildSection(
      [
        ["officeFurnitureIndustry.json", "Product Knowledge"],
        ["workplaceDesign.json", "Workplace Design"],
        ["officeFitoutProcess.json", "Fitout Process"],
        ["australianWHS.json", "Australian WHS Safety"],
        ["accessibilityAndInclusiveDesign.json", "Accessibility"],
        ["australianBuildingCompliance.json", "Building Compliance"],
      ],
      "industry"
    ),
  ].join("\n");
}

export function getSalesFramework(): string {
  return [
    buildSection(
      [
        ["pricingStrategy.json", "Pricing Strategy"],
        ["offerStructure.json", "Offer Structure"],
        ["clientProfiles.json", "Client Profiles"],
      ],
      null
    ),
    buildSection(
      [["commercialFurnitureSales.json", "Sales Process"]],
      "industry"
    ),
    buildSection(
      [
        ["negotiationPsychology.json", "Negotiation Psychology"],
        ["valuePerception.json", "Value Perception"],
        ["b2bBuyingPsychology.json", "Buyer Psychology"],
        ["procurementBehaviour.json", "Procurement Behaviour"],
        ["stakeholderDynamics.json", "Stakeholder Dynamics"],
      ],
      "psychology"
    ),
    buildSection(
      [
        ["commercialPricing.json", "Commercial Pricing"],
        ["financePositioning.json", "Finance Positioning"],
      ],
      "finance"
    ),
  ].join("\n");
}

export function getLeadQualificationRules(): string {
  return [
    buildSection(
      [["projectQualificationRules.json", "Lead Qualification"]],
      null
    ),
    buildSection(
      [
        ["highValueLeadSignals.json", "High Value Lead Signals"],
        ["industryTargeting.json", "Industry Targeting"],
        ["companyGrowthSignals.json", "Company Growth Signals"],
        ["officeMoveIndicators.json", "Office Move Indicators"],
      ],
      "market"
    ),
    buildSection(
      [
        ["projectValueAssessment.json", "Project Value Assessment"],
        ["marginStrategy.json", "Margin Strategy"],
      ],
      "finance"
    ),
  ].join("\n");
}

export function getFinanceKnowledge(): string {
  return buildSection(FINANCE_FILES, "finance");
}

export function getGrowthKnowledge(): string {
  return buildSection(GROWTH_FILES, "growth");
}

export function getMarketIntelligence(): string {
  return buildSection(MARKET_FILES, "market");
}

export function getSupplierKnowledge(): string {
  return buildSection(
    [
      ["supplierStrategy.json", "Supplier Strategy"],
      ["businessRules.json", "Business Rules"],
    ],
    null
  );
}

export function getKnowledgeStats(): {
  totalFiles: number;
  totalChars: number;
  directories: string[];
} {
  const full = getCompiledKnowledge();
  return {
    totalFiles:
      BUSINESS_FILES.length +
      INDUSTRY_FILES.length +
      PSYCHOLOGY_FILES.length +
      FINANCE_FILES.length +
      GROWTH_FILES.length +
      MARKET_FILES.length,
    totalChars: full.length,
    directories: [
      "business",
      "industry",
      "psychology",
      "finance",
      "growth",
      "market",
    ],
  };
}
