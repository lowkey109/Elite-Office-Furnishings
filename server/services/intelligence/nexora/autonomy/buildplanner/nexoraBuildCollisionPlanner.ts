import fs from "fs";
import path from "path";
import { createNexoraBuildInventory } from "./nexoraBuildInventory";

function now() {
  return new Date().toISOString();
}

export function planNexoraBuildCollisionCheck(input: any = {}) {
  const proposedFiles = Array.isArray(input.proposedFiles) ? input.proposedFiles : [];
  const proposedFunctions = Array.isArray(input.proposedFunctions) ? input.proposedFunctions : [];
  const proposedRoutes = Array.isArray(input.proposedRoutes) ? input.proposedRoutes : [];

  const inventory = createNexoraBuildInventory();

  const existingFiles = new Set(inventory.rows.map((row: any) => row.file));
  const existingBasenames = new Set(inventory.rows.map((row: any) => row.basename.replace(/\.(ts|js)$/, "")));
  const existingFunctions = new Set(inventory.rows.flatMap((row: any) => row.exportedFunctions));
  const existingRoutes = new Set(
    inventory.rows.flatMap((row: any) => row.routes.map((route: any) => `${route.method} ${route.path}`)),
  );

  const fileCollisions = proposedFiles.filter((file: string) => existingFiles.has(file));
  const basenameCollisions = proposedFiles
    .map((file: string) => path.basename(file).replace(/\.(ts|js)$/, ""))
    .filter((base: string) => existingBasenames.has(base));

  const functionCollisions = proposedFunctions.filter((fn: string) => existingFunctions.has(fn));
  const routeCollisions = proposedRoutes.filter((route: any) => {
    const key = `${String(route.method || "GET").toUpperCase()} ${String(route.path || "")}`;
    return existingRoutes.has(key);
  });

  const blockers = [
    ...fileCollisions.map((file: string) => ({ type: "file", value: file })),
    ...functionCollisions.map((fn: string) => ({ type: "function", value: fn })),
    ...routeCollisions.map((route: any) => ({ type: "route", value: `${route.method} ${route.path}` })),
  ];

  return {
    ok: blockers.length === 0,
    nexoraBrain: true,
    service: "nexora_build_collision_planner",
    generatedAt: now(),
    proposed: {
      files: proposedFiles,
      functions: proposedFunctions,
      routes: proposedRoutes,
    },
    collisions: {
      fileCollisions,
      basenameCollisions,
      functionCollisions,
      routeCollisions,
    },
    blockers,
    recommendation: blockers.length
      ? "Do not overwrite. Rename new modules/functions/routes or extend existing files with guarded append."
      : "No hard blockers detected. Continue with extension-only build.",
  };
}
