import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
} from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

const TRACE_LOG = nexoraLocalPath("trace", "operating-trace.jsonl");

export function recordNexoraOperatingTrace(input: any = {}) {
  const trace = {
    ok: true,
    nexoraBrain: true,
    traceId: String(input.traceId || nexoraLocalId("trace")),
    type: String(input.type || "general"),
    title: String(input.title || "Nexora operating trace"),
    severity: String(input.severity || "info"),
    payload: input.payload || {},
    createdAt: now(),
  };

  appendNexoraJsonl(TRACE_LOG, {
    event: "trace.recorded",
    trace,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    trace,
  };
}

export function listNexoraOperatingTraces(input: any = {}) {
  const limit = Number(input.limit || 100);
  const severity = input.severity ? String(input.severity) : "";

  const rows = readNexoraJsonl(TRACE_LOG)
    .filter((row: any) => row.event === "trace.recorded")
    .map((row: any) => row.trace)
    .filter((trace: any) => !severity || trace.severity === severity)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}
