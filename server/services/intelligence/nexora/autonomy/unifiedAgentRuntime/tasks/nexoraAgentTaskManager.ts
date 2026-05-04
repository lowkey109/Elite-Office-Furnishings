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
import type { NexoraRiskLevel, NexoraTaskEnvelope, NexoraTaskStatus } from "../types/nexoraAgentRuntimeTypes";
import { emitNexoraRuntimeEvent } from "../events/nexoraRuntimeEventBus";

const TASK_LOG = runtimePath("tasks", "task-log.jsonl");

type CreateNexoraTaskInput = Partial<NexoraTaskEnvelope> & {
  action: string;
  type?: string;
  approvalRequired?: boolean;
};

function taskFile(taskId: string) {
  const safe = String(taskId || "task").replace(/[^a-zA-Z0-9._-]/g, "_");
  return runtimePath("tasks", `${safe}.json`);
}

function isNexoraTaskEnvelope(value: NexoraTaskEnvelope | null): value is NexoraTaskEnvelope {
  return Boolean(value && typeof value === "object" && value.taskId && value.action);
}

export async function createNexoraAgentTask(input: CreateNexoraTaskInput) {
  const risk: NexoraRiskLevel = input.risk || "safe";

  const task: NexoraTaskEnvelope = {
    taskId: input.taskId || runtimeId("task"),
    type: input.type || "agent.task",
    action: input.action,
    agentId: input.agentId ?? null,
    requiredCapability: input.requiredCapability ?? null,
    status: risk === "high" || risk === "critical" || input.approvalRequired ? "approval_required" : "queued",
    risk,
    priority: Number(input.priority ?? 50),
    payload: input.payload || {},
    result: null,
    error: null,
    attempts: Number(input.attempts ?? 0),
    maxAttempts: Number(input.maxAttempts ?? 3),
    claimedBy: null,
    claimedAt: null,
    runAfter: input.runAfter || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
    metadata: input.metadata || {},
  };

  writeJsonAtomic(taskFile(task.taskId), task);

  appendJsonl(TASK_LOG, {
    event: "task.created",
    task,
    createdAt: nowIso(),
  });

  await emitNexoraRuntimeEvent("task.created", "nexora_task_manager", `Task created: ${task.action}`, {
    taskId: task.taskId,
    risk: task.risk,
    status: task.status,
  });

  return task;
}

export function getNexoraTask(taskId: string) {
  return readJson<NexoraTaskEnvelope | null>(taskFile(taskId), null);
}

export function listNexoraTasks(input: any = {}) {
  const status = input.status ? String(input.status) : "";
  const agentId = input.agentId ? String(input.agentId) : "";

  const rows = listJsonFiles(runtimePath("tasks"))
    .map((file) => readJson<NexoraTaskEnvelope | null>(file, null))
    .filter(isNexoraTaskEnvelope)
    .filter((task: NexoraTaskEnvelope) => !status || task.status === status)
    .filter((task: NexoraTaskEnvelope) => !agentId || task.agentId === agentId || task.claimedBy === agentId)
    .sort((a: NexoraTaskEnvelope, b: NexoraTaskEnvelope) => Number(b.priority || 0) - Number(a.priority || 0));

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export async function claimNexoraTask(agentId: string, input: any = {}) {
  const requiredCapability = input.requiredCapability ? String(input.requiredCapability) : "";
  const nowMs = Date.now();

  const candidates = listNexoraTasks({ status: "queued" }).rows
    .filter((task: NexoraTaskEnvelope) => !task.agentId || task.agentId === agentId)
    .filter((task: NexoraTaskEnvelope) => !requiredCapability || task.requiredCapability === requiredCapability)
    .filter((task: NexoraTaskEnvelope) => !task.runAfter || new Date(task.runAfter).getTime() <= nowMs);

  const task = candidates[0];

  if (!task) {
    return null;
  }

  task.status = "claimed";
  task.claimedBy = agentId;
  task.claimedAt = nowIso();
  task.updatedAt = nowIso();

  writeJsonAtomic(taskFile(task.taskId), task);

  appendJsonl(TASK_LOG, {
    event: "task.claimed",
    task,
    createdAt: nowIso(),
  });

  await emitNexoraRuntimeEvent("task.claimed", agentId, `Task claimed: ${task.action}`, {
    taskId: task.taskId,
  });

  return task;
}

export async function updateNexoraTaskStatus(
  taskId: string,
  status: NexoraTaskStatus,
  patch: Partial<NexoraTaskEnvelope> = {},
) {
  const existing = getNexoraTask(taskId);

  if (!existing) {
    return null;
  }

  const task: NexoraTaskEnvelope = {
    ...existing,
    ...patch,
    status,
    updatedAt: nowIso(),
    completedAt: status === "completed" || status === "failed" || status === "dead_letter" ? nowIso() : existing.completedAt,
  };

  writeJsonAtomic(taskFile(taskId), task);

  appendJsonl(TASK_LOG, {
    event: `task.${status}`,
    task,
    createdAt: nowIso(),
  });

  await emitNexoraRuntimeEvent(`task.${status}`, task.claimedBy || "nexora_task_manager", `Task ${status}: ${task.action}`, {
    taskId,
  });

  return task;
}

export async function failOrRetryNexoraTask(taskId: string, error: string) {
  const existing = getNexoraTask(taskId);
  if (!existing) return null;

  const attempts = Number(existing.attempts || 0) + 1;

  if (attempts >= Number(existing.maxAttempts || 3)) {
    return updateNexoraTaskStatus(taskId, "dead_letter", {
      attempts,
      error,
    });
  }

  return updateNexoraTaskStatus(taskId, "retrying", {
    attempts,
    error,
    runAfter: new Date(Date.now() + 60_000).toISOString(),
  });
}

export function getNexoraTaskManagerStatus() {
  const rows = listNexoraTasks({}).rows;

  const counts = rows.reduce((acc: Record<string, number>, task: NexoraTaskEnvelope) => {
    acc[task.status] = Number(acc[task.status] || 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_agent_task_manager",
    tasks: rows.length,
    counts,
    logEvents: readJsonl(TASK_LOG).length,
  };
}
