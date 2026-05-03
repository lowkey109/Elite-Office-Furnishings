import fs from "fs";
import path from "path";
import {
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJson,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";
import { listNexoraLocalLeads } from "../localcrm/nexoraLocalCrm";
import { listNexoraLocalQuotes } from "../localquotes/nexoraLocalQuoteBook";
import { listNexoraLocalSuppliers } from "../localsuppliers/nexoraLocalSupplierCatalogue";
import { listNexoraLocalProjects } from "../localprojects/nexoraLocalProjectBoard";
import { listNexoraLocalApprovals } from "../localapprovals/nexoraLocalApprovalGate";
import { getNexoraTimeline } from "../timeline/nexoraTimeline";
import { getNexoraMetrics } from "../warehouse/nexoraLocalWarehouse";

function now() {
  return new Date().toISOString();
}

export function createNexoraExportPack(input: any = {}) {
  const exportId = String(input.exportId || nexoraLocalId("export"));

  const pack = {
    ok: true,
    nexoraBrain: true,
    exportId,
    createdAt: now(),
    leads: listNexoraLocalLeads({ limit: 1000 }),
    quotes: listNexoraLocalQuotes({ limit: 1000 }),
    suppliers: listNexoraLocalSuppliers({ limit: 1000 }),
    projects: listNexoraLocalProjects({ limit: 1000 }),
    approvals: listNexoraLocalApprovals({ limit: 1000 }),
    timeline: getNexoraTimeline({ limit: 1000 }),
    metrics: getNexoraMetrics({ limit: 1000 }),
    safety: {
      nexoraOnlyBrain: true,
      localOnlyExport: true,
      noDbRequired: true,
    },
  };

  const file = nexoraLocalPath("exports", `${exportId}.json`);
  writeNexoraJson(file, pack);

  return {
    ok: true,
    nexoraBrain: true,
    exportId,
    file,
    pack,
  };
}

export function listNexoraExportPacks() {
  const dir = nexoraLocalPath("exports");
  fs.mkdirSync(dir, { recursive: true });

  const rows = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const full = path.join(dir, name);
      return {
        exportId: name.replace(/\.json$/, ""),
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

export function getNexoraExportPack(input: any = {}) {
  const exportId = String(input.exportId || "");
  const file = nexoraLocalPath("exports", `${exportId}.json`);

  return {
    ok: true,
    nexoraBrain: true,
    exportId,
    file,
    pack: readNexoraJson(file, null),
  };
}
