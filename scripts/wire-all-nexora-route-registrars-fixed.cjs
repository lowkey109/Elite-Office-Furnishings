const fs = require("fs");
const path = require("path");

const routesFile = "server/routes.ts";
const reportDir = process.env.REPORT_DIR || "reports/nexora-audit/wire-all-fixed-latest";

fs.mkdirSync(reportDir, { recursive: true });

function walk(dir, out = []) {
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

function importPathFor(targetFile, sourceFile) {
  const withoutExt = sourceFile.replace(/\.(ts|js)$/, "");
  const rel = path.relative(path.dirname(targetFile), withoutExt).replace(/\\/g, "/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (!fs.existsSync(routesFile)) {
  console.error(`Missing ${routesFile}`);
  process.exit(1);
}

let source = fs.readFileSync(routesFile, "utf8");

const allFiles = [
  ...walk("server/services/intelligence/nexora"),
  ...walk("server"),
].filter((file) => file !== routesFile);

const registrars = [];

for (const file of allFiles) {
  const fileSource = fs.readFileSync(file, "utf8");
  const re = /export\s+function\s+(register[A-Za-z0-9_]*Routes)\s*\(/g;

  let match;
  while ((match = re.exec(fileSource))) {
    const name = match[1];
    if (!/Nexora/i.test(name)) continue;

    registrars.push({
      name,
      file,
      importPath: importPathFor(routesFile, file),
    });
  }
}

const uniqueRegistrars = uniqueBy(registrars, (row) => row.name)
  .sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(
  path.join(reportDir, "01-discovered-registrars.json"),
  JSON.stringify({ registrarCount: uniqueRegistrars.length, registrars: uniqueRegistrars }, null, 2),
);

const importsToAdd = [];

for (const registrar of uniqueRegistrars) {
  const importRe = new RegExp(`import\\s*\\{[^}]*\\b${escapeRegex(registrar.name)}\\b[^}]*\\}\\s*from\\s*["']`);
  if (!importRe.test(source)) {
    importsToAdd.push(`import { ${registrar.name} } from "${registrar.importPath}";`);
  }
}

if (importsToAdd.length) {
  const importMatches = [...source.matchAll(/^import[^\n]*\n/gm)];
  if (importMatches.length) {
    const last = importMatches[importMatches.length - 1];
    const idx = last.index + last[0].length;
    source = source.slice(0, idx) + importsToAdd.join("\n") + "\n" + source.slice(idx);
  } else {
    source = importsToAdd.join("\n") + "\n" + source;
  }
}

// Remove any old auto-wire block, including broken ones.
source = source.replace(
  /\s*\/\/ NEXORA_AUTO_WIRE_ALL_BEGIN[\s\S]*?\/\/ NEXORA_AUTO_WIRE_ALL_END\s*/g,
  "\n",
);

// Find registerRoutes function and its first app-like parameter.
const functionRe = /(export\s+async\s+function\s+registerRoutes\s*\(([^)]*)\)\s*(?::[^{]+)?\s*{)|(export\s+function\s+registerRoutes\s*\(([^)]*)\)\s*(?::[^{]+)?\s*{)|(async\s+function\s+registerRoutes\s*\(([^)]*)\)\s*(?::[^{]+)?\s*{)|(function\s+registerRoutes\s*\(([^)]*)\)\s*(?::[^{]+)?\s*{)/;

const functionMatch = source.match(functionRe);

if (!functionMatch) {
  console.error("Could not find registerRoutes(...) function.");
  process.exit(1);
}

const paramsRaw = functionMatch[2] || functionMatch[4] || functionMatch[6] || functionMatch[8] || "";
const params = paramsRaw
  .split(",")
  .map((part) => part.trim())
  .filter(Boolean)
  .map((part) => part.split(":")[0].trim().replace(/[{}]/g, ""));

const appVar =
  params.find((p) => p === "app") ||
  params.find((p) => /app/i.test(p)) ||
  params[0] ||
  "app";

const calls = uniqueRegistrars.map((registrar) => `    ${registrar.name}(${appVar});`);

const block = [
  "",
  "  // NEXORA_AUTO_WIRE_ALL_BEGIN",
  "  try {",
  ...calls,
  "  } catch (error) {",
  '    console.error("[NEXORA_AUTO_WIRE_ALL_ERROR]", error);',
  "  }",
  "  // NEXORA_AUTO_WIRE_ALL_END",
  "",
].join("\n");

source = source.replace(functionRe, (match) => `${match}${block}`);

fs.writeFileSync(routesFile, source);

const after = fs.readFileSync(routesFile, "utf8");

const mountReport = uniqueRegistrars.map((registrar) => {
  const imported = new RegExp(`import\\s*\\{[^}]*\\b${escapeRegex(registrar.name)}\\b[^}]*\\}`).test(after);
  const called = new RegExp(`\\b${escapeRegex(registrar.name)}\\s*\$begin:math:text$\\\\s\*\$\{escapeRegex\(appVar\)\}\\\\s\*\\$end:math:text$`).test(after);

  return {
    ...registrar,
    appVar,
    imported,
    called,
    mounted: imported && called,
  };
});

const missing = mountReport.filter((row) => !row.mounted);

fs.writeFileSync(
  path.join(reportDir, "02-mount-report.json"),
  JSON.stringify({
    ok: missing.length === 0,
    appVar,
    importsAdded: importsToAdd.length,
    totalRegistrars: uniqueRegistrars.length,
    missing,
    mountReport,
  }, null, 2),
);

fs.writeFileSync(
  path.join(reportDir, "02-mount-report.md"),
  [
    "# Nexora Route Wiring Report",
    "",
    `App variable used: **${appVar}**`,
    `Total registrars: **${uniqueRegistrars.length}**`,
    `Imports added: **${importsToAdd.length}**`,
    `Missing mounts: **${missing.length}**`,
    "",
    "| Mounted | Registrar | File |",
    "|---|---|---|",
    ...mountReport.map((row) => `| ${row.mounted ? "yes" : "NO"} | \`${row.name}\` | \`${row.file}\` |`),
  ].join("\n"),
);

console.log(`Discovered Nexora registrars: ${uniqueRegistrars.length}`);
console.log(`Imports added: ${importsToAdd.length}`);
console.log(`App var: ${appVar}`);
console.log(`Missing mounts: ${missing.length}`);

if (missing.length) {
  console.error(JSON.stringify(missing, null, 2));
  process.exit(1);
}
