export type NexoraDivisionKey =
  | 'office'
  | 'fitouts'
  | 'procurement'
  | 'trading'
  | 'learning'
  | 'safety'
  | 'reporting'
  | 'crm'
  | 'strategy'
  | 'operations';

export type NexoraMessageStatus = 'queued' | 'read' | 'actioned' | 'archived';
export type NexoraDelegationStatus = 'planned' | 'active' | 'blocked' | 'completed' | 'cancelled';
export type NexoraObjectiveStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type NexoraGraphRelation =
  | 'depends_on'
  | 'reports_to'
  | 'learned_from'
  | 'serves'
  | 'blocked_by'
  | 'supplies'
  | 'improves'
  | 'escalates_to';

export interface NexoraWorkerMessageInput {
  fromWorker: string;
  toWorker: string;
  fromDivision: string;
  toDivision: string;
  subject: string;
  body: string;
  priority?: number;
  payload?: Record<string, unknown>;
}

export interface NexoraDelegationInput {
  parentWorker: string;
  childWorker: string;
  parentDivision: string;
  childDivision: string;
  mission: string;
  authorityScope: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  payload?: Record<string, unknown>;
}

export interface NexoraDivisionObjectiveInput {
  division: string;
  objective: string;
  metric: string;
  target: string;
  ownerWorker: string;
  priority?: number;
  payload?: Record<string, unknown>;
}

export interface NexoraMemoryGraphEdgeInput {
  sourceType: string;
  sourceId: string;
  relation: NexoraGraphRelation;
  targetType: string;
  targetId: string;
  weight?: number;
  payload?: Record<string, unknown>;
}
