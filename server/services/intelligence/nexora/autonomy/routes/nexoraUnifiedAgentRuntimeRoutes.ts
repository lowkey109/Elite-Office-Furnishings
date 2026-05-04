import {
  getNexoraUnifiedAgentRuntimeStatus,
  runNexoraAgentRuntimeTick,
  startNexoraAgentRuntimeLoop,
  stopNexoraAgentRuntimeLoop,
} from "../unifiedAgentRuntime/loops/nexoraAgentRuntimeLoop";
import {
  listNexoraAgents,
  registerNexoraAgent,
  seedNexoraCoreAgents,
} from "../unifiedAgentRuntime/registry/nexoraAgentRegistry";
import {
  createNexoraAgentTask,
  listNexoraTasks,
} from "../unifiedAgentRuntime/tasks/nexoraAgentTaskManager";
import {
  listNexoraHeartbeats,
  recordNexoraAgentHeartbeat,
} from "../unifiedAgentRuntime/heartbeat/nexoraAgentHeartbeat";
import {
  getNexoraMemory,
  searchNexoraMemory,
  setNexoraMemory,
} from "../unifiedAgentRuntime/memory/nexoraAgentMemory";
import { listNexoraRuntimeEvents } from "../unifiedAgentRuntime/events/nexoraRuntimeEventBus";

function sendError(res: any, error: unknown) {
  res.status(500).json({
    ok: false,
    nexoraBrain: true,
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerNexoraUnifiedAgentRuntimeRoutes(app: any) {
  app.get("/api/nexora/agent-runtime-v2/status", (_req: any, res: any) => {
    try { res.json(getNexoraUnifiedAgentRuntimeStatus()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/agent-runtime-v2/start", (req: any, res: any) => {
    try { res.json(startNexoraAgentRuntimeLoop(req.body || {})); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/agent-runtime-v2/stop", (_req: any, res: any) => {
    try { res.json(stopNexoraAgentRuntimeLoop()); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/agent-runtime-v2/tick", (req: any, res: any) => {
    runNexoraAgentRuntimeTick(req.body || {})
      .then((result) => res.json(result))
      .catch((error) => sendError(res, error));
  });

  app.post("/api/nexora/agent-runtime-v2/agents/seed", (_req: any, res: any) => {
    seedNexoraCoreAgents()
      .then((result) => res.json(result))
      .catch((error) => sendError(res, error));
  });

  app.post("/api/nexora/agent-runtime-v2/agents/register", (req: any, res: any) => {
    registerNexoraAgent(req.body || {})
      .then((result) => res.json(result))
      .catch((error) => sendError(res, error));
  });

  app.get("/api/nexora/agent-runtime-v2/agents", (req: any, res: any) => {
    try { res.json(listNexoraAgents({ kind: req.query?.kind || "", status: req.query?.status || "" })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/agent-runtime-v2/tasks/create", (req: any, res: any) => {
    createNexoraAgentTask(req.body || {})
      .then((result) => res.json({ ok: true, nexoraBrain: true, task: result }))
      .catch((error) => sendError(res, error));
  });

  app.get("/api/nexora/agent-runtime-v2/tasks", (req: any, res: any) => {
    try { res.json(listNexoraTasks({ status: req.query?.status || "", agentId: req.query?.agentId || "" })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/agent-runtime-v2/heartbeat", (req: any, res: any) => {
    recordNexoraAgentHeartbeat(req.body?.agentId || "unknown_agent", req.body?.status || "idle", req.body?.message || "heartbeat", req.body?.metadata || {})
      .then((result) => res.json({ ok: true, nexoraBrain: true, heartbeat: result }))
      .catch((error) => sendError(res, error));
  });

  app.get("/api/nexora/agent-runtime-v2/heartbeats", (req: any, res: any) => {
    try { res.json(listNexoraHeartbeats({ agentId: req.query?.agentId || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });

  app.post("/api/nexora/agent-runtime-v2/memory/set", (req: any, res: any) => {
    setNexoraMemory(req.body || {})
      .then((result) => res.json({ ok: true, nexoraBrain: true, memory: result }))
      .catch((error) => sendError(res, error));
  });

  app.get("/api/nexora/agent-runtime-v2/memory/get", (req: any, res: any) => {
    getNexoraMemory(String(req.query?.key || ""), (req.query?.scope as any) || "global", req.query?.ownerId ? String(req.query.ownerId) : null)
      .then((result) => res.json({ ok: Boolean(result), nexoraBrain: true, memory: result }))
      .catch((error) => sendError(res, error));
  });

  app.get("/api/nexora/agent-runtime-v2/memory/search", (req: any, res: any) => {
    try { res.json(searchNexoraMemory(req.query || {})); } catch (error) { sendError(res, error); }
  });

  app.get("/api/nexora/agent-runtime-v2/events", (req: any, res: any) => {
    try { res.json(listNexoraRuntimeEvents({ severity: req.query?.severity || "", limit: Number(req.query?.limit || 100) })); } catch (error) { sendError(res, error); }
  });
}
