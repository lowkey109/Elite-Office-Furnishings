import fs from "fs";
import path from "path";
import {
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { inspectNexoraLocalStorage } from "../storageguard/nexoraLocalStorageGuard";

function now() {
  return new Date().toISOString();
}

function walkJsonl(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walkJsonl(full, out);
    else if (name.endsWith(".jsonl")) out.push(full);
  }

  return out;
}

export function planNexoraLocalCompaction(input: any = {}) {
  const root = String(input.root || nexoraLocalPath());
  const keepLast = Number(input.keepLast || 500);
  const files = walkJsonl(root);

  const candidates = files.map((file: string) => {
    const rows = readNexoraJsonl(file);
    const stat = fs.statSync(file);
    return {
      file,
      relative: path.relative(root, file),
      rows: rows.length,
      sizeBytes: stat.size,
      wouldCompact: rows.length > keepLast,
      keepLast,
      archiveRows: Math.max(0, rows.length - keepLast),
    };
  }).filter((candidate: any) => candidate.wouldCompact);

  const plan = {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_compaction_plan",
    planId: nexoraLocalId("compaction_plan"),
    generatedAt: now(),
    root,
    keepLast,
    candidateCount: candidates.length,
    candidates,
    dryRun: true,
    safety: {
      noDeleteWithoutArchive: true,
      dryRunFirst: true,
    },
  };

  writeNexoraJson(nexoraLocalPath("compaction", `${plan.planId}.json`), plan);

  return plan;
}

export function runNexoraLocalCompactionDryRun(input: any = {}) {
  const plan = planNexoraLocalCompaction(input);
  const storage = inspectNexoraLocalStorage({});

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_compaction_dry_run",
    generatedAt: now(),
    plan,
    storage,
    note: "Dry-run only. No files were modified.",
  };
}

export function getNexoraCompactionStatus() {
  const plan = planNexoraLocalCompaction({});

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_compaction_status",
    candidateCount: plan.candidateCount,
    dryRunOnly: true,
  };
}
