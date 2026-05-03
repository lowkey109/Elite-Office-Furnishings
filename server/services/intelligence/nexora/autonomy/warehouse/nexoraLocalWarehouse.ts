import {
  appendNexoraJsonl,
  nexoraLocalPath,
  readNexoraJsonl,
} from "../localcore/nexoraLocalCore";

const WAREHOUSE_FILE = nexoraLocalPath("warehouse", "metrics.jsonl");

function now() {
  return new Date().toISOString();
}

export function recordNexoraMetric(input: any = {}) {
  const metric = {
    ok: true,
    nexoraBrain: true,
    name: String(input.name || "metric"),
    value: Number(input.value || 0),
    unit: String(input.unit || "count"),
    dimensions: input.dimensions || {},
    recordedAt: now(),
  };

  appendNexoraJsonl(WAREHOUSE_FILE, metric);

  return {
    ok: true,
    nexoraBrain: true,
    metric,
  };
}

export function getNexoraMetrics(input: any = {}) {
  const name = input.name ? String(input.name) : "";
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(WAREHOUSE_FILE)
    .filter((metric: any) => !name || metric.name === name)
    .slice(-limit)
    .reverse();

  const total = rows.reduce((sum: number, row: any) => sum + Number(row.value || 0), 0);

  return {
    ok: true,
    nexoraBrain: true,
    name,
    count: rows.length,
    total,
    rows,
  };
}
