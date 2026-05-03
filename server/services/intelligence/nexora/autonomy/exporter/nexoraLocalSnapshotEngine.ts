import fs from "fs";
import path from "path";
import {
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { getNexoraOfflineOpsConsole } from "../opsconsole/nexoraOfflineOpsConsole";

function now() {
  return new Date().toISOString();
}

function walkFiles(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }

  return out;
}

export function createNexoraLocalSnapshot(input: any = {}) {
  const snapshotId = String(input.snapshotId || nexoraLocalId("snapshot"));
  const root = nexoraLocalPath();
  const files = walkFiles(root);
  const consoleView = getNexoraOfflineOpsConsole();

  const snapshot = {
    ok: true,
    nexoraBrain: true,
    snapshotId,
    createdAt: now(),
    root,
    fileCount: files.length,
    files: files.map((file) => ({
      file,
      size: fs.statSync(file).size,
      relative: path.relative(root, file),
    })),
    consoleView,
    note: "Local snapshot is DB-independent and safe while Postgres is full.",
  };

  const file = nexoraLocalPath("snapshots", `${snapshotId}.json`);
  writeNexoraJson(file, snapshot);

  return {
    ok: true,
    nexoraBrain: true,
    snapshot,
    file,
  };
}

export function getNexoraLocalSnapshot(input: any = {}) {
  const snapshotId = String(input.snapshotId || "");
  const file = nexoraLocalPath("snapshots", `${snapshotId}.json`);

  return {
    ok: true,
    nexoraBrain: true,
    snapshotId,
    file,
    snapshot: readNexoraJson(file, null),
  };
}

export function listNexoraLocalSnapshots() {
  const dir = nexoraLocalPath("snapshots");
  fs.mkdirSync(dir, { recursive: true });

  const rows = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const full = path.join(dir, name);
      return {
        snapshotId: name.replace(/\.json$/, ""),
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
