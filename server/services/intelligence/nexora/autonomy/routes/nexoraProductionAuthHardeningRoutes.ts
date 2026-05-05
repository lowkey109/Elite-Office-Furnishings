import type { Express } from "express";

function now() {
  return new Date().toISOString();
}

function safety() {
  return {
    adminLoginMustUseServer: true,
    adminPasswordFromEnvOnly: true,
    noHardcodedProductionPassword: true,
    protectAdminRoutes: true,
    protectTradingRoutes: true,
    protectBankRoutes: true,
    liveTradingRequiresSeparateApproval: true
  };
}

export function registerNexoraProductionAuthHardeningRoutes(app: Express): void {
  app.get("/api/nexora/auth-hardening/status", (_req, res) => {
    res.json({
      ok: true,
      service: "nexora_auth_hardening_status",
      generatedAt: now(),
      status: "hardening_plan_ready",
      currentRules: [
        "Admin login must call /api/admin/login",
        "ADMIN_EMAIL and ADMIN_PASSWORD come from Railway variables",
        "No passwords should be committed",
        "Admin pages must remain behind admin auth gate",
        "Live trading buttons must remain locked unless separately approved"
      ],
      safety: safety()
    });
  });

  app.get("/api/nexora/auth-hardening/checklist", (_req, res) => {
    res.json({
      ok: true,
      service: "nexora_auth_hardening_checklist",
      generatedAt: now(),
      checklist: [
        "Rotate ADMIN_PASSWORD after it was pasted anywhere",
        "Set ADMIN_EMAIL in Railway",
        "Set ADMIN_PASSWORD in Railway",
        "Clear browser site data after auth changes",
        "Keep /api/admin/login public enough to log in",
        "Keep protected /api/admin/* routes guarded after login",
        "Add rate limiting before public scale",
        "Add CSRF/session hardening before customer access",
        "Keep bank and live-money routes operator-only",
        "Keep audit logs for approval actions"
      ],
      productionEnvRequired: [
        "ADMIN_EMAIL",
        "ADMIN_PASSWORD",
        "SESSION_SECRET or equivalent later"
      ],
      safety: safety()
    });
  });

  app.get("/api/nexora/auth-hardening/route-map", (_req, res) => {
    res.json({
      ok: true,
      service: "nexora_auth_hardening_route_map",
      generatedAt: now(),
      publicRoutes: [
        "/",
        "/api/nexora/ping",
        "/api/admin/login"
      ],
      protectedAreas: [
        "/admin/*",
        "/api/admin/* except /api/admin/login",
        "/api/nexora/live-money/*",
        "/api/nexora/bank-connect/*",
        "/api/nexora/binance/live/*"
      ],
      safety: safety()
    });
  });
}
