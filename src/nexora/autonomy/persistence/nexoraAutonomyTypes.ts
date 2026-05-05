export type NexoraAutonomyRisk = 'low' | 'medium' | 'high' | 'critical';
export type NexoraTaskStatus =
  | 'queued'
  | 'approval_required'
  | 'running'
  | 'completed'
  | 'failed'
  | 'dead'
  | 'cancelled'
  | 'timeout';

export type NexoraApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type NexoraWorkerStatus = 'online' | 'idle' | 'busy' | 'degraded' | 'dead' | 'retired';

export interface NexoraDurableTaskInput {
  workerKey: string;
  division: string;
  kind: string;
  risk: NexoraAutonomyRisk;
  priority?: number;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  scheduledAt?: string;
  approvalRequired?: boolean;
  source?: string;
}

export interface NexoraDurableTask {
  id: string;
  queueName: string;
  workerKey: string;
  division: string;
  kind: string;
  risk: NexoraAutonomyRisk;
  priority: number;
  status: NexoraTaskStatus;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  lockedUntil?: string | null;
  approvalRequired: boolean;
  approvalId?: string | null;
  source: string;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NexoraWorkerHeartbeatInput {
  workerKey: string;
  division: string;
  status?: NexoraWorkerStatus;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface NexoraWorkerScoreInput {
  workerKey: string;
  division: string;
  taskId?: string;
  success: boolean;
  durationMs?: number;
  risk?: NexoraAutonomyRisk;
  signal?: string;
  weight?: number;
}
