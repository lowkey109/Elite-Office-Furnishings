export type ClientPlan =
  | "free"
  | "starter"
  | "growth"
  | "leasehawk-pro"
  | "leasehawk-plus"
  | "enterprise"
  | "phantomx-paper"
  | "phantomx-pro"
  | "phantomx-live-readiness";

export type PlanFeature =
  | "client_dashboard"
  | "project_workspace"
  | "procurement"
  | "finance"
  | "leasehawk"
  | "property_listings"
  | "property_enquiries"
  | "leasehawk_reports"
  | "leasehawk_exports"
  | "phantomx_paper"
  | "phantomx_pro"
  | "admin";

export const planRank: Record<ClientPlan, number> = {
  free: 0,
  starter: 1,
  growth: 2,
  "leasehawk-pro": 3,
  "leasehawk-plus": 4,
  enterprise: 5,
  "phantomx-paper": 2,
  "phantomx-pro": 3,
  "phantomx-live-readiness": 5,
};

export function getPlanAccess(plan: string) {
  const p = (plan || "free") as ClientPlan;
  const rank = planRank[p] ?? 0;

  return {
    plan: p,
    rank,
    features: {
      client_dashboard: true,
      project_workspace: rank >= 1 || p === "free",
      procurement: rank >= 2,
      finance: rank >= 2,
      leasehawk: p === "leasehawk-pro" || p === "leasehawk-plus" || p === "enterprise",
      property_listings: p === "leasehawk-pro" || p === "leasehawk-plus" || p === "enterprise",
      property_enquiries: p === "leasehawk-pro" || p === "leasehawk-plus" || p === "enterprise",
      leasehawk_reports: p === "leasehawk-pro" || p === "leasehawk-plus" || p === "enterprise",
      leasehawk_exports: p === "leasehawk-plus" || p === "enterprise",
      phantomx_paper: p === "phantomx-paper" || p === "phantomx-pro" || p === "enterprise",
      phantomx_pro: p === "phantomx-pro" || p === "enterprise",
      admin: false,
    },
    limits: {
      activeProjects:
        p === "free" ? 1 :
        p === "starter" ? 1 :
        p === "growth" ? 3 :
        p === "leasehawk-pro" ? 1 :
        p === "leasehawk-plus" ? 3 :
        p === "enterprise" ? 999 :
        1,
      leasehawkOpportunities:
        p === "leasehawk-pro" ? 50 :
        p === "leasehawk-plus" ? 250 :
        p === "enterprise" ? 1000 :
        0,
      territories:
        p === "leasehawk-pro" ? 1 :
        p === "leasehawk-plus" ? 5 :
        p === "enterprise" ? 999 :
        0,
    },
  };
}

export function requireFeature(plan: string, feature: PlanFeature) {
  const access = getPlanAccess(plan);
  const allowed = Boolean((access.features as any)[feature]);

  if (!allowed) {
    return {
      ok: false,
      locked: true,
      upgradeRequired: true,
      plan,
      feature,
      access,
      message: `Your current plan does not include ${feature}. Upgrade to unlock this feature.`,
    };
  }

  return { ok: true, locked: false, access };
}
