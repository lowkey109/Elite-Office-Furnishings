const fs = require("fs");
const path = require("path");

const importSymbol = "registerNexoraAdvancedAutonomyRoutes";
const importPath = "./services/intelligence/nexora/autonomy/routes/nexoraAdvancedAutonomyRoutes";

const preferred = [
  "server/routes.ts",
  "server/index.ts",
  "server/app.ts",
  "server/server.ts",
  "server/routes.js",
  "server/index.js",
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", "client"].includes(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|js)$/.test(name)) out.push(full);
  }
  return out;
}

const candidates = [
  ...preferred.filter(fs.existsSync),
  ...walk("server"),
];

function score(file) {
  const s = fs.readFileSync(file, "utf8");
  let n = 0;
  if (file === "server/routes.ts") n += 100;
  if (s.includes("registerRoutes")) n += 60;
  if (s.includes("app.get") || s.includes("app.post")) n += 30;
  if (s.includes("express")) n += 20;
  if (s.includes("createServer")) n += 10;
  return n;
}

const target = candidates
  .map((f) => ({ f, n: score(f) }))
  .filter((x) => x.n > 0)
  .sort((a, b) => b.n - a.n)[0]?.f;

if (!target) {
  console.error("Could not locate route file. Scanned:", candidates);
  process.exit(1);
}

let s = fs.readFileSync(target, "utf8");

if (!s.includes(importSymbol)) {
  const rel = path.relative(path.dirname(target), "server/services/intelligence/nexora/autonomy/routes/nexoraAdvancedAutonomyRoutes").replace(/\\/g, "/");
  const finalImportPath = rel.startsWith(".") ? rel : `./${rel}`;
  const line = `import { ${importSymbol} } from "${finalImportPath}";\n`;

  if (/^import\s/m.test(s)) {
    const matches = [...s.matchAll(/^import[^\n]*\n/gm)];
    if (matches.length) {
      const last = matches[matches.length - 1];
      const at = last.index + last[0].length;
      s = s.slice(0, at) + line + s.slice(at);
    } else {
      s = line + s;
    }
  } else {
    s = line + s;
  }
}

if (!s.includes(`${importSymbol}(server, app)`) && !s.includes(`${importSymbol}(app)`)) {
  let patched = false;

  const patterns = [
    {
      name: "inside registerRoutes function with server and app",
      re: /(export\s+async\s+function\s+registerRoutes\s*\(\s*server\s*:\s*any\s*,\s*app\s*:\s*any\s*\)\s*{)/,
      add: `$1\n  ${importSymbol}(server, app);`,
    },
    {
      name: "inside registerRoutes function app only",
      re: /(export\s+async\s+function\s+registerRoutes\s*\(\s*app\s*:\s*any\s*\)\s*{)/,
      add: `$1\n  ${importSymbol}(app);`,
    },
    {
      name: "non-async registerRoutes server app",
      re: /(export\s+function\s+registerRoutes\s*\(\s*server\s*:\s*any\s*,\s*app\s*:\s*any\s*\)\s*{)/,
      add: `$1\n  ${importSymbol}(server, app);`,
    },
    {
      name: "non-async registerRoutes app only",
      re: /(export\s+function\s+registerRoutes\s*\(\s*app\s*:\s*any\s*\)\s*{)/,
      add: `$1\n  ${importSymbol}(app);`,
    },
    {
      name: "generic registerRoutes",
      re: /(export\s+(?:async\s+)?function\s+registerRoutes\s*\([^)]*\)\s*{)/,
      add: `$1\n  try { ${importSymbol}(typeof server !== "undefined" ? server : app, typeof app !== "undefined" ? app : undefined); } catch (e) { console.error("[NEXORA_ADVANCED_ROUTES_PATCH_ERROR]", e); }`,
    },
    {
      name: "express app const",
      re: /(const\s+app\s*=\s*express\s*\(\s*\)\s*;?)/,
      add: `$1\n${importSymbol}(app);`,
    },
  ];

  for (const p of patterns) {
    if (p.re.test(s)) {
      s = s.replace(p.re, p.add);
      console.log("Patched using", p.name);
      patched = true;
      break;
    }
  }

  if (!patched && s.includes("app.get(")) {
    const idx = s.indexOf("app.get(");
    s = s.slice(0, idx) + `${importSymbol}(app);\n` + s.slice(idx);
    patched = true;
  }

  if (!patched) {
    console.error("Found target but could not patch safely:", target);
    process.exit(1);
  }
}

fs.writeFileSync(target, s);
console.log("Patched Nexora advanced routes into", target);
