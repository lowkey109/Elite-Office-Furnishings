import {
  appendJsonl,
  nowIso,
  readJson,
  readJsonl,
  runtimeId,
  runtimePath,
  writeJsonAtomic,
} from "../storage/nexoraJsonRuntimeStore";
import type { NexoraMemoryRecord } from "../types/nexoraAgentRuntimeTypes";
import { emitNexoraRuntimeEvent } from "../events/nexoraRuntimeEventBus";

const MEMORY_LOG = runtimePath("memory", "memory-log.jsonl");

function memoryFile(scope: string, key: string, ownerId?: string | null) {
  const safeScope = String(scope || "global").replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeOwner = String(ownerId || "global").replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeKey = String(key || "key").replace(/[^a-zA-Z0-9._-]/g, "_");
  return runtimePath("memory", safeScope, safeOwner, `${safeKey}.json`);
}

export async function setNexoraMemory(
  input: Partial<NexoraMemoryRecord> & { key: string; value: Record<string, any> },
): Promise<NexoraMemoryRecord> {
  const existing = readJson<NexoraMemoryRecord | null>(
    memoryFile(input.scope || "global", input.key, input.ownerId || null),
    null,
  );

  const record: NexoraMemoryRecord = {
    memoryId: existing?.memoryId || runtimeId("memory"),
    scope: input.scope || "global",
    ownerId: input.ownerId || null,
    key: input.key,
    value: input.value,
    importance: Number(input.importance ?? existing?.importance ?? 50),
    tags: Array.isArray(input.tags) ? input.tags : existing?.tags || [],
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  writeJsonAtomic(memoryFile(record.scope, record.key, record.ownerId), record);

  appendJsonl(MEMORY_LOG, {
    event: "memory.set",
    record,
    createdAt: nowIso(),
  });

  await emitNexoraRuntimeEvent("memory.set", "nexora_memory", `Memory set: ${record.scope}/${record.key}`, {
    memoryId: record.memoryId,
    ownerId: record.ownerId,
    tags: record.tags,
  });

  return record;
}

export async function getNexoraMemory(
  key: string,
  scope: NexoraMemoryRecord["scope"] = "global",
  ownerId: string | null = null,
): Promise<NexoraMemoryRecord | null> {
  return readJson<NexoraMemoryRecord | null>(memoryFile(scope, key, ownerId), null);
}

export function searchNexoraMemory(input: any = {}) {
  const limit = Number(input.limit || 100);
  const scope = input.scope ? String(input.scope) : "";
  const ownerId = input.ownerId ? String(input.ownerId) : "";
  const tag = input.tag ? String(input.tag) : "";
  const q = input.q ? String(input.q).toLowerCase() : "";

  const rows = readJsonl(MEMORY_LOG)
    .map((row: any) => row.record || row)
    .filter((record: any) => !scope || record.scope === scope)
    .filter((record: any) => !ownerId || record.ownerId === ownerId)
    .filter((record: any) => !tag || (record.tags || []).includes(tag))
    .filter((record: any) => !q || JSON.stringify(record).toLowerCase().includes(q))
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraMemoryStatus() {
  const rows = readJsonl(MEMORY_LOG);

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_agent_memory",
    memories: rows.length,
  };
}
