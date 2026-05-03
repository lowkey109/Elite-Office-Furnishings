import fs from "fs";
import path from "path";
import {
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { validateNexoraLocalData } from "../validation/nexoraLocalDataValidator";

function now() {
  return new Date().toISOString();
}

export function createNexoraRestorePoint(input: any = {}) {
  const restorePointId = String(input.restorePointId || nexoraLocalId("restore_point"));
  const root = nexoraLocalPath();
  const validation = validateNexoraLocalData();

  const restorePoint = {
    ok: true,
    nexoraBrain: true,
    restorePointId,
    root,
    createdAt: now(),
    validation,
    note: "Restore point metadata only. File copies are handled by backup packs.",
    safety: {
      noOverwrite: true,
      dryRunRequired: true,
    },
  };

  const file = nexoraLocalPath("restore", `${restorePointId}.json`);
  writeNexoraJson(file, restorePoint);

  return {
    ok: true,
    nexoraBrain: true,
    file,
    restorePoint,
  };
}

export function dryRunNexoraRestorePoint(input: any = {}) {
  const restorePointId = String(input.restorePointId || "");
  const file = nexoraLocalPath("restore", `${restorePointId}.json`);
  const restorePoint = readNexoraJson(file, null);

  if (!restorePoint) {
    return {
      ok: false,
      nexoraBrain: true,
      error: "Restore point not found.",
      restorePointId,
    };
  }

  return {
    ok: true,
    nexoraBrain: true,
    dryRun: true,
    restorePointId,
    wouldRestore: false,
    checks: [
      "Restore point exists.",
      "No files overwritten.",
      "No files deleted.",
      "Manual review required before any restore implementation.",
    ],
    restorePoint,
  };
}

export function listNexoraRestorePoints() {
  const dir = nexoraLocalPath("restore");
  fs.mkdirSync(dir, { recursive: true });

  const rows = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const full = path.join(dir, name);
      return {
        restorePointId: name.replace(/\.json$/, ""),
        file: full,
        size: fs.statSync(full).size,
        updatedAt: fs.statSync(full).mtime.toISOString(),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}
