const fs = require("fs");
const path = require("path");

const symbol = "registerNexoraGovernorBusinessRoutes";
const routeFile = "server/services/intelligence/nexora/autonomy/routes/nexoraGovernorBusinessRoutes";

const preferred = [
  "server/routes.ts",
  "server/index.ts",
  "server/app.ts",
  "server/server.ts",
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", "client"].includes(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|js)$/.test(name)) out.push(full);
  }
  return out;
}

function score(file) {
  const s = fs.readFileSync(file, "utf8");
  let n = 0;
  if (file === "server/routes.ts") n += 100;
  if (s.includes("registerRoutes")) n += 60;
  if (s.includes("app.get") || s.includes("app.post")) n += 30;
  if (s.includes("express")) n += 20;
  return n;
}

const candidates = [...preferred.filter(fs.existsSync), ...walk("server")];
const target = candidates
  .map((f) => ({ f, n: score(f) }))
  .filter((x) => x.n > 0)
  .sort((a, b) => b.n - a.n)[0]?.f;

if (!target) {
  console.error("Could not locate server route entrypoint.");
  process.exit(1);
}

let s = fs.readFileSync(target, "utf8");

if (!s.includes(symbol)) {
  const rel = path.relative(path.dirname(target), routeFile).replace(/\\/g, "/");
  const importPath = rel.startsWith(".") ? rel : `./${rel}`;
  const importLine = `import { ${symbol} } from "${importPath}";\n`;

  if (/^import\s/m.test(s)) {
    const imports = [...s.matchAll(/^import[^\n]*\n/gm)];
    const last = imports[imports.length - 1];
    if (last) {
      const idx = last.index + last[0].length;
      s = s.slice(0, idx) + importLine + s.slice(idx);
    } else {
      s = importLine + s;
    }
  } else {
    s = importLine + s;
  }
}

if (!s.includes(`${symbol}(server, app)`) && !s.includes(`${symbol}(app)`)) {
  const patches = [
    {
      re: /(export\s+async\s+function\s+registerRoutes\s*\(\s*server\s*:\s*any\s*,\s*app\s*:\s*any\s*\)\s*{)/,
      add: `$1\n  ${symbol}(server, app);`,
    },
    {
      re: /(export\s+function\s+registerRoutes\s*\(\s*server\s*:\s*any\s*,\s*app\s*:\s*any\s*\)\s*{)/,
      add: `$1\n  ${symbol}(server, app);`,
    },
    {
      re: /(export\s+async\s+function\s+registerRoutes\s*\(\s*app\s*:\s*any\s*\)\s*{)/,
      add: `$1\n  ${symbol}(app);`,
    },
    {
      re: /(export\s+function\s+registerRoutes\s*\(\s*app\s*:\s*any\s*\)\s*{)/,
      add: `$1\n  ${symbol}(app);`,
    },
    {
      re: /(export\s+(?:async\s+)?function\s+registerRoutes\s*\([^)]*\)\s*{)/,
      add: `$1\n  try { ${symbol}(typeof server !== "undefined" ? server : app, typeof app !== "undefined" ? app : undefined); } catch (e) { console.error("[NEXORA_GOVERNOR_ROUTES_PATCH_ERROR]", e); }`,
    },
    {
      re: /(const\s+app\s*=\s*express\s*\(\s*\)\s*;?)/,
      add: `$1\n${symbol}(app);`,
    },
  ];

  let patched = false;
  for (const patch of patches) {
    if (patch.re.test(s)) {
      s = s.replace(patch.re, patch.add);
      patched = true;
      break;
    }
  }

  if (!patched && s.includes("app.get(")) {
    const idx = s.indexOf("app.get(");
    s = s.slice(0, idx) + `${symbol}(app);\n` + s.slice(idx);
    patched = true;
  }

  if (!patched) {
    console.error("Found route file but could not patch:", target);
    process.exit(1);
  }
}

fs.writeFileSync(target, s);
console.log("Patched Build 9 routes into", target);
