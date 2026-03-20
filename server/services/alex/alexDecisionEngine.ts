import type { DepartmentName } from "./companyOrchestrator";

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function decideDepartments(input: string): DepartmentName[] {
  const text = input.toLowerCase().trim();
  const selected = new Set<DepartmentName>();

  if (
    hasAny(text, [
      "invoice",
      "payment",
      "finance",
      "cashflow",
      "cash flow",
      "profit",
      "margin",
      "budget",
      "pricing",
      "quote value",
      "deposit",
    ])
  ) {
    selected.add("finance");
  }

  if (
    hasAny(text, [
      "client",
      "customer",
      "experience",
      "onboarding",
      "service",
      "support",
      "handover",
      "follow up",
      "follow-up",
    ])
  ) {
    selected.add("clientExperience");
  }

  if (
    hasAny(text, [
      "intelligence",
      "signal",
      "lead source",
      "office move",
      "radar",
      "deal hunter",
      "company intelligence",
      "scan",
      "market signal",
    ])
  ) {
    selected.add("intelligence");
  }

  if (
    hasAny(text, [
      "marketing",
      "linkedin",
      "seo",
      "campaign",
      "content",
      "brand",
      "ad",
      "funnel",
      "website copy",
      "post",
    ])
  ) {
    selected.add("marketing");
  }

  if (
    hasAny(text, [
      "ops",
      "operations",
      "process",
      "workflow",
      "delivery",
      "install",
      "scheduler",
      "automation",
      "system",
    ])
  ) {
    selected.add("operations");
  }

  if (
    hasAny(text, [
      "sales",
      "deal",
      "pipeline",
      "close",
      "proposal",
      "quote",
      "revenue",
      "lead",
      "meeting",
    ])
  ) {
    selected.add("revenueOperations");
  }

  if (
    hasAny(text, [
      "supplier",
      "procurement",
      "vendor",
      "catalog",
      "sku",
      "stock",
      "pricing file",
      "manufacturer",
    ])
  ) {
    selected.add("supplier");
  }

  if (
    hasAny(text, [
      "workspace",
      "fitout",
      "fit-out",
      "layout",
      "floor plan",
      "workplace",
      "office design",
      "space plan",
      "furniture plan",
    ])
  ) {
    selected.add("workspace");
  }

  if (selected.size === 0) {
    selected.add("operations");
    selected.add("revenueOperations");
  }

  return [...selected];
}