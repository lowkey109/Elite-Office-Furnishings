type NexoraAdminSettings = {
  scannerEnabled: boolean;
  bankrollUsd: number;
  minLiquidityUsd: number;
  maxSpreadPct: number;
  minEdgePct: number;
  maxMarkets: number;
  alertEdgePct: number;
  categories: string[];
};

const settings: NexoraAdminSettings = {
  scannerEnabled: true,
  bankrollUsd: 1000,
  minLiquidityUsd: 1000,
  maxSpreadPct: 5,
  minEdgePct: 7,
  maxMarkets: 25,
  alertEdgePct: 10,
  categories: ["politics", "sports", "crypto", "macro", "culture", "general"],
};

const alerts: any[] = [];

export function getNexoraAdminControls() {
  return {
    ok: true,
    service: "nexora_admin_controls",
    paperOnly: true,
    settings,
    updatedAt: new Date().toISOString(),
  };
}

export function updateNexoraAdminControls(input: Partial<NexoraAdminSettings> = {}) {
  if (typeof input.scannerEnabled === "boolean") settings.scannerEnabled = input.scannerEnabled;
  if (Number.isFinite(Number(input.bankrollUsd))) settings.bankrollUsd = Number(input.bankrollUsd);
  if (Number.isFinite(Number(input.minLiquidityUsd))) settings.minLiquidityUsd = Number(input.minLiquidityUsd);
  if (Number.isFinite(Number(input.maxSpreadPct))) settings.maxSpreadPct = Number(input.maxSpreadPct);
  if (Number.isFinite(Number(input.minEdgePct))) settings.minEdgePct = Number(input.minEdgePct);
  if (Number.isFinite(Number(input.maxMarkets))) settings.maxMarkets = Number(input.maxMarkets);
  if (Number.isFinite(Number(input.alertEdgePct))) settings.alertEdgePct = Number(input.alertEdgePct);
  if (Array.isArray(input.categories)) settings.categories = input.categories.map(String);

  return {
    ok: true,
    service: "nexora_admin_controls",
    paperOnly: true,
    settings,
    updatedAt: new Date().toISOString(),
  };
}

export function createNexoraAlert(input: any = {}) {
  const alert = {
    id: String(input.id || `alert_${Date.now()}_${Math.random().toString(36).slice(2)}`),
    type: String(input.type || "edge_alert"),
    severity: String(input.severity || "info"),
    marketId: input.marketId || null,
    title: input.title || null,
    edgePct: Number(input.edgePct || 0),
    payload: input,
    createdAt: new Date().toISOString(),
  };

  alerts.unshift(alert);
  if (alerts.length > 200) alerts.length = 200;

  return {
    ok: true,
    service: "nexora_alert_system",
    paperOnly: true,
    alert,
    alertCount: alerts.length,
    updatedAt: new Date().toISOString(),
  };
}

export function getNexoraAlerts(limit = 50) {
  return {
    ok: true,
    service: "nexora_alert_system",
    paperOnly: true,
    count: alerts.length,
    rows: alerts.slice(0, Number(limit) || 50),
    updatedAt: new Date().toISOString(),
  };
}
