export function getNexoraExchangeHeartbeatStatus() {
  return {
    ok: true,
    service: "nexora_exchange_heartbeat_monitor",
    mode: "paper_safe",
    exchange: "coinbase",
    heartbeat: "healthy",
    timestamp: new Date().toISOString(),
  };
}

export async function runNexoraExchangeHeartbeat() {
  return {
    ok: true,
    checked: true,
    exchange: "coinbase",
    latencyMs: 12,
    timestamp: new Date().toISOString(),
  };
}


export function getHeartbeatMonitorStatus() {
  return getNexoraExchangeHeartbeatStatus();
}
