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

export function getCompiledKnowledge(): string {
  const now = Date.now();
  if (_compiled && _compiledAt && now - _compiledAt < CACHE_TTL_MS) {
    return _compiled;
  }

  const sections: string[] = [];

  const businessFiles: Array<[string, string]> = [
    ["companyProfile.json", "Company Profile"],
    ["businessRules.json", "Business Rules & Operations"],
    ["pricingStrategy.json", "Pricing Strategy"],
    ["supplierStrategy.json", "Supplier Strategy"],
    ["clientProfiles.json", "Ideal Client Profiles"],
    ["offerStructure.json", "Offer Structure"],
    ["projectQualificationRules.json", "Lead Qualification & Scoring"],
    ["brandVoice.json", "Brand Voice & Communication"],
    ["serviceAreas.json", "Service Areas"],
  ];

  for (const [file, label] of businessFiles) {
    const data = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, file));
    if (data) {
      sections.push(sectionHeader(label) + compactJson(data));
    }
  }

  const industryFiles: Array<[string, string]> = [
    ["officeFurnitureIndustry.json", "Office Furniture Industry Knowledge"],
    ["workplaceDesign.json", "Workplace Design Principles"],
    ["officeFitoutProcess.json", "Office Fit-out Process"],
    ["constructionWorkflow.json", "Construction Workflow"],
    ["commercialFurnitureSales.json", "Commercial Furniture Sales"],
  ];

  for (const [file, label] of industryFiles) {
    const data = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, "industry", file));
    if (data) {
      sections.push(sectionHeader(label) + compactJson(data));
    }
  }

  const psychologyFiles: Array<[string, string]> = [
    ["b2bBuyingPsychology.json", "B2B Buying Psychology"],
    ["procurementBehaviour.json", "Procurement Behaviour"],
    ["negotiationPsychology.json", "Negotiation Psychology"],
    ["stakeholderDynamics.json", "Stakeholder Dynamics"],
    ["valuePerception.json", "Value Perception & Premium Positioning"],
    ["constructionDecisionPsychology.json", "Construction Decision Psychology"],
  ];

  for (const [file, label] of psychologyFiles) {
    const data = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, "psychology", file));
    if (data) {
      sections.push(sectionHeader(label) + compactJson(data));
    }
  }

  _compiled = sections.join("\n");
  _compiledAt = now;

  return _compiled;
}

export function getKnowledgeSection(
  section: "business" | "industry" | "psychology"
): string {
  const all = getCompiledKnowledge();
  const markers = {
    business: ["COMPANY PROFILE", "SERVICE AREAS"],
    industry: ["OFFICE FURNITURE INDUSTRY KNOWLEDGE", "COMMERCIAL FURNITURE SALES"],
    psychology: ["B2B BUYING PSYCHOLOGY", "CONSTRUCTION DECISION PSYCHOLOGY"],
  };

  const [start, end] = markers[section];
  const startIdx = all.indexOf(`### ${start}`);
  const endIdx = all.indexOf(`### ${end}`);

  if (startIdx === -1) return all;
  if (endIdx === -1) return all.slice(startIdx);

  const endBlock = all.indexOf("\n### ", endIdx + 1);
  return all.slice(startIdx, endBlock === -1 ? undefined : endBlock);
}

export function getClientProfileByType(profileId: string): string {
  const data = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, "clientProfiles.json"));
  if (!data) return "";
  const profiles = (data as any).idealClientProfiles as any[];
  const profile = profiles?.find((p: any) => p.id === profileId);
  return profile ? compactJson(profile) : "";
}

export function getLeadQualificationRules(): string {
  const data = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, "projectQualificationRules.json"));
  return data ? compactJson(data) : "";
}

export function getSalesFramework(): string {
  const pricing = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, "pricingStrategy.json"));
  const offers = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, "offerStructure.json"));
  const sales = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, "industry", "commercialFurnitureSales.json"));
  const negotiation = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, "psychology", "negotiationPsychology.json"));

  return [
    pricing ? sectionHeader("Pricing Strategy") + compactJson(pricing) : "",
    offers ? sectionHeader("Offer Structure") + compactJson(offers) : "",
    sales ? sectionHeader("Sales Process") + compactJson(sales) : "",
    negotiation ? sectionHeader("Negotiation Psychology") + compactJson(negotiation) : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function getWorkplaceDesignKnowledge(): string {
  const design = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, "industry", "workplaceDesign.json"));
  const fitout = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, "industry", "officeFitoutProcess.json"));
  const industry = safeReadJson(path.join(KNOWLEDGE_BASE_PATH, "industry", "officeFurnitureIndustry.json"));

  return [
    industry ? sectionHeader("Product Knowledge") + compactJson(industry) : "",
    design ? sectionHeader("Workplace Design") + compactJson(design) : "",
    fitout ? sectionHeader("Fit-out Process") + compactJson(fitout) : "",
  ]
    .filter(Boolean)
    .join("\n");
}
