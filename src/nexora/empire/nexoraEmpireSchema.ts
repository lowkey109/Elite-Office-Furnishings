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
