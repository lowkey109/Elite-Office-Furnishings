import fs from "fs";
import path from "path";
import {
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

function walkJson(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", ".cache"].includes(name)) continue;

    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      walkJson(full, out);
    } else if (name.endsWith(".json") || name.endsWith(".jsonl")) {
      out.push(full);
    }
  }

  return out;
}

export function createNexoraMigrationManifest(input: any = {}) {
  const manifestId = String(input.manifestId || nexoraLocalId("migration"));
  const root = String(input.root || nexoraLocalPath());
  const files = walkJson(root);

  const manifest = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_migration_manifest",
    manifestId,
    createdAt: now(),
    root,
    fileCount: files.length,
    files: files.map((file: string) => ({
      file,
      relative: path.relative(root, file),
      size: fs.statSync(file).size,
      kind: file.endsWith(".jsonl") ? "jsonl" : "json",
    })),
    target: {
      durableStore: "postgres",
      replayMode: "dry_run_first",
      blockedUntil: "Postgres storage upgraded",
    },
    safety: {
      noDelete: true,
      noOverwrite: true,
      dryRunFirst: true,
      highRiskApprovalGated: true,
    },
  };

  const manifestFile = nexoraLocalPath("migration", `${manifestId}.json`);
  writeNexoraJson(manifestFile, manifest);

  return {
    ok: true,
    nexoraBrain: true,
    manifestFile,
    manifest,
  };
}

export function getNexoraMigrationManifest(input: any = {}) {
  const manifestId = String(input.manifestId || "");
  const file = nexoraLocalPath("migration", `${manifestId}.json`);

  return {
    ok: fs.existsSync(file),
    nexoraBrain: true,
    manifestId,
    file,
    manifest: readNexoraJson(file, null),
  };
}

export function planNexoraMigrationReplay(input: any = {}) {
  const manifest = input.manifestId
    ? getNexoraMigrationManifest({ manifestId: input.manifestId }).manifest
    : createNexoraMigrationManifest({}).manifest;

  if (!manifest) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "Migration manifest not found.",
    };
  }

  const replayPlan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_migration_replay_plan",
    replayPlanId: nexoraLocalId("replay_plan"),
    createdAt: now(),
    manifestId: manifest.manifestId,
    dryRun: true,
    batches: (manifest.files || []).map((file: any, index: number) => ({
      batch: index + 1,
      file: file.file,
      relative: file.relative,
      kind: file.kind,
      action: "inspect_then_replay",
      approvalRequired: false,
    })),
    safety: {
      dryRunFirst: true,
      noAutomaticDelete: true,
      noOverwrite: true,
      approvalGatesPreserved: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("migration", `${replayPlan.replayPlanId}.json`), replayPlan);

  return {
    ok: true,
    nexoraBrain: true,
    replayPlan,
  };
}

export function getNexoraMigrationPlannerStatus() {
  const manifest = createNexoraMigrationManifest({ manifestId: "latest" }).manifest;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_migration_planner",
    fileCount: manifest.fileCount,
    blockedUntil: manifest.target.blockedUntil,
    dryRunFirst: true,
  };
}
