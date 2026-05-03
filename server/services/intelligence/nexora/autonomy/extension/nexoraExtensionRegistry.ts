import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "data/nexora/local/extension");
const REGISTRY_FILE = path.join(ROOT, "extension-registry.json");
const LOG_FILE = path.join(ROOT, "extension-log.jsonl");

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function readJson(file: string, fallback: any) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: any) {
  ensureRoot();
  const tmp = `${file}.tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function appendJsonl(file: string, value: any) {
  ensureRoot();
  fs.appendFileSync(file, JSON.stringify(value) + "\n", "utf8");
}

export function registerNexoraExtension(input: any = {}) {
  ensureRoot();

  const registry = readJson(REGISTRY_FILE, {
    ok: true,
    nexoraBrain: true,
    service: "nexora_extension_registry",
    createdAt: now(),
    updatedAt: now(),
    extensions: [],
  });

  const extension = {
    extensionId: String(input.extensionId || id("extension")),
    name: String(input.name || "unnamed_extension"),
    build: String(input.build || "unknown"),
    category: String(input.category || "general"),
    file: String(input.file || ""),
    registrar: input.registrar ? String(input.registrar) : null,
    routes: Array.isArray(input.routes) ? input.routes : [],
    mode: String(input.mode || "extension_only"),
    overwritesExisting: Boolean(input.overwritesExisting),
    createdAt: now(),
    metadata: input.metadata || {},
  };

  const existingIndex = registry.extensions.findIndex((x: any) => x.name === extension.name);

  if (existingIndex >= 0) {
    registry.extensions[existingIndex] = {
      ...registry.extensions[existingIndex],
      ...extension,
      updatedAt: now(),
    };
  } else {
    registry.extensions.push(extension);
  }

  registry.updatedAt = now();

  writeJson(REGISTRY_FILE, registry);
  appendJsonl(LOG_FILE, {
    event: "extension.registered",
    extension,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    extension,
    registryFile: REGISTRY_FILE,
  };
}

export function listNexoraExtensions(input: any = {}) {
  ensureRoot();

  const category = input.category ? String(input.category) : "";
  const registry = readJson(REGISTRY_FILE, {
    ok: true,
    nexoraBrain: true,
    extensions: [],
  });

  const rows = registry.extensions
    .filter((extension: any) => !category || extension.category === category)
    .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}

export function getNexoraExtensionRegistryStatus() {
  const all = listNexoraExtensions();

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_extension_registry",
    generatedAt: now(),
    totalExtensions: all.count,
    registryFile: REGISTRY_FILE,
    logFile: LOG_FILE,
  };
}
