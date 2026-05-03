import fs from "fs";
import path from "path";
import {
  nexoraLocalId,
  nexoraLocalPath,
  writeNexoraJson,
  readNexoraJson,
} from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", "client", ".cache"].includes(name)) continue;

    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|js)$/.test(name)) out.push(full);
  }

  return out;
}

export function createNexoraApiCatalogue(input: any = {}) {
  const catalogueId = String(input.catalogueId || nexoraLocalId("api_catalogue"));
  const files = [...walk("server"), ...walk("src")];

  const routes: any[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const routeRe = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;

    let match;
    while ((match = routeRe.exec(source))) {
      const method = match[1].toUpperCase();
      const routePath = match[2];

      if (!routePath.includes("/api/nexora")) continue;

      routes.push({
        method,
        path: routePath,
        file,
        group: routePath.split("/").slice(0, 4).join("/"),
        highRisk: /purge|delete|replay|execute|burst|approve|reject|restore|migration|release/i.test(routePath),
        write: ["POST", "PUT", "PATCH", "DELETE"].includes(method),
      });
    }
  }

  const grouped: Record<string, number> = {};
  for (const route of routes) {
    grouped[route.group] = Number(grouped[route.group] || 0) + 1;
  }

  const catalogue = {
    ok: true,
    nexoraBrain: true,
    catalogueId,
    createdAt: now(),
    routeCount: routes.length,
    groupCounts: grouped,
    routes: routes.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`)),
    safety: {
      highRiskRoutesMarked: true,
      nexoraOnlyBrain: true,
      noDeploy: true,
    },
  };

  const file = nexoraLocalPath("api-catalogue", `${catalogueId}.json`);
  writeNexoraJson(file, catalogue);

  return {
    ok: true,
    nexoraBrain: true,
    file,
    catalogue,
  };
}

export function getNexoraApiCatalogue(input: any = {}) {
  const catalogueId = String(input.catalogueId || "");
  const file = nexoraLocalPath("api-catalogue", `${catalogueId}.json`);

  return {
    ok: fs.existsSync(file),
    nexoraBrain: true,
    catalogueId,
    file,
    catalogue: readNexoraJson(file, null),
  };
}

export function getNexoraApiCatalogueStatus() {
  const latest = createNexoraApiCatalogue({ catalogueId: "latest" }).catalogue;

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_api_catalogue",
    routeCount: latest.routeCount,
    groupCounts: latest.groupCounts,
  };
}
