import fs from "fs";
import {
  appendNexoraJsonl,
  nexoraLocalId,
  nexoraLocalPath,
  readNexoraJsonl,
  writeNexoraJson,
} from "../localcore/nexoraLocalCore";

function now() {
  return new Date().toISOString();
}

const ROUTE_LOG = nexoraLocalPath("route-governance", "route-governance-log.jsonl");

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;

  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", "client", ".cache"].includes(name)) continue;
    const full = `${dir}/${name}`;
    const stat = fs.statSync(full);

    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|js)$/.test(name)) out.push(full);
  }

  return out;
}

export function createNexoraRouteGovernanceSnapshot() {
  const snapshotId = nexoraLocalId("route_snapshot");
  const files = [...walk("server"), ...walk("src")];
  const routes: any[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const routeRe = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;

    let match;
    while ((match = routeRe.exec(source))) {
      const method = match[1].toUpperCase();
      const routePath = match[2];

      routes.push({
        method,
        path: routePath,
        file,
        highRisk: /purge|delete|replay|execute|burst|approve|reject|restore|migration/i.test(routePath),
        nexoraRoute: routePath.includes("/api/nexora"),
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

  const snapshot = {
    ok: true,
    nexoraBrain: true,
    snapshotId,
    createdAt: now(),
    routeCount: routes.length,
    nexoraRouteCount: routes.filter((route) => route.nexoraRoute).length,
    highRiskCount: routes.filter((route) => route.highRisk).length,
    duplicateCount: duplicates.length,
    routes,
    duplicates,
  };

  writeNexoraJson(nexoraLocalPath("route-governance", `${snapshotId}.json`), snapshot);
  appendNexoraJsonl(ROUTE_LOG, {
    event: "route.snapshot.created",
    snapshot,
    createdAt: now(),
  });

  return {
    ok: true,
    nexoraBrain: true,
    snapshot,
  };
}

export function evaluateNexoraRouteRisk(input: any = {}) {
  const method = String(input.method || "GET").toUpperCase();
  const routePath = String(input.path || "");

  const highRisk = /purge|delete|replay|execute|burst|approve|reject|restore|migration/i.test(routePath);
  const writeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const approvalRecommended = highRisk || method === "DELETE";

  return {
    ok: true,
    nexoraBrain: true,
    method,
    path: routePath,
    writeMethod,
    highRisk,
    approvalRecommended,
    requiredRole: approvalRecommended ? "admin" : writeMethod ? "operator" : "viewer",
    createdAt: now(),
  };
}

export function listNexoraRouteGovernanceSnapshots(input: any = {}) {
  const limit = Number(input.limit || 50);

  const rows = readNexoraJsonl(ROUTE_LOG)
    .filter((row: any) => row.event === "route.snapshot.created")
    .map((row: any) => row.snapshot)
    .slice(-limit)
    .reverse();

  return {
    ok: true,
    nexoraBrain: true,
    count: rows.length,
    rows,
  };
}
