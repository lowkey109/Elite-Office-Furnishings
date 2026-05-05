#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "NEXORA BUILD: MULTI-AGENT EMPIRE OPERATING MESH"
echo "============================================================"

ROOT_DIR="$(pwd)"
DOMAIN="${NEXORA_DOMAIN:-https://www.thecorporatedesk.au}"

echo "Working directory: $ROOT_DIR"
echo "Target domain: $DOMAIN"

mkdir -p src/nexora/empire
mkdir -p src/nexora/empire/routes
mkdir -p scripts

cat > src/nexora/empire/nexoraEmpireTypes.ts <<'TS'
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
TS

cat > src/nexora/empire/nexoraEmpireSchema.ts <<'TS'
import { ensureNexoraAutonomySchema, nexoraQuery } from '../autonomy/persistence/nexoraAutonomyDb';

export async function ensureNexoraEmpireSchema(): Promise<void> {
  await ensureNexoraAutonomySchema();

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_divisions (
      division_key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mandate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      owner_worker TEXT NOT NULL,
      risk_boundary TEXT NOT NULL DEFAULT 'medium',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_worker_messages (
      id TEXT PRIMARY KEY,
      from_worker TEXT NOT NULL,
      to_worker TEXT NOT NULL,
      from_division TEXT NOT NULL,
      to_division TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'queued',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_worker_messages_to_status
      ON nexora_worker_messages(to_worker, status, priority DESC, created_at ASC);
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_worker_messages_division_status
      ON nexora_worker_messages(to_division, status, priority DESC, created_at ASC);
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_delegation_tree (
      id TEXT PRIMARY KEY,
      parent_worker TEXT NOT NULL,
      child_worker TEXT NOT NULL,
      parent_division TEXT NOT NULL,
      child_division TEXT NOT NULL,
      mission TEXT NOT NULL,
      authority_scope TEXT NOT NULL,
      risk TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_delegation_parent_status
      ON nexora_delegation_tree(parent_worker, status);
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_delegation_child_status
      ON nexora_delegation_tree(child_worker, status);
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_division_objectives (
      id TEXT PRIMARY KEY,
      division TEXT NOT NULL,
      objective TEXT NOT NULL,
      metric TEXT NOT NULL,
      target TEXT NOT NULL,
      owner_worker TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'active',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_division_objectives_status
      ON nexora_division_objectives(division, status, priority DESC);
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_memory_graph_edges (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      relation TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      weight NUMERIC NOT NULL DEFAULT 1,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_memory_graph_source
      ON nexora_memory_graph_edges(source_type, source_id, relation);
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_memory_graph_target
      ON nexora_memory_graph_edges(target_type, target_id, relation);
  `);

  await nexoraQuery(`
    CREATE TABLE IF NOT EXISTS nexora_strategy_cycles (
      id TEXT PRIMARY KEY,
      cycle_name TEXT NOT NULL,
      objective TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      priority INTEGER NOT NULL DEFAULT 50,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await nexoraQuery(`
    CREATE INDEX IF NOT EXISTS idx_nexora_strategy_cycles_status_priority
      ON nexora_strategy_cycles(status, priority DESC, created_at ASC);
  `);
}
TS

cat > src/nexora/empire/nexoraEmpireEngine.ts <<'TS'
import { nexoraId, nexoraQuery } from '../autonomy/persistence/nexoraAutonomyDb';
import {
  createNexoraDurableTask,
  heartbeatNexoraWorker,
  writeNexoraMemory,
  writeNexoraReport,
} from '../autonomy/persistence/nexoraDurableAutonomyStore';
import { ensureNexoraEmpireSchema } from './nexoraEmpireSchema';
import {
  NexoraDelegationInput,
  NexoraDivisionObjectiveInput,
  NexoraMemoryGraphEdgeInput,
  NexoraWorkerMessageInput,
} from './nexoraEmpireTypes';

export async function seedNexoraEmpireDivisions(): Promise<Record<string, unknown>> {
  await ensureNexoraEmpireSchema();

  const divisions = [
    {
      division: 'office',
      title: 'Office Furniture Sales',
      mandate: 'Capture, qualify, quote, and follow up office furniture opportunities.',
      ownerWorker: 'office.receptionist',
      riskBoundary: 'medium',
      capabilities: ['lead_capture', 'quote_pathing', 'followups'],
    },
    {
      division: 'fitouts',
      title: 'Fitout Operations',
      mandate: 'Scope fitout requirements, identify project risks, and support install planning.',
      ownerWorker: 'fitouts.scope-worker',
      riskBoundary: 'high',
      capabilities: ['scope_capture', 'site_constraints', 'project_plan'],
    },
    {
      division: 'procurement',
      title: 'Procurement Intelligence',
      mandate: 'Scout supplier pricing, stock, lead times, alternatives, and cost risk.',
      ownerWorker: 'office.procurement-scout',
      riskBoundary: 'high',
      capabilities: ['supplier_scan', 'cost_compare', 'availability'],
    },
    {
      division: 'trading',
      title: 'Phantom X Paper Trading Intelligence',
      mandate: 'Run paper/sandbox trading intelligence and risk observation only.',
      ownerWorker: 'trading.phantom-x.paper',
      riskBoundary: 'critical',
      capabilities: ['paper_signal_review', 'risk_scan', 'market_memory'],
    },
    {
      division: 'learning',
      title: 'Learning and Worker Improvement',
      mandate: 'Capture lessons, retrain workers, and evolve safe execution patterns.',
      ownerWorker: 'learning.curriculum-worker',
      riskBoundary: 'medium',
      capabilities: ['training', 'pattern_capture', 'feedback_loop'],
    },
    {
      division: 'safety',
      title: 'Execution Gate and Safety',
      mandate: 'Gate high-risk work, approval holds, policy enforcement, and retirement reviews.',
      ownerWorker: 'safety.execution-gate',
      riskBoundary: 'critical',
      capabilities: ['risk_gate', 'approval_hold', 'policy'],
    },
    {
      division: 'reporting',
      title: 'Command Centre Reporting',
      mandate: 'Summarise system state, recommendations, worker health, and next actions.',
      ownerWorker: 'reporting.command-centre',
      riskBoundary: 'medium',
      capabilities: ['snapshot', 'reporting', 'recommendations'],
    },
    {
      division: 'crm',
      title: 'CRM Operations',
      mandate: 'Create CRM actions, track customer follow-up states, and surface sales pipeline tasks.',
      ownerWorker: 'crm.pipeline-worker',
      riskBoundary: 'medium',
      capabilities: ['crm_task', 'pipeline_state', 'customer_next_action'],
    },
    {
      division: 'strategy',
      title: 'Strategic Planning',
      mandate: 'Plan cross-division objectives, experiments, and growth strategy under Nexora authority.',
      ownerWorker: 'strategy.planning-engine',
      riskBoundary: 'high',
      capabilities: ['strategy_cycle', 'objective_planning', 'experiment_design'],
    },
    {
      division: 'operations',
      title: 'Operations Control',
      mandate: 'Coordinate recurring loops, dead worker recovery, escalation, and operating cadence.',
      ownerWorker: 'operations.loop-controller',
      riskBoundary: 'high',
      capabilities: ['loop_control', 'recovery', 'coordination'],
    },
  ];

  for (const division of divisions) {
    await nexoraQuery(
      `
        INSERT INTO nexora_divisions (
          division_key, title, mandate, owner_worker, risk_boundary, metadata, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,now())
        ON CONFLICT (division_key)
        DO UPDATE SET
          title = EXCLUDED.title,
          mandate = EXCLUDED.mandate,
          owner_worker = EXCLUDED.owner_worker,
          risk_boundary = EXCLUDED.risk_boundary,
          metadata = EXCLUDED.metadata,
          updated_at = now()
      `,
      [
        division.division,
        division.title,
        division.mandate,
        division.ownerWorker,
        division.riskBoundary,
        JSON.stringify({
          capabilities: division.capabilities,
          nexoraBrain: true,
        }),
      ],
    );

    await heartbeatNexoraWorker({
      workerKey: division.ownerWorker,
      division: division.division,
      status: 'idle',
      capabilities: division.capabilities,
      metadata: {
        divisionOwner: true,
        seededBy: 'nexora.empire.build',
      },
    });
  }

  await writeNexoraMemory('empire.divisions.seeded', 'nexora-divisions', 90, {
    divisions: divisions.map((division) => division.division),
    count: divisions.length,
  });

  return {
    ok: true,
    nexoraBrain: true,
    seededDivisions: divisions.length,
    divisions,
  };
}

export async function createNexoraWorkerMessage(input: NexoraWorkerMessageInput): Promise<Record<string, unknown>> {
  await ensureNexoraEmpireSchema();

  const id = nexoraId('msg');

  await nexoraQuery(
    `
      INSERT INTO nexora_worker_messages (
        id, from_worker, to_worker, from_division, to_division, subject, body, priority, payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
    `,
    [
      id,
      input.fromWorker,
      input.toWorker,
      input.fromDivision,
      input.toDivision,
      input.subject,
      input.body,
      input.priority ?? 50,
      JSON.stringify(input.payload || {}),
    ],
  );

  await writeNexoraMemory('empire.worker.message', `${input.fromWorker}->${input.toWorker}`, input.priority ?? 50, {
    messageId: id,
    ...input,
  });

  await createNexoraDurableTask({
    workerKey: input.toWorker,
    division: input.toDivision,
    kind: 'worker_message_review',
    risk: 'low',
    priority: input.priority ?? 50,
    payload: {
      messageId: id,
      fromWorker: input.fromWorker,
      subject: input.subject,
      body: input.body,
      payload: input.payload || {},
    },
    approvalRequired: false,
    source: 'nexora.empire.worker.message',
  });

  return {
    ok: true,
    messageId: id,
    status: 'queued',
    nexoraBrain: true,
  };
}

export async function actionNexoraWorkerMessage(messageId: string, action = 'actioned'): Promise<Record<string, unknown>> {
  await ensureNexoraEmpireSchema();

  await nexoraQuery(
    `
      UPDATE nexora_worker_messages
      SET status = $2, updated_at = now()
      WHERE id = $1
    `,
    [messageId, action],
  );

  return {
    ok: true,
    messageId,
    status: action,
  };
}

export async function createNexoraDelegation(input: NexoraDelegationInput): Promise<Record<string, unknown>> {
  await ensureNexoraEmpireSchema();

  const id = nexoraId('delegation');
  const approvalRequired = input.risk === 'high' || input.risk === 'critical';

  await nexoraQuery(
    `
      INSERT INTO nexora_delegation_tree (
        id, parent_worker, child_worker, parent_division, child_division,
        mission, authority_scope, risk, status, payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
    `,
    [
      id,
      input.parentWorker,
      input.childWorker,
      input.parentDivision,
      input.childDivision,
      input.mission,
      input.authorityScope,
      input.risk,
      approvalRequired ? 'planned' : 'active',
      JSON.stringify(input.payload || {}),
    ],
  );

  await createMemoryGraphEdge({
    sourceType: 'worker',
    sourceId: input.childWorker,
    relation: 'reports_to',
    targetType: 'worker',
    targetId: input.parentWorker,
    weight: 1,
    payload: {
      delegationId: id,
      mission: input.mission,
    },
  });

  await createNexoraDurableTask({
    workerKey: approvalRequired ? 'safety.execution-gate' : input.childWorker,
    division: approvalRequired ? 'safety' : input.childDivision,
    kind: approvalRequired ? 'delegation_approval_review' : 'delegated_mission_start',
    risk: input.risk,
    priority: approvalRequired ? 90 : 70,
    payload: {
      delegationId: id,
      ...input,
      approvalRequired,
    },
    approvalRequired,
    source: 'nexora.empire.delegation',
  });

  await writeNexoraReport(
    'empire.delegation',
    approvalRequired ? 'warning' : 'info',
    'Nexora delegation created',
    `Delegation ${id} created from ${input.parentWorker} to ${input.childWorker}.`,
    {
      delegationId: id,
      approvalRequired,
      input,
    },
  );

  return {
    ok: true,
    nexoraBrain: true,
    delegationId: id,
    approvalRequired,
    status: approvalRequired ? 'planned' : 'active',
  };
}

export async function createDivisionObjective(input: NexoraDivisionObjectiveInput): Promise<Record<string, unknown>> {
  await ensureNexoraEmpireSchema();

  const id = nexoraId('objective');

  await nexoraQuery(
    `
      INSERT INTO nexora_division_objectives (
        id, division, objective, metric, target, owner_worker, priority, payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    `,
    [
      id,
      input.division,
      input.objective,
      input.metric,
      input.target,
      input.ownerWorker,
      input.priority ?? 50,
      JSON.stringify(input.payload || {}),
    ],
  );

  await createMemoryGraphEdge({
    sourceType: 'division',
    sourceId: input.division,
    relation: 'serves',
    targetType: 'objective',
    targetId: id,
    weight: (input.priority ?? 50) / 50,
    payload: {
      objective: input.objective,
      metric: input.metric,
      target: input.target,
    },
  });

  await createNexoraDurableTask({
    workerKey: input.ownerWorker,
    division: input.division,
    kind: 'division_objective_execution_plan',
    risk: 'medium',
    priority: input.priority ?? 50,
    payload: {
      objectiveId: id,
      ...input,
    },
    approvalRequired: false,
    source: 'nexora.empire.objective',
  });

  return {
    ok: true,
    nexoraBrain: true,
    objectiveId: id,
    status: 'active',
  };
}

export async function createMemoryGraphEdge(input: NexoraMemoryGraphEdgeInput): Promise<Record<string, unknown>> {
  await ensureNexoraEmpireSchema();

  const id = nexoraId('edge');

  await nexoraQuery(
    `
      INSERT INTO nexora_memory_graph_edges (
        id, source_type, source_id, relation, target_type, target_id, weight, payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    `,
    [
      id,
      input.sourceType,
      input.sourceId,
      input.relation,
      input.targetType,
      input.targetId,
      input.weight ?? 1,
      JSON.stringify(input.payload || {}),
    ],
  );

  return {
    ok: true,
    edgeId: id,
    nexoraBrain: true,
  };
}

export async function createStrategicPlanningCycle(input: {
  cycleName?: string;
  objective?: string;
  priority?: number;
  payload?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  await ensureNexoraEmpireSchema();

  const id = nexoraId('strategycycle');

  const cycleName = input.cycleName || 'Nexora cross-division growth cycle';
  const objective = input.objective || 'Coordinate office, fitout, procurement, CRM, learning, safety, reporting, and paper trading intelligence under one Nexora brain.';

  await nexoraQuery(
    `
      INSERT INTO nexora_strategy_cycles (
        id, cycle_name, objective, status, priority, payload
      )
      VALUES ($1,$2,$3,'planned',$4,$5::jsonb)
    `,
    [
      id,
      cycleName,
      objective,
      input.priority ?? 75,
      JSON.stringify(input.payload || {}),
    ],
  );

  const objectives = [
    {
      division: 'office',
      objective: 'Increase qualified office furniture leads converted into quote drafts.',
      metric: 'qualified_quote_drafts_per_week',
      target: 'increase safely while preserving margin thresholds',
      ownerWorker: 'office.receptionist',
      priority: 80,
    },
    {
      division: 'fitouts',
      objective: 'Improve fitout scope completeness before quote approval.',
      metric: 'scope_completeness_score',
      target: 'capture site, access, timing, install, and risk constraints',
      ownerWorker: 'fitouts.scope-worker',
      priority: 78,
    },
    {
      division: 'procurement',
      objective: 'Reduce supplier uncertainty before customer-facing quote release.',
      metric: 'supplier_confirmation_rate',
      target: 'confirm cost, stock, lead time, warranty, and delivery risk',
      ownerWorker: 'office.procurement-scout',
      priority: 76,
    },
    {
      division: 'crm',
      objective: 'Improve lead follow-up discipline and next-action visibility.',
      metric: 'open_leads_with_next_action',
      target: 'every open lead has next action and owner',
      ownerWorker: 'crm.pipeline-worker',
      priority: 74,
    },
    {
      division: 'learning',
      objective: 'Turn completed work into worker training patterns.',
      metric: 'lessons_captured_per_cycle',
      target: 'capture successful quote, procurement, and follow-up patterns',
      ownerWorker: 'learning.curriculum-worker',
      priority: 70,
    },
    {
      division: 'safety',
      objective: 'Keep high-risk commitments approval-gated.',
      metric: 'high_risk_tasks_without_approval',
      target: 'zero',
      ownerWorker: 'safety.execution-gate',
      priority: 95,
    },
    {
      division: 'reporting',
      objective: 'Produce command-centre summary after each empire cycle.',
      metric: 'cycle_reports_generated',
      target: 'one report per cycle',
      ownerWorker: 'reporting.command-centre',
      priority: 72,
    },
  ];

  const createdObjectives = [];

  for (const objectiveItem of objectives) {
    createdObjectives.push(await createDivisionObjective({
      ...objectiveItem,
      payload: {
        strategyCycleId: id,
      },
    }));
  }

  await createNexoraDurableTask({
    workerKey: 'strategy.planning-engine',
    division: 'strategy',
    kind: 'strategy_cycle_coordinate',
    risk: 'medium',
    priority: input.priority ?? 75,
    payload: {
      strategyCycleId: id,
      cycleName,
      objective,
      createdObjectives,
    },
    approvalRequired: false,
    source: 'nexora.empire.strategy.cycle',
  });

  await writeNexoraMemory('empire.strategy.cycle.created', id, 92, {
    strategyCycleId: id,
    cycleName,
    objective,
    objectiveCount: createdObjectives.length,
  });

  await writeNexoraReport(
    'empire.strategy',
    'info',
    'Nexora strategic planning cycle created',
    `Strategy cycle ${id} created with ${createdObjectives.length} division objectives.`,
    {
      strategyCycleId: id,
      cycleName,
      objective,
      createdObjectives,
    },
  );

  return {
    ok: true,
    nexoraBrain: true,
    strategyCycleId: id,
    createdObjectives,
  };
}

export async function runNexoraEmpireOperatingCycle(): Promise<Record<string, unknown>> {
  await ensureNexoraEmpireSchema();

  const cycleId = nexoraId('empirecycle');

  await seedNexoraEmpireDivisions();

  const strategy = await createStrategicPlanningCycle({
    cycleName: 'Nexora empire operating cycle',
    objective: 'Coordinate the business operating system across office, fitouts, procurement, CRM, safety, learning, reporting, and paper trading intelligence.',
    priority: 82,
    payload: {
      cycleId,
      generatedBy: 'nexora.empire.operating.cycle',
    },
  });

  const messages = [];

  messages.push(await createNexoraWorkerMessage({
    fromWorker: 'strategy.planning-engine',
    toWorker: 'office.receptionist',
    fromDivision: 'strategy',
    toDivision: 'office',
    subject: 'Prioritise qualified quote-ready leads',
    body: 'Identify leads with confirmed need, budget, location, and timeline. Push quote-ready leads to quote builder.',
    priority: 82,
    payload: { cycleId },
  }));

  messages.push(await createNexoraWorkerMessage({
    fromWorker: 'office.receptionist',
    toWorker: 'office.procurement-scout',
    fromDivision: 'office',
    toDivision: 'procurement',
    subject: 'Prepare supplier confirmation path',
    body: 'For quote-ready leads, collect supplier stock, lead time, target cost, delivery, and warranty signals.',
    priority: 78,
    payload: { cycleId },
  }));

  messages.push(await createNexoraWorkerMessage({
    fromWorker: 'office.procurement-scout',
    toWorker: 'safety.execution-gate',
    fromDivision: 'procurement',
    toDivision: 'safety',
    subject: 'Escalate high-value procurement commitments',
    body: 'Any supplier commitment above threshold or with contractual risk must remain approval-gated.',
    priority: 92,
    payload: { cycleId },
  }));

  messages.push(await createNexoraWorkerMessage({
    fromWorker: 'reporting.command-centre',
    toWorker: 'learning.curriculum-worker',
    fromDivision: 'reporting',
    toDivision: 'learning',
    subject: 'Capture cycle lessons',
    body: 'Review completed tasks and worker scores. Convert successful patterns into training memory.',
    priority: 70,
    payload: { cycleId },
  }));

  const delegations = [];

  delegations.push(await createNexoraDelegation({
    parentWorker: 'strategy.planning-engine',
    childWorker: 'office.receptionist',
    parentDivision: 'strategy',
    childDivision: 'office',
    mission: 'Qualify and advance office furniture leads to quote-ready state.',
    authorityScope: 'Can create low-risk follow-up and qualification tasks. Cannot issue binding customer commitments.',
    risk: 'medium',
    payload: { cycleId },
  }));

  delegations.push(await createNexoraDelegation({
    parentWorker: 'strategy.planning-engine',
    childWorker: 'office.procurement-scout',
    parentDivision: 'strategy',
    childDivision: 'procurement',
    mission: 'Validate supplier availability and target pricing for active quote paths.',
    authorityScope: 'Can request supplier information. Cannot place purchase orders without approval.',
    risk: 'high',
    payload: { cycleId },
  }));

  delegations.push(await createNexoraDelegation({
    parentWorker: 'strategy.planning-engine',
    childWorker: 'trading.phantom-x.paper',
    parentDivision: 'strategy',
    childDivision: 'trading',
    mission: 'Continue paper/sandbox trading intelligence and report risk observations only.',
    authorityScope: 'Paper/sandbox intelligence only. No live trading authority.',
    risk: 'critical',
    payload: { cycleId, tradingMode: 'paper/sandbox' },
  }));

  await writeNexoraReport(
    'empire.cycle',
    'info',
    'Nexora empire operating cycle created',
    `Empire cycle ${cycleId} created with strategy, messages, and delegations under one Nexora brain.`,
    {
      cycleId,
      strategy,
      messages,
      delegations,
    },
  );

  return {
    ok: true,
    nexoraBrain: true,
    cycleId,
    strategy,
    messages,
    delegations,
    safety: {
      highRiskApprovalGated: true,
      tradingMode: 'paper/sandbox',
      singleBrain: 'Nexora',
    },
  };
}

export async function getNexoraEmpireSnapshot(): Promise<Record<string, unknown>> {
  await ensureNexoraEmpireSchema();

  const [
    divisions,
    messages,
    delegations,
    objectives,
    graphEdges,
    strategyCycles,
  ] = await Promise.all([
    nexoraQuery(`
      SELECT division_key, title, mandate, status, owner_worker, risk_boundary, metadata, updated_at
      FROM nexora_divisions
      ORDER BY division_key
    `),
    nexoraQuery(`
      SELECT status, count(*)::int AS count
      FROM nexora_worker_messages
      GROUP BY status
      ORDER BY status
    `),
    nexoraQuery(`
      SELECT status, risk, count(*)::int AS count
      FROM nexora_delegation_tree
      GROUP BY status, risk
      ORDER BY status, risk
    `),
    nexoraQuery(`
      SELECT division, status, count(*)::int AS count
      FROM nexora_division_objectives
      GROUP BY division, status
      ORDER BY division, status
    `),
    nexoraQuery(`
      SELECT relation, count(*)::int AS count
      FROM nexora_memory_graph_edges
      GROUP BY relation
      ORDER BY relation
    `),
    nexoraQuery(`
      SELECT id, cycle_name, objective, status, priority, created_at
      FROM nexora_strategy_cycles
      ORDER BY created_at DESC
      LIMIT 10
    `),
  ]);

  return {
    ok: true,
    nexoraBrain: true,
    generatedAt: new Date().toISOString(),
    divisions: divisions.rows,
    messageSummary: messages.rows,
    delegationSummary: delegations.rows,
    objectiveSummary: objectives.rows,
    memoryGraphSummary: graphEdges.rows,
    recentStrategyCycles: strategyCycles.rows,
    nextActions: [
      'Run empire operating cycle daily or on demand.',
      'Use division objectives to drive durable task creation.',
      'Keep high-risk procurement, worker spawning, retirement, and trading promotion approval-gated.',
      'Let learning worker convert successful cycles into operating memory.',
      'Use memory graph to detect bottlenecks, dependencies, and recurring blockers.',
    ],
  };
}
TS

cat > src/nexora/empire/routes/nexoraEmpireRoutes.ts <<'TS'
import {
  actionNexoraWorkerMessage,
  createDivisionObjective,
  createMemoryGraphEdge,
  createNexoraDelegation,
  createNexoraWorkerMessage,
  createStrategicPlanningCycle,
  getNexoraEmpireSnapshot,
  runNexoraEmpireOperatingCycle,
  seedNexoraEmpireDivisions,
} from '../nexoraEmpireEngine';

export function registerNexoraEmpireRoutes(app: any): void {
  app.get('/api/nexora/empire/status', async (_req: any, res: any) => {
    try {
      const snapshot = await getNexoraEmpireSnapshot();
      res.json(snapshot);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/seed', async (_req: any, res: any) => {
    try {
      const result = await seedNexoraEmpireDivisions();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/cycle/run', async (_req: any, res: any) => {
    try {
      const result = await runNexoraEmpireOperatingCycle();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/messages', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await createNexoraWorkerMessage({
        fromWorker: String(body.fromWorker || 'reporting.command-centre'),
        toWorker: String(body.toWorker || 'office.receptionist'),
        fromDivision: String(body.fromDivision || 'reporting'),
        toDivision: String(body.toDivision || 'office'),
        subject: String(body.subject || 'Nexora worker message'),
        body: String(body.body || 'Review this message and create next action if required.'),
        priority: Number(body.priority || 50),
        payload: body.payload || {},
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/messages/:messageId/action', async (req: any, res: any) => {
    try {
      const result = await actionNexoraWorkerMessage(
        req.params.messageId,
        req.body?.status || 'actioned',
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/delegations', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await createNexoraDelegation({
        parentWorker: String(body.parentWorker || 'strategy.planning-engine'),
        childWorker: String(body.childWorker || 'office.receptionist'),
        parentDivision: String(body.parentDivision || 'strategy'),
        childDivision: String(body.childDivision || 'office'),
        mission: String(body.mission || 'Execute delegated Nexora mission.'),
        authorityScope: String(body.authorityScope || 'Low-risk planning only. No binding commitments.'),
        risk: body.risk || 'medium',
        payload: body.payload || {},
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/objectives', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await createDivisionObjective({
        division: String(body.division || 'office'),
        objective: String(body.objective || 'Improve office furniture lead handling.'),
        metric: String(body.metric || 'qualified_leads'),
        target: String(body.target || 'increase safely'),
        ownerWorker: String(body.ownerWorker || 'office.receptionist'),
        priority: Number(body.priority || 50),
        payload: body.payload || {},
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/memory-graph/edges', async (req: any, res: any) => {
    try {
      const body = req.body || {};
      const result = await createMemoryGraphEdge({
        sourceType: String(body.sourceType || 'worker'),
        sourceId: String(body.sourceId || 'office.receptionist'),
        relation: body.relation || 'serves',
        targetType: String(body.targetType || 'division'),
        targetId: String(body.targetId || 'office'),
        weight: Number(body.weight || 1),
        payload: body.payload || {},
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/nexora/empire/strategy/cycles', async (req: any, res: any) => {
    try {
      const result = await createStrategicPlanningCycle(req.body || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
TS

cat > scripts/patch-nexora-empire-routes.cjs <<'JS'
const fs = require('fs');
const path = require('path');

const candidates = [
  'src/server.ts',
  'src/index.ts',
  'src/app.ts',
  'server.ts',
  'index.ts',
  'app.ts',
  'backend/src/server.ts',
  'backend/src/index.ts',
  'backend/src/app.ts',
];

function findFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) findFiles(full, out);
    else if (/\.(ts|tsx|js)$/.test(name)) out.push(full);
  }
  return out;
}

const files = [
  ...candidates.filter((file) => fs.existsSync(file)),
  ...findFiles('src'),
];

const target = files.find((file) => {
  const text = fs.readFileSync(file, 'utf8');
  return (
    text.includes('express(') &&
    (
      text.includes('app.listen') ||
      text.includes('createServer') ||
      text.includes('module.exports = app') ||
      text.includes('export default app')
    )
  );
});

if (!target) {
  console.error('Could not locate Express app entrypoint to patch.');
  process.exit(1);
}

let text = fs.readFileSync(target, 'utf8');

const symbol = 'registerNexoraEmpireRoutes';

if (!text.includes(symbol)) {
  const targetFile = 'src/nexora/empire/routes/nexoraEmpireRoutes';
  const fromTargetDir = path.relative(path.dirname(target), targetFile).replace(/\\/g, '/');
  const importPath = fromTargetDir.startsWith('.') ? fromTargetDir : `./${fromTargetDir}`;
  const importLine = `import { ${symbol} } from '${importPath}';\n`;

  if (/^import\s/m.test(text)) {
    text = text.replace(/^(import[\s\S]*?;\n)(?!import)/m, `$1${importLine}`);
  } else {
    text = `${importLine}${text}`;
  }
}

const registration = 'registerNexoraEmpireRoutes(app);';

if (!text.includes(registration)) {
  const appPatterns = [
    /const\s+app\s*=\s*express\s*\(\s*\)\s*;?/,
    /let\s+app\s*=\s*express\s*\(\s*\)\s*;?/,
    /var\s+app\s*=\s*express\s*\(\s*\)\s*;?/,
  ];

  let patched = false;

  for (const pattern of appPatterns) {
    if (pattern.test(text)) {
      text = text.replace(pattern, (match) => `${match}\n${registration}`);
      patched = true;
      break;
    }
  }

  if (!patched) {
    const listenIndex = text.indexOf('app.listen');
    if (listenIndex !== -1) {
      text = `${text.slice(0, listenIndex)}${registration}\n${text.slice(listenIndex)}`;
      patched = true;
    }
  }

  if (!patched) {
    console.error(`Found candidate ${target}, but could not patch app registration safely.`);
    process.exit(1);
  }
}

fs.writeFileSync(target, text);
console.log(`Patched Nexora empire routes into ${target}`);
JS

node scripts/patch-nexora-empire-routes.cjs

echo "Running TypeScript/build checks..."
npm run check

echo "Committing build..."
git add src scripts build-nexora-multi-agent-empire.sh
git commit -m "Add Nexora multi-agent empire operating mesh" || echo "Nothing new to commit."

echo "Deploying to Railway..."
railway deploy

echo "Waiting briefly before curl verification..."
sleep 12

echo "Running deployed curl tests..."
set +e

curl -fsS -X POST "$DOMAIN/api/nexora/empire/seed" \
  -H "Content-Type: application/json" \
  -d '{}' | tee /tmp/nexora_empire_seed.json
STATUS_1=$?

echo ""
curl -fsS -X POST "$DOMAIN/api/nexora/empire/cycle/run" \
  -H "Content-Type: application/json" \
  -d '{}' | tee /tmp/nexora_empire_cycle.json
STATUS_2=$?

echo ""
curl -fsS -X POST "$DOMAIN/api/nexora/empire/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "fromWorker":"reporting.command-centre",
    "toWorker":"office.receptionist",
    "fromDivision":"reporting",
    "toDivision":"office",
    "subject":"Terminal test lead handling",
    "body":"Prepare the next safe qualification step for a furniture and fitout lead.",
    "priority":75,
    "payload":{
      "source":"post-deploy curl test",
      "nexoraBrain":true
    }
  }' | tee /tmp/nexora_empire_message.json
STATUS_3=$?

echo ""
curl -fsS -X POST "$DOMAIN/api/nexora/empire/delegations" \
  -H "Content-Type: application/json" \
  -d '{
    "parentWorker":"strategy.planning-engine",
    "childWorker":"office.procurement-scout",
    "parentDivision":"strategy",
    "childDivision":"procurement",
    "mission":"Validate supplier options for quote-ready office furniture leads.",
    "authorityScope":"Information gathering only. No purchase order or binding supplier commitment.",
    "risk":"high",
    "payload":{
      "test":"post-deploy delegation approval gate"
    }
  }' | tee /tmp/nexora_empire_delegation.json
STATUS_4=$?

echo ""
curl -fsS -X POST "$DOMAIN/api/nexora/empire/objectives" \
  -H "Content-Type: application/json" \
  -d '{
    "division":"fitouts",
    "objective":"Improve fitout scope quality before quote release",
    "metric":"scope_completeness_score",
    "target":"capture site, access, installation, timeline, and risk details",
    "ownerWorker":"fitouts.scope-worker",
    "priority":82,
    "payload":{
      "source":"post-deploy curl test"
    }
  }' | tee /tmp/nexora_empire_objective.json
STATUS_5=$?

echo ""
curl -fsS -X POST "$DOMAIN/api/nexora/empire/memory-graph/edges" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType":"division",
    "sourceId":"procurement",
    "relation":"supplies",
    "targetType":"division",
    "targetId":"office",
    "weight":1.4,
    "payload":{
      "reason":"Procurement confirmation improves quote reliability."
    }
  }' | tee /tmp/nexora_empire_graph_edge.json
STATUS_6=$?

echo ""
curl -fsS "$DOMAIN/api/nexora/empire/status" | tee /tmp/nexora_empire_status.json
STATUS_7=$?

echo ""
curl -fsS "$DOMAIN/api/nexora/autonomy/persistence/snapshot" | tee /tmp/nexora_empire_durable_snapshot.json
STATUS_8=$?

set -e

echo ""
echo "Curl status codes:"
echo "empire seed:         $STATUS_1"
echo "empire cycle:        $STATUS_2"
echo "worker message:      $STATUS_3"
echo "delegation:          $STATUS_4"
echo "objective:           $STATUS_5"
echo "memory graph edge:   $STATUS_6"
echo "empire status:       $STATUS_7"
echo "durable snapshot:    $STATUS_8"

if [ "$STATUS_1" -ne 0 ] || [ "$STATUS_2" -ne 0 ] || [ "$STATUS_3" -ne 0 ] || [ "$STATUS_4" -ne 0 ] || [ "$STATUS_5" -ne 0 ] || [ "$STATUS_6" -ne 0 ] || [ "$STATUS_7" -ne 0 ] || [ "$STATUS_8" -ne 0 ]; then
  echo "One or more deployed curl tests failed."
  exit 1
fi

echo "============================================================"
echo "NEXORA MULTI-AGENT EMPIRE BUILD COMPLETE"
echo "============================================================"
