import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "data/nexora/local/unified-agent-runtime");

export function nowIso() {
  return new Date().toISOString();
}

export function runtimeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function ensureRuntimeDirs() {
  const dirs = [
    ROOT,
    path.join(ROOT, "agents"),
    path.join(ROOT, "tasks"),
    path.join(ROOT, "memory"),
    path.join(ROOT, "heartbeats"),
    path.join(ROOT, "events"),
    path.join(ROOT, "logs"),
    path.join(ROOT, "reports"),
    path.join(ROOT, "registry"),
  ];

  for (const dir of dirs) fs.mkdirSync(dir, { recursive: true });

  return {
    ok: true,
    root: ROOT,
    dirs,
  };
}

export function runtimePath(...parts: string[]) {
  ensureRuntimeDirs();
  return path.join(ROOT, ...parts);
}

export function writeJsonAtomic(file: string, data: any) {
  ensureRuntimeDirs();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
  return file;
}

export function readJson<T = any>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function appendJsonl(file: string, data: any) {
  ensureRuntimeDirs();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(data) + "\n", "utf8");
  return file;
}

export function readJsonl<T = any>(file: string): T[] {
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
          } as any;
        }
      });
  } catch {
    return [];
  }
}

export function listJsonFiles(dir: string) {
  ensureRuntimeDirs();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dir, name))
    .sort();
}
