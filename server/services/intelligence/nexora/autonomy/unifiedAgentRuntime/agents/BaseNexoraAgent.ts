import type {
  NexoraAgentDefinition,
  NexoraAgentExecutionResult,
  NexoraAgentRunContext,
  NexoraTaskEnvelope,
} from "../types/nexoraAgentRuntimeTypes";
import { getNexoraAgent, updateNexoraAgentStatus } from "../registry/nexoraAgentRegistry";
import { recordNexoraAgentHeartbeat } from "../heartbeat/nexoraAgentHeartbeat";
import { emitNexoraRuntimeEvent, logNexoraRuntime } from "../events/nexoraRuntimeEventBus";
import { getNexoraMemory, setNexoraMemory } from "../memory/nexoraAgentMemory";
import { updateNexoraTaskStatus, failOrRetryNexoraTask } from "../tasks/nexoraAgentTaskManager";

export abstract class BaseNexoraAgent {
  public readonly agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  abstract execute(context: NexoraAgentRunContext): Promise<NexoraAgentExecutionResult>;

  async heartbeat(message = "alive", metadata: Record<string, any> = {}) {
    return recordNexoraAgentHeartbeat(this.agentId, "idle", message, metadata);
  }

  async run(task: NexoraTaskEnvelope): Promise<NexoraAgentExecutionResult> {
    const agent = getNexoraAgent(this.agentId);

    if (!agent) {
      return {
        ok: false,
        status: "failed",
        error: `Agent not registered: ${this.agentId}`,
      };
    }

    await updateNexoraAgentStatus(this.agentId, "busy", {
      currentTaskId: task.taskId,
    });

    await updateNexoraTaskStatus(task.taskId, "running", {
      claimedBy: this.agentId,
    });

    const context: NexoraAgentRunContext = {
      agent: agent as NexoraAgentDefinition,
      task,
      memory: {
        get: async (key, scope = "agent") => getNexoraMemory(key, scope, this.agentId),
        set: async (input) => setNexoraMemory({
          ...input,
          scope: input.scope || "agent",
          ownerId: input.ownerId || this.agentId,
        }),
      },
      emit: async (type, message, payload = {}, severity = "info") =>
        emitNexoraRuntimeEvent(type, this.agentId, message, payload, severity),
      log: async (message, payload = {}, severity = "info") =>
        logNexoraRuntime(this.agentId, message, payload, severity),
    };

    try {
      const result = await this.execute(context);

      if (result.status === "completed") {
        await updateNexoraTaskStatus(task.taskId, "completed", {
          result: result.result || {},
          error: null,
        });
      } else if (result.status === "approval_required") {
        await updateNexoraTaskStatus(task.taskId, "approval_required", {
          result: result.result || {},
          error: null,
        });
      } else if (result.status === "skipped") {
        await updateNexoraTaskStatus(task.taskId, "cancelled", {
          result: result.result || {},
          error: null,
        });
      } else {
        await failOrRetryNexoraTask(task.taskId, result.error || "Agent execution failed.");
      }

      await updateNexoraAgentStatus(this.agentId, "idle", {
        lastTaskId: task.taskId,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await failOrRetryNexoraTask(task.taskId, message);

      await updateNexoraAgentStatus(this.agentId, "degraded", {
        lastError: message,
      });

      return {
        ok: false,
        status: "failed",
        error: message,
      };
    }
  }
}

export class EchoNexoraAgent extends BaseNexoraAgent {
  async execute(context: NexoraAgentRunContext): Promise<NexoraAgentExecutionResult> {
    await context.log("Echo agent executed task.", {
      taskId: context.task.taskId,
      action: context.task.action,
    });

    return {
      ok: true,
      status: "completed",
      result: {
        echoed: true,
        action: context.task.action,
        payload: context.task.payload,
      },
    };
  }
}
