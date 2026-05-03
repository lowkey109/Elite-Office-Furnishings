import fs from "fs";
import path from "path";
import { planNexoraBuildCollisionCheck } from "./nexoraBuildCollisionPlanner";

function now() {
  return new Date().toISOString();
}

function detectGitDirtyFiles() {
  try {
    const child = require("child_process");
    const out = child.execSync("git status --short", { encoding: "utf8" });
    return out
      .split("\n")
      .map((line: string) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function runNexoraBuildPreflight(input: any = {}) {
  const buildName = String(input.buildName || "unnamed_nexora_build");
  const proposedFiles = Array.isArray(input.proposedFiles) ? input.proposedFiles : [];
  const proposedFunctions = Array.isArray(input.proposedFunctions) ? input.proposedFunctions : [];
  const proposedRoutes = Array.isArray(input.proposedRoutes) ? input.proposedRoutes : [];

  const collision = planNexoraBuildCollisionCheck({
    proposedFiles,
    proposedFunctions,
    proposedRoutes,
  });

  const dirtyFiles = detectGitDirtyFiles();

  const missingParentDirs = proposedFiles
    .map((file: string) => path.dirname(file))
    .filter((dir: string) => !fs.existsSync(dir));

  const warnings: string[] = [];

  if (dirtyFiles.length) {
    warnings.push("Workspace has uncommitted/untracked changes.");
  }

  if (missingParentDirs.length) {
    warnings.push("Some proposed parent directories do not exist and will need creation.");
  }

  if (!collision.ok) {
    warnings.push("Collision planner found blockers.");
  }

  const approved = collision.ok;

  return {
    ok: approved,
    nexoraBrain: true,
    service: "nexora_build_preflight",
    generatedAt: now(),
    buildName,
    approved,
    collision,
    dirtyFiles,
    missingParentDirs,
    warnings,
    nextSteps: approved
      ? [
          "Create backups for any file touched.",
          "Use create-if-missing or append-if-missing only.",
          "Patch routes only if registrar is absent.",
          "Run npm run check before commit.",
        ]
      : [
          "Resolve collision blockers.",
          "Rename proposed modules or make an explicit extension file.",
          "Do not run overwrite builds.",
        ],
  };
}
