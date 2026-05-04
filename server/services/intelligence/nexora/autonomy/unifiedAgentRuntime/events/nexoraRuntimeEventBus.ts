import {
  appendJsonl,
  nowIso,
  runtimeId,
  runtimePath,
} from "../storage/nexoraJsonRuntimeStore";
import type { NexoraEventSeverity, NexoraRuntimeEvent } from "../types/nexoraAgentRuntimeTypes";

const EVENTS_FILE = runtimePath("events", "runtime-events.jsonl");

export async function emitNexoraRuntimeEvent(
  type: string,
  source: string,
  message: string,
  payload: Record<string, any> = {},
  severity: NexoraEventSeverity = "info",
): Promise<NexoraRuntimeEvent> {
  const event: NexoraRuntimeEvent = {
    eventId: runtimeId("event"),
    type,
    severity,
    source,
    message,
    payload,
    createdAt: nowIso(),
  };

  appendJsonl(EVENTS_FILE, {
    event,
    createdAt: nowIso(),
  });

  return event;
}

export async function logNexoraRuntime(
  source: string,
  message: string,
  payload: Record<string, any> = {},
  severity: NexoraEventSeverity = "info",
): Promise<NexoraRuntimeEvent> {
  return emitNexoraRuntimeEvent("runtime.log", source, message, payload, severity);
}

export function listNexoraRuntimeEvents(input: any = {}) {
  const { readJsonl } = require("../storage/nexoraJsonRuntimeStore");
  const limit = Number(input.limit || 100);
  const severity = input.severity ? String(input.severity) : "";

  const rows = readJsonl(EVENTS_FILE)
    .map((row: any) => row.event || row)
    .filter((event: any) => !severity || event.severity === severity)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}
