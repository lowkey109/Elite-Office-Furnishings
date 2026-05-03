export function isDbRecoveryError(err: any) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("database system is in recovery mode") ||
    msg.includes("terminating connection") ||
    msg.includes("connection terminated") ||
    msg.includes("no space left on device")
  );
}

export function nexoraDbFallback(service: string, err: any, extra: any = {}) {
  return {
    ok: false,
    service,
    paperOnly: true,
    dbResilient: true,
    action: "MONITOR_ONLY",
    reason: "Database is temporarily unavailable or recovering. Nexora will not write paper trades until DB is healthy.",
    error: err instanceof Error ? err.message : String(err),
    ...extra,
    updatedAt: new Date().toISOString(),
  };
}
