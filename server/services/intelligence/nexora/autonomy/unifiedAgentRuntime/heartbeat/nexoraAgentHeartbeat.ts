import {
  appendJsonl,
  nowIso,
  readJsonl,
  runtimeId,
  runtimePath,
  writeJsonAtomic,
} from "../storage/nexoraJsonRuntimeStore";
import type { NexoraAgentStatus, NexoraHeartbeat } from "../types/nexoraAgentRuntimeTypes";
import { emitNexoraRuntimeEvent } from "../events/nexoraRuntimeEventBus";
import { updateNexoraAgentStatus } from "../registry/nexoraAgentRegistry";

const HEARTBEAT_LOG = runtimePath("heartbeats", "heartbeat-log.jsonl");

function heartbeatFile(agentId: string) {
  const safe = String(agentId || "agent").replace(/[^a-zA-Z0-9._-]/g, "_");
  return runtimePath("heartbeats", `${safe}.json`);
}

export async function recordNexoraAgentHeartbeat(
  agentId: string,
  status: NexoraAgentStatus = "idle",
  message = "heartbeat",
  metadata: Record<string, any> = {},
): Promise<NexoraHeartbeat> {
  const heartbeat: NexoraHeartbeat = {
    heartbeatId: runtimeId("heartbeat"),
    agentId,
    status,
    message,
    createdAt: nowIso(),
    metadata,
  };

  writeJsonAtomic(heartbeatFile(agentId), heartbeat);
  appendJsonl(HEARTBEAT_LOG, {
    event: "heartbeat.recorded",
    heartbeat,
    createdAt: nowIso(),
  });

  await updateNexoraAgentStatus(agentId, status, {
    lastHeartbeatAt: heartbeat.createdAt,
  });

  await emitNexoraRuntimeEvent("agent.heartbeat", agentId, message, {
    heartbeatId: heartbeat.heartbeatId,
    status,
  });

  return heartbeat;
}

export function listNexoraHeartbeats(input: any = {}) {
  const agentId = input.agentId ? String(input.agentId) : "";
  const limit = Number(input.limit || 100);

  const rows = readJsonl(HEARTBEAT_LOG)
    .filter((row: any) => row.event === "heartbeat.recorded")
    .map((row: any) => row.heartbeat)
    .filter((heartbeat: any) => !agentId || heartbeat.agentId === agentId)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraHeartbeatStatus() {
  const rows = listNexoraHeartbeats({ limit: 1000 });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_agent_heartbeat",
    heartbeats: rows.count,
  };
}
