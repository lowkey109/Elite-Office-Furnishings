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

export function inspectNexoraDependencyGraph(input: any = {}) {
  const roots = Array.isArray(input.roots) && input.roots.length
    ? input.roots
    : [
        "server/services/intelligence/nexora",
        "server/routes.ts",
      ];

  const files = roots.flatMap((root: string) => {
    if (!fs.existsSync(root)) return [];
    if (fs.statSync(root).isFile()) return [root];
    return walk(root);
  });

  const nodes: any[] = [];
  const edges: any[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");

    const imports = [...source.matchAll(/import\s+[^;]+from\s+["']([^"']+)["']/g)]
      .map((match) => match[1]);

    const exports = [
      ...source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g),
    ].map((match) => match[1]);

    const registrars = [
      ...source.matchAll(/export\s+function\s+(register[A-Za-z0-9_]*Routes)\s*\(/g),
    ].map((match) => match[1]);

    nodes.push({
      file,
      imports,
      exports,
      registrars,
      lines: source.split("\n").length,
    });

    for (const importPath of imports) {
      edges.push({
        from: file,
        to: importPath,
        type: "import",
      });
    }
  }

  return {
    ok: true,
    nexoraBrain: true,
    service: "nexora_dependency_graph_inspector",
    generatedAt: now(),
    fileCount: files.length,
    edgeCount: edges.length,
    nodes,
    edges,
  };
}

export function findNexoraMissingLocalImports() {
  const graph = inspectNexoraDependencyGraph();
  const missing: any[] = [];

  for (const node of graph.nodes) {
    for (const importPath of node.imports) {
      if (!importPath.startsWith(".")) continue;

      const base = path.resolve(path.dirname(node.file), importPath);
      const candidates = [
        `${base}.ts`,
        `${base}.js`,
        path.join(base, "index.ts"),
        path.join(base, "index.js"),
      ];

      if (!candidates.some((candidate) => fs.existsSync(candidate))) {
        missing.push({
          file: node.file,
          importPath,
          candidates,
        });
      }
    }
  }

  return {
    ok: missing.length === 0,
    nexoraBrain: true,
    service: "nexora_missing_import_detector",
    missingCount: missing.length,
    missing,
  };
}
