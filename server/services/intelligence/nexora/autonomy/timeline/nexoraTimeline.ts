import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
} from "../localcore/nexoraLocalCore";

const TIMELINE_FILE = nexoraLocalPath("timeline", "events.jsonl");

function now() {
  return new Date().toISOString();
}

export function recordNexoraTimelineEvent(input: any = {}) {
  const event = {
    ok: true,
    nexoraBrain: true,
    id: String(input.id || nexoraLocalId("event")),
    type: String(input.type || "general"),
    title: String(input.title || "Nexora timeline event"),
    severity: String(input.severity || "info"),
    payload: input.payload || {},
    createdAt: now(),
  };

  appendNexoraJsonl(TIMELINE_FILE, event);

  return {
    ok: true,
    nexoraBrain: true,
    event,
  };
}

export function getNexoraTimeline(input: any = {}) {
  const limit = Number(input.limit || 50);
  const rows = readNexoraJsonl(TIMELINE_FILE).slice(-limit).reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}
