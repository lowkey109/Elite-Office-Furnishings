import fs from "fs";
import path from "path";
import {
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", ".cache"].includes(name)) continue;

    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }

  return out;
}

function bytesToMb(bytes: number) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

export function inspectNexoraLocalStorage(input: any = {}) {
  const root = String(input.root || nexoraLocalPath());
  const limitMb = Number(input.limitMb || 250);
  const files = walk(root);

  const rows = files.map((file: string) => {
    const stat = fs.statSync(file);
    return {
      file,
      relative: path.relative(root, file),
      sizeBytes: stat.size,
      sizeMb: bytesToMb(stat.size),
      updatedAt: stat.mtime.toISOString(),
      extension: path.extname(file),
    };
  }).sort((a: any, b: any) => b.sizeBytes - a.sizeBytes);

  const totalBytes = rows.reduce((sum: number, row: any) => sum + row.sizeBytes, 0);
  const totalMb = bytesToMb(totalBytes);
  const usagePercent = Math.round((totalMb / limitMb) * 10000) / 100;

  const report = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_storage_guard",
    generatedAt: now(),
    root,
    limitMb,
    totalBytes,
    totalMb,
    usagePercent,
    fileCount: rows.length,
    largestFiles: rows.slice(0, 25),
    warning: usagePercent >= 80,
    critical: usagePercent >= 95,
    recommendation:
      usagePercent >= 95
        ? "Critical local storage pressure. Create archive pack and compact logs."
        : usagePercent >= 80
          ? "Storage warning. Consider compaction and archive pack."
          : "Local storage healthy.",
  };

  const file = nexoraLocalPath("storage-guard", `${nexoraLocalId("storage_report")}.json`);
  writeNexoraJson(file, report);

  return report;
}

export function getNexoraStorageGuardStatus() {
  const report = inspectNexoraLocalStorage({});

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_storage_guard_status",
    totalMb: report.totalMb,
    fileCount: report.fileCount,
    warning: report.warning,
    critical: report.critical,
    recommendation: report.recommendation,
  };
}
