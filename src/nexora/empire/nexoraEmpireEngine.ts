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
