import fs from "fs";
import path from "path";
import {
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { createNexoraMigrationManifest } from "../migration/nexoraMigrationPlanner";
import { validateNexoraLocalData } from "../validation/nexoraLocalDataValidator";

function now() {
  return new Date().toISOString();
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }

  return out;
}

export function createNexoraMigrationPack(input: any = {}) {
  const packId = String(input.packId || nexoraLocalId("migration_pack"));
  const root = nexoraLocalPath();
  const manifest = createNexoraMigrationManifest({
    manifestId: `${packId}_manifest`,
  });
  const validation = validateNexoraLocalData();

  const files = walk(root).map((file) => ({
    source: file,
    relative: path.relative(root, file),
    size: fs.statSync(file).size,
  }));

  const pack = {
    ok: true,
    nexoraBrain: true,
    packId,
    createdAt: now(),
    root,
    fileCount: files.length,
    files,
    manifest,
    validation,
    instructions: [
      "Upgrade or free Postgres storage first.",
      "Run DB check endpoint until durableKernel.ok is true.",
      "Run replay dry-run first.",
      "Replay local migration pack in small batches.",
      "Do not delete local files until durable replay is verified.",
    ],
    safety: {
      dryRunFirst: true,
      noDelete: true,
      noOverwrite: true,
      approvalGatesPreserved: true,
    },
  };

  const file = nexoraLocalPath("migration-pack", `${packId}.json`);
  writeNexoraJson(file, pack);

  return {
    ok: true,
    nexoraBrain: true,
    file,
    pack,
  };
}

export function createNexoraMigrationChecklist() {
  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_migration_checklist",
    createdAt: now(),
    checklist: [
      "Confirm Postgres storage is upgraded.",
      "Confirm /api/nexora/runtime/db-check returns durableKernel.ok true.",
      "Create migration pack.",
      "Validate local JSON/JSONL data.",
      "Run replay dry-run.",
      "Replay in small batches.",
      "Verify durable rows count.",
      "Create final backup pack.",
      "Only then mark local replay complete.",
    ],
  };
}
