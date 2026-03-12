/**
 * Workspace Learning Service
 * 
 * Auto-captures insights from every AI Office Planner submission.
 * Builds pattern intelligence that improves future AI recommendations.
 * 
 * Triggered: after planning request AI analysis completes
 * Updated:   when payment confirmed (marks as converted)
 */

import { storage } from "../storage";
import type { WorkspaceLearning } from "@shared/schema";

interface AiRecSummary {
  officeType?: string;
  estimatedProjectValue?: string;
  leadScore?: number;
  workspaceZones?: Array<{ zone: string; percentage: number; color: string }>;
  productRecommendations?: Array<{ category: string; quantity: number; productName: string }>;
  costBreakdown?: { furniture: number; installation: number; delivery: number; total: number };
  styleDirection?: string;
  implementationTimeline?: string;
}

/**
 * Derive the package tier from estimated cost or lead score
 */
function derivePackageTier(estimatedCost: string, leadScore?: number | null): string {
  const nums = (estimatedCost || "").match(/[\d,]+/g)?.map(s => parseInt(s.replace(/,/g, ""), 10)) || [];
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  if (avg >= 150000 || (leadScore && leadScore >= 80)) return "Executive";
  if (avg >= 60000 || (leadScore && leadScore >= 50)) return "Professional";
  return "Foundation";
}

/**
 * Extract supplier mix from product recommendations
 */
function deriveSupplierMix(productRecs: AiRecSummary["productRecommendations"]): string {
  if (!productRecs || productRecs.length === 0) return "";
  const categories = [...new Set(productRecs.map(p => p.category))];

  const mix: string[] = [];
  const hasSeating = categories.some(c => c.toLowerCase().includes("chair") || c.toLowerCase().includes("seating"));
  const hasDesks = categories.some(c => c.toLowerCase().includes("desk") || c.toLowerCase().includes("workstation"));
  const hasExec = categories.some(c => c.toLowerCase().includes("executive") || c.toLowerCase().includes("reception"));
  const hasBoards = categories.some(c => c.toLowerCase().includes("boardroom") || c.toLowerCase().includes("meeting"));
  const hasSitStand = categories.some(c => c.toLowerCase().includes("sit-stand") || c.toLowerCase().includes("height"));

  if (hasSeating) mix.push("Boke (seating)");
  if (hasDesks && !hasSitStand) mix.push("Guangzhou Meiyi (desks)");
  if (hasSitStand) mix.push("Huasheng Gaozhuo (sit-stand)");
  if (hasExec) mix.push("Ruby/Xitian (executive/reception)");
  if (hasBoards && !hasDesks) mix.push("Guangzhou Meiyi (meeting tables)");
  return mix.join(", ");
}

/**
 * Build a key insight sentence from zones and package
 */
function buildKeyInsight(aiRec: AiRecSummary, staffCount: string, officeSqm: string): string {
  const parts: string[] = [];
  if (aiRec.officeType) parts.push(aiRec.officeType);
  if (officeSqm && staffCount) {
    const sqm = parseFloat(officeSqm);
    const staff = parseInt(staffCount, 10);
    if (sqm > 0 && staff > 0) {
      const sqmPerPerson = (sqm / staff).toFixed(1);
      parts.push(`${sqmPerPerson}sqm/person density`);
    }
  }
  if (aiRec.implementationTimeline) parts.push(`${aiRec.implementationTimeline} timeline`);
  if (aiRec.estimatedProjectValue) parts.push(`est. ${aiRec.estimatedProjectValue}`);
  return parts.join(" | ");
}

/**
 * Capture workspace learning record from a planning request AI result.
 * Called non-blocking after planning request is saved.
 */
export async function captureWorkspaceLearning(data: {
  planningRequestId: string;
  clientName: string;
  clientCompany: string;
  city?: string;
  projectType?: string;
  officeSqm?: string;
  staffCount?: string;
  meetingRoomCount?: string;
  receptionIncluded: boolean;
  breakoutIncluded: boolean;
  executiveOfficeIncluded: boolean;
  budgetRange?: string;
  stylePreference?: string;
  aiRec: AiRecSummary | null;
  geometrySource?: string | null;
  geometryConfidence?: number | null;
  designEngineUsed?: boolean;
}): Promise<void> {
  try {
    if (!data.aiRec) return;

    const packageTier = derivePackageTier(
      data.aiRec.estimatedProjectValue || "",
      data.aiRec.leadScore
    );

    const supplierMix = deriveSupplierMix(data.aiRec.productRecommendations);
    const keyInsight = buildKeyInsight(data.aiRec, data.staffCount || "", data.officeSqm || "");

    await storage.createWorkspaceLearning({
      planningRequestId: data.planningRequestId,
      clientName: data.clientName,
      clientCompany: data.clientCompany,
      city: data.city || null,
      projectType: data.projectType || null,
      officeSqm: data.officeSqm || null,
      staffCount: data.staffCount || null,
      meetingRoomCount: data.meetingRoomCount || null,
      receptionIncluded: data.receptionIncluded,
      breakoutIncluded: data.breakoutIncluded,
      executiveOfficeIncluded: data.executiveOfficeIncluded,
      budgetRange: data.budgetRange || null,
      stylePreference: data.stylePreference || null,
      officeType: data.aiRec.officeType || null,
      packageTier,
      estimatedCost: data.aiRec.estimatedProjectValue || null,
      leadScore: data.aiRec.leadScore || null,
      workspaceZonesJson: data.aiRec.workspaceZones
        ? JSON.stringify(data.aiRec.workspaceZones.map(z => ({ zone: z.zone, pct: z.percentage })))
        : null,
      productRecsJson: data.aiRec.productRecommendations
        ? JSON.stringify(data.aiRec.productRecommendations.map(p => ({ cat: p.category, qty: p.quantity, name: p.productName })))
        : null,
      supplierMix: supplierMix || null,
      keyInsight: keyInsight || null,
      conversionResult: "pending",
      geometrySource: data.geometrySource || null,
      geometryConfidence: data.geometryConfidence != null ? String(Math.round(data.geometryConfidence * 100)) + "%" : null,
      designEngineUsed: data.designEngineUsed ?? false,
    });

    console.log(`[WorkspaceLearning] Captured record for PR ${data.planningRequestId}`);
  } catch (err: any) {
    console.error("[WorkspaceLearning] Capture failed (non-fatal):", err.message);
  }
}

/**
 * Build a learning context string to inject into the AI planner prompt.
 * Shows the AI what has worked for similar projects before.
 */
export function buildLearningContext(similar: WorkspaceLearning[]): string {
  if (!similar || similar.length === 0) return "";

  const lines = [
    "SIMILAR COMPLETED PROJECTS (use these patterns to calibrate your recommendation):",
  ];

  for (const r of similar) {
    const zones = (() => {
      try {
        const zArr = JSON.parse(r.workspaceZonesJson || "[]");
        return zArr.map((z: any) => `${z.zone} (${z.pct}%)`).join(", ");
      } catch { return ""; }
    })();

    lines.push(`- ${r.officeType || r.projectType || "Office"} | ${r.officeSqm || "?"}sqm | ${r.staffCount || "?"}staff | ${r.estimatedCost || "?"} | Tier: ${r.packageTier || "?"} | Suppliers: ${r.supplierMix || "?"}`);
    if (zones) lines.push(`  Zones: ${zones}`);
    if (r.keyInsight) lines.push(`  Insight: ${r.keyInsight}`);
  }

  return lines.join("\n");
}
