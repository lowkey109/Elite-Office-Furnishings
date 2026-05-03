import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "data/nexora/local");

export function nexoraLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function ensureNexoraLocalDirs() {
  const dirs = [
    ROOT,
    path.join(ROOT, "journal"),
    path.join(ROOT, "timeline"),
    path.join(ROOT, "warehouse"),
    path.join(ROOT, "cache"),
    path.join(ROOT, "approvals"),
    path.join(ROOT, "crm"),
    path.join(ROOT, "quotes"),
    path.join(ROOT, "suppliers"),
    path.join(ROOT, "projects"),
    path.join(ROOT, "exports"),
    path.join(ROOT, "snapshots"),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return {
    ok: true,
    nexoraBrain: true,
    root: ROOT,
    dirs,
  };
}

export function nexoraLocalPath(...parts: string[]) {
  ensureNexoraLocalDirs();
  return path.join(ROOT, ...parts);
}

export function writeNexoraJson(file: string, data: any) {
  ensureNexoraLocalDirs();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
  return file;
}

export function readNexoraJson(file: string, fallback: any = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function appendNexoraJsonl(file: string, data: any) {
  ensureNexoraLocalDirs();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(data) + "\n", "utf8");
  return file;
}

export function readNexoraJsonl(file: string) {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          return {
            ok: false,
            corrupted: true,
            raw: line,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });
  } catch {
    return [];
  }
}

export function getNexoraLocalCoreStatus() {
  const dirs = ensureNexoraLocalDirs();
  const counts: Record<string, number> = {};

  for (const dir of dirs.dirs) {
    try {
      counts[path.basename(dir)] = fs.readdirSync(dir).length;
    } catch {
      counts[path.basename(dir)] = 0;
    }
  }

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_local_core",
    root: ROOT,
    counts,
    safety: {
      dbIndependent: true,
      nexoraOnlyBrain: true,
      highRiskApprovalGated: true,
      tradingMode: "paper/sandbox",
    },
  };
}
