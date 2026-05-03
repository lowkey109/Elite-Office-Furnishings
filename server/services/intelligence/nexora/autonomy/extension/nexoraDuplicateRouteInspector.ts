import fs from "fs";
import path from "path";

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

function now() {
  return new Date().toISOString();
}

export function inspectNexoraDuplicateRoutes(input: any = {}) {
  const roots = Array.isArray(input.roots) && input.roots.length
    ? input.roots
    : ["server", "src"];

  const files = roots.flatMap((root: string) => {
    if (!fs.existsSync(root)) return [];
    if (fs.statSync(root).isFile()) return [root];
    return walk(root);
  });

  const routes: any[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const routeRe = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;

    let match;
    while ((match = routeRe.exec(source))) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
        file,
      });
    }
  }

  const grouped: Record<string, any[]> = {};

  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    grouped[key] = grouped[key] || [];
    grouped[key].push(route);
  }

  const duplicates = Object.entries(grouped)
    .filter(([, rows]) => rows.length > 1)
    .map(([route, rows]) => ({
      route,
      count: rows.length,
      files: rows.map((row) => row.file),
    }));

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_duplicate_route_inspector",
    generatedAt: now(),
    routeCount: routes.length,
    duplicateCount: duplicates.length,
    routes,
    duplicates,
  };
}
