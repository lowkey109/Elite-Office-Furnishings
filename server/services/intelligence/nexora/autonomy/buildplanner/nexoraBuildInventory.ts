import fs from "fs";
import path from "path";

function now() {
  return new Date().toISOString();
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", "client", ".cache"].includes(name)) continue;

    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|js)$/.test(name)) {
      out.push(full);
    }
  }

  return out;
}

export function createNexoraBuildInventory(input: any = {}) {
  const roots: string[] = Array.isArray(input.roots) && input.roots.length
    ? input.roots.map((root: any) => String(root))
    : ["server/services/intelligence/nexora", "server/routes.ts"];

  const files = roots.flatMap((root: string) => {
    if (!fs.existsSync(root)) return [];
    if (fs.statSync(root).isFile()) return [root];
    return walk(root);
  });

  const rows = files.map((file: string) => {
    const source = fs.readFileSync(file, "utf8");

    const exportedFunctions = [
      ...source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g),
    ].map((m) => m[1]);

    const registrars = [
      ...source.matchAll(/export\s+function\s+(register[A-Za-z0-9_]*Routes)\s*\(/g),
    ].map((m) => m[1]);

    const routes = [
      ...source.matchAll(/\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g),
    ].map((m) => ({
      method: m[1].toUpperCase(),
      path: m[2],
    }));

    const imports = [
      ...source.matchAll(/import\s+[^;]+from\s+["']([^"']+)["']/g),
    ].map((m) => m[1]);

    return {
      file,
      basename: path.basename(file),
      lines: source.split("\n").length,
      exportedFunctions,
      registrars,
      routes,
      imports,
      hasNexoraBrainMarker: source.includes("nexoraBrain"),
      hasApprovalGateMarker: /approval|risk|gate/i.test(source),
      hasFallbackMarker: /fallback|local|filebus|resilience/i.test(source),
    };
  });

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_build_inventory",
    generatedAt: now(),
    rootCount: roots.length,
    fileCount: rows.length,
    rows,
  };
}
