import {
  appendJsonl,
  listJsonFiles,
  nowIso,
  readJson,
  readJsonl,
  runtimeId,
  runtimePath,
  writeJsonAtomic,
} from "../storage/nexoraJsonRuntimeStore";
import type { NexoraAgentDefinition, NexoraAgentStatus } from "../types/nexoraAgentRuntimeTypes";
import { emitNexoraRuntimeEvent } from "../events/nexoraRuntimeEventBus";

const REGISTRY_LOG = runtimePath("registry", "agent-registry-log.jsonl");

function agentFile(agentId: string) {
  const safe = String(agentId || "agent").replace(/[^a-zA-Z0-9._-]/g, "_");
  return runtimePath("agents", `${safe}.json`);
}

export async function registerNexoraAgent(input: Partial<NexoraAgentDefinition> & { agentId?: string; name: string }): Promise<NexoraAgentDefinition> {
  const agentId = input.agentId || runtimeId("agent");
  const existing = readJson<NexoraAgentDefinition | null>(agentFile(agentId), null);

  const agent: NexoraAgentDefinition = {
    agentId,
    name: input.name,
    kind: input.kind || existing?.kind || "system",
    status: input.status || existing?.status || "idle",
    version: input.version || existing?.version || "1.0.0",
    description: input.description || existing?.description || "",
    capabilities: Array.isArray(input.capabilities) ? input.capabilities : existing?.capabilities || [],
    tags: Array.isArray(input.tags) ? input.tags : existing?.tags || [],
    maxConcurrentTasks: Number(input.maxConcurrentTasks ?? existing?.maxConcurrentTasks ?? 1),
    retryLimit: Number(input.retryLimit ?? existing?.retryLimit ?? 3),
    heartbeatTtlMs: Number(input.heartbeatTtlMs ?? existing?.heartbeatTtlMs ?? 120000),
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
    metadata: input.metadata || existing?.metadata || {},
  };

  writeJsonAtomic(agentFile(agentId), agent);

  appendJsonl(REGISTRY_LOG, {
    event: "agent.registered",
    agent,
    createdAt: nowIso(),
  });

  await emitNexoraRuntimeEvent("agent.registered", "nexora_agent_registry", `Agent registered: ${agent.agentId}`, {
    agentId: agent.agentId,
    kind: agent.kind,
  });

  return agent;
}

export function getNexoraAgent(agentId: string): NexoraAgentDefinition | null {
  return readJson<NexoraAgentDefinition | null>(agentFile(agentId), null);
}

export function listNexoraAgents(input: any = {}) {
  const kind = input.kind ? String(input.kind) : "";
  const status = input.status ? String(input.status) : "";

  const rows = listJsonFiles(runtimePath("agents"))
    .map((file) => readJson<NexoraAgentDefinition | null>(file, null))
    .filter(Boolean)
    .filter((agent: any) => !kind || agent.kind === kind)
    .filter((agent: any) => !status || agent.status === status)
    .sort((a: any, b: any) => String(a.agentId).localeCompare(String(b.agentId)));

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export async function updateNexoraAgentStatus(agentId: string, status: NexoraAgentStatus, metadata: Record<string, any> = {}) {
  const existing = getNexoraAgent(agentId);

  if (!existing) {
    return null;
  }

  return registerNexoraAgent({
    ...existing,
    status,
    metadata: {
      ...existing.metadata,
      ...metadata,
      statusUpdatedAt: nowIso(),
    },
  });
}

export async function seedNexoraCoreAgents() {
  const agents = [
    {
      agentId: "nexora_orchestrator",
      name: "Nexora Orchestrator",
      kind: "system" as const,
      description: "Central orchestrator for Nexora autonomous operations.",
      capabilities: [
        { key: "orchestrate", description: "Coordinate agent tasks.", risk: "medium" as const, enabled: true },
      ],
      tags: ["core", "orchestration"],
    },
    {
      agentId: "phantom_x_polymarket_paper",
      name: "Phantom X Polymarket Paper Agent",
      kind: "polymarket" as const,
      description: "Paper-only Polymarket/Binance intelligence agent.",
      capabilities: [
        { key: "paper_signal", description: "Create paper-only market signal.", risk: "medium" as const, enabled: true },
      ],
      tags: ["trading", "paper-only"],
    },
    {
      agentId: "swarm_consensus_agent",
      name: "Swarm Consensus Agent",
      kind: "swarm" as const,
      description: "Multi-agent consensus scaffold.",
      capabilities: [
        { key: "consensus", description: "Aggregate multiple model/agent views.", risk: "safe" as const, enabled: true },
      ],
      tags: ["swarm", "consensus"],
    },
    {
      agentId: "risk_governor_agent",
      name: "Risk Governor Agent",
      kind: "risk" as const,
      description: "Risk and safety gate for strategy execution.",
      capabilities: [
        { key: "risk_check", description: "Classify and block unsafe actions.", risk: "critical" as const, enabled: true },
      ],
      tags: ["risk", "safety"],
    },
  ];

  const registered = [];
  for (const agent of agents) {
    registered.push(await registerNexoraAgent(agent));
  }

  return {
    ok: true,
    nexoraBrain: true,
    registered,
  };
}

export function getNexoraAgentRegistryStatus() {
  const rows = listNexoraAgents();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_agent_registry",
    agents: rows.count,
    logEvents: readJsonl(REGISTRY_LOG).length,
  };
}
