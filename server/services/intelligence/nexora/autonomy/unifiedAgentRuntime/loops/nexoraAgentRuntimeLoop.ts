import { EchoNexoraAgent } from "../agents/BaseNexoraAgent";
import { claimNexoraTask } from "../tasks/nexoraAgentTaskManager";
import { getNexoraAgentRegistryStatus, listNexoraAgents, seedNexoraCoreAgents } from "../registry/nexoraAgentRegistry";
import { getNexoraTaskManagerStatus } from "../tasks/nexoraAgentTaskManager";
import { getNexoraHeartbeatStatus } from "../heartbeat/nexoraAgentHeartbeat";
import { getNexoraMemoryStatus } from "../memory/nexoraAgentMemory";
import { listNexoraRuntimeEvents } from "../events/nexoraRuntimeEventBus";
import type { NexoraAgentDefinition } from "../types/nexoraAgentRuntimeTypes";

let timer: NodeJS.Timeout | null = null;

function isAgentDefinition(value: NexoraAgentDefinition | null | undefined): value is NexoraAgentDefinition {
  return Boolean(value && typeof value === "object" && value.agentId);
}

export async function runNexoraAgentRuntimeTick(input: any = {}) {
  await seedNexoraCoreAgents();

  const agents = (listNexoraAgents({}).rows || []).filter(isAgentDefinition);
  const limit = Number(input.limit || 10);
  const results = [];

  for (const agent of agents.slice(0, limit)) {
    const task = await claimNexoraTask(agent.agentId);

    if (!task) {
      results.push({
        agentId: agent.agentId,
        claimed: false,
      });
      continue;
    }

    const runner = new EchoNexoraAgent(agent.agentId);
    const result = await runner.run(task);

    results.push({
      agentId: agent.agentId,
      claimed: true,
      taskId: task.taskId,
      result,
    });
  }

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_agent_runtime_tick",
    results,
  };
}

export function startNexoraAgentRuntimeLoop(input: any = {}) {
  const intervalMs = Number(input.intervalMs || process.env.NEXORA_AGENT_RUNTIME_INTERVAL_MS || 60000);
  const enabled = input.enabled !== false && process.env.NEXORA_AGENT_RUNTIME_DISABLED !== "true";

  if (!enabled) {
    return {
      ok: true,
      nexoraBrain: true,
      started: false,
      reason: "Agent runtime loop disabled.",
    };
  }

  if (timer) {
    return {
      ok: true,
      nexoraBrain: true,
      started: false,
      alreadyRunning: true,
      intervalMs,
    };
  }

  timer = setInterval(() => {
    runNexoraAgentRuntimeTick({}).catch((error) => {
      console.error("[NEXORA_AGENT_RUNTIME_LOOP_ERROR]", error);
    });
  }, intervalMs);

  if (typeof timer.unref === "function") timer.unref();

  runNexoraAgentRuntimeTick({}).catch((error) => {
    console.error("[NEXORA_AGENT_RUNTIME_STARTUP_TICK_ERROR]", error);
  });

  return {
    ok: true,
    nexoraBrain: true,
    started: true,
    intervalMs,
  };
}

export function stopNexoraAgentRuntimeLoop() {
  if (timer) clearInterval(timer);
  timer = null;

  return {
    ok: true,
    nexoraBrain: true,
    stopped: true,
  };
}

export function getNexoraUnifiedAgentRuntimeStatus() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_unified_agent_runtime",
    loopRunning: Boolean(timer),
    registry: getNexoraAgentRegistryStatus(),
    tasks: getNexoraTaskManagerStatus(),
    heartbeats: getNexoraHeartbeatStatus(),
    memory: getNexoraMemoryStatus(),
    events: listNexoraRuntimeEvents({ limit: 20 }),
    safety: {
      noLiveTrading: true,
      noPrivateKeys: true,
      humansOnlyApproveSignCommit: true,
    },
  };
}
