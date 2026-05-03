type MemoryEvent = {
  id: string;
  service: string;
  type: string;
  payload: any;
  createdAt: string;
};

const memoryStore: MemoryEvent[] = [];
const MAX_MEMORY_EVENTS = 500;

export function recordNexoraMemoryEvent(service: string, type: string, payload: any = {}) {
  const event: MemoryEvent = {
    id: `${service}|${type}|${Date.now()}|${Math.random().toString(36).slice(2)}`,
    service,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };

  memoryStore.unshift(event);

  if (memoryStore.length > MAX_MEMORY_EVENTS) {
    memoryStore.length = MAX_MEMORY_EVENTS;
  }

  return {
    ok: true,
    service: "nexora_memory_fallback_runtime",
    stored: true,
    event,
    count: memoryStore.length,
    updatedAt: new Date().toISOString(),
  };
}

export function getNexoraMemoryEvents(limit = 100) {
  return {
    ok: true,
    service: "nexora_memory_fallback_runtime",
    paperOnly: true,
    mode: "memory_only_until_database_recovers",
    count: memoryStore.length,
    rows: memoryStore.slice(0, Number(limit) || 100),
    updatedAt: new Date().toISOString(),
  };
}

export function clearNexoraMemoryEvents() {
  memoryStore.length = 0;

  return {
    ok: true,
    service: "nexora_memory_fallback_runtime",
    cleared: true,
    updatedAt: new Date().toISOString(),
  };
}
