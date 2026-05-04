export type NexoraAgentStatus =
  | "idle"
  | "busy"
  | "paused"
  | "degraded"
  | "offline"
  | "retired";

export type NexoraTaskStatus =
  | "queued"
  | "claimed"
  | "running"
  | "completed"
  | "failed"
  | "retrying"
  | "approval_required"
  | "dead_letter"
  | "cancelled";

export type NexoraRiskLevel = "safe" | "medium" | "high" | "critical";

export type NexoraEventSeverity = "debug" | "info" | "warning" | "error" | "critical";

export type NexoraAgentKind =
  | "office"
  | "trading"
  | "polymarket"
  | "binance"
  | "swarm"
  | "strategy"
  | "risk"
  | "execution"
  | "memory"
  | "learning"
  | "reporting"
  | "system";

export interface NexoraAgentCapability {
  key: string;
  description: string;
  risk: NexoraRiskLevel;
  enabled: boolean;
}

export interface NexoraAgentDefinition {
  agentId: string;
  name: string;
  kind: NexoraAgentKind;
  status: NexoraAgentStatus;
  version: string;
  description: string;
  capabilities: NexoraAgentCapability[];
  tags: string[];
  maxConcurrentTasks: number;
  retryLimit: number;
  heartbeatTtlMs: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export interface NexoraTaskEnvelope {
  taskId: string;
  type: string;
  action: string;
  agentId?: string | null;
  requiredCapability?: string | null;
  status: NexoraTaskStatus;
  risk: NexoraRiskLevel;
  priority: number;
  payload: Record<string, any>;
  result?: Record<string, any> | null;
  error?: string | null;
  attempts: number;
  maxAttempts: number;
  claimedBy?: string | null;
  claimedAt?: string | null;
  runAfter?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  metadata: Record<string, any>;
}

export interface NexoraHeartbeat {
  heartbeatId: string;
  agentId: string;
  status: NexoraAgentStatus;
  message: string;
  createdAt: string;
  metadata: Record<string, any>;
}

export interface NexoraMemoryRecord {
  memoryId: string;
  scope: "agent" | "global" | "task" | "strategy" | "market" | "company";
  ownerId?: string | null;
  key: string;
  value: Record<string, any>;
  importance: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NexoraRuntimeEvent {
  eventId: string;
  type: string;
  severity: NexoraEventSeverity;
  source: string;
  message: string;
  payload: Record<string, any>;
  createdAt: string;
}

export interface NexoraAgentRunContext {
  agent: NexoraAgentDefinition;
  task: NexoraTaskEnvelope;
  memory: {
    get: (key: string, scope?: NexoraMemoryRecord["scope"]) => Promise<NexoraMemoryRecord | null>;
    set: (input: Partial<NexoraMemoryRecord> & { key: string; value: Record<string, any> }) => Promise<NexoraMemoryRecord>;
  };
  emit: (type: string, message: string, payload?: Record<string, any>, severity?: NexoraEventSeverity) => Promise<NexoraRuntimeEvent>;
  log: (message: string, payload?: Record<string, any>, severity?: NexoraEventSeverity) => Promise<NexoraRuntimeEvent>;
}

export interface NexoraAgentExecutionResult {
  ok: boolean;
  status: "completed" | "failed" | "approval_required" | "skipped";
  result?: Record<string, any>;
  error?: string;
  events?: NexoraRuntimeEvent[];
}

export interface NexoraAgentRuntimeSummary {
  ok: boolean;
  nexoraBrain: true;
  service: "nexora_unified_agent_runtime";
  generatedAt: string;
  agents: number;
  tasks: {
    queued: number;
    claimed: number;
    running: number;
    completed: number;
    failed: number;
    retrying: number;
    approval_required: number;
    dead_letter: number;
    cancelled: number;
  };
  heartbeats: number;
  events: number;
  memory: number;
}
