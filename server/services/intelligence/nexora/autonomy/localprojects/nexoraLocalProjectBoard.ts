import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

const PROJECT_LOG = nexoraLocalPath("projects", "project-log.jsonl");

function projectFile(id: string) {
  return nexoraLocalPath("projects", `${id}.json`);
}

export function createNexoraLocalProject(input: any = {}) {
  const projectId = String(input.projectId || nexoraLocalId("project"));

  const project = {
    ok: true,
    nexoraBrain: true,
    projectId,
    leadId: input.leadId || null,
    quoteId: input.quoteId || null,
    name: String(input.name || "Office furniture / fitout project"),
    status: String(input.status || "planned"),
    risk: String(input.risk || "medium"),
    stages: Array.isArray(input.stages) ? input.stages : [
      { name: "Qualification", status: "planned" },
      { name: "Scope", status: "planned" },
      { name: "Quote", status: "planned" },
      { name: "Supplier confirmation", status: "planned" },
      { name: "Approval gate", status: "planned" },
      { name: "Delivery / install", status: "planned" },
      { name: "Handover", status: "planned" },
    ],
    createdAt: now(),
    updatedAt: now(),
  };

  writeNexoraJson(projectFile(projectId), project);
  appendNexoraJsonl(PROJECT_LOG, {
    event: "project.created",
    project,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    project,
  };
}

export function updateNexoraLocalProjectStage(input: any = {}) {
  const projectId = String(input.projectId || "");
  const project = readNexoraJson(projectFile(projectId), null);

  if (!project) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "Project not found.",
      projectId,
    };
  }

  const stageName = String(input.stage || "");
  const status = String(input.status || "completed");

  project.stages = (project.stages || []).map((stage: any) =>
    stage.name === stageName ? { ...stage, status, updatedAt: now() } : stage,
  );

  project.updatedAt = now();

  writeNexoraJson(projectFile(projectId), project);
  appendNexoraJsonl(PROJECT_LOG, {
    event: "project.stage_updated",
    projectId,
    stageName,
    status,
    project,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    project,
  };
}

export function listNexoraLocalProjects(input: any = {}) {
  const limit = Number(input.limit || 100);

  const rows = readNexoraJsonl(PROJECT_LOG)
    .filter((row: any) => row.event === "project.created")
    .map((row: any) => row.project)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraLocalProjectStatus() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_project_board",
    totalProjects: listNexoraLocalProjects({ limit: 1000 }).count,
  };
}
